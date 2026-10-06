/**
 * weather.js — "Weer van nu" via de Open-Meteo Forecast API met het KNMI-model
 *
 * Model knmi_seamless: HARMONIE-AROME Nederland 2 km, aangevuld met Europa 5,5 km en ECMWF.
 * Geen API-sleutel, CORS toegestaan, data CC BY 4.0. "current" = 15-minutenwaarde van het model;
 * straling = gemiddelde over de voorafgaande 15 minuten (SPEC §6.2).
 * mapOpenMeteo() is puur (testbaar met de fixture); fetchCurrent() krijgt fetch geïnjecteerd.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./solar.js'));
    else root.EwfWeather = factory(root.EwfSolar);
})(typeof self !== 'undefined' ? self : this, function (SOL) {
    'use strict';

    const API = 'https://api.open-meteo.com/v1/forecast';
    const CURRENT = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'surface_pressure', 'wind_speed_10m',
        'wind_direction_10m', 'wind_gusts_10m', 'cloud_cover', 'shortwave_radiation', 'direct_radiation',
        'diffuse_radiation', 'direct_normal_irradiance', 'global_tilted_irradiance', 'is_day'];
    const TIMEOUT_MS = 8000;
    const CACHE_MS = 10 * 60 * 1000;

    /** KNMI-stations voor de locatiekeuze (De Bilt standaard). */
    const STATIONS = {
        debilt: { lat: 52.10, lon: 5.18, name: 'De Bilt (260)' },
        schiphol: { lat: 52.32, lon: 4.79, name: 'Schiphol (240)' },
        rotterdam: { lat: 51.96, lon: 4.45, name: 'Rotterdam (344)' },
        eelde: { lat: 53.13, lon: 6.59, name: 'Eelde (280)' },
        beek: { lat: 50.91, lon: 5.77, name: 'Maastricht-Beek (380)' },
        vlissingen: { lat: 51.44, lon: 3.60, name: 'Vlissingen (310)' }
    };

    /** Fout met code: network | timeout | http | parse | offline. */
    class WeatherError extends Error {
        constructor(code, detail) {
            super(code);
            this.name = 'WeatherError';
            this.code = code;
            this.detail = detail;
        }
    }

    function buildUrl({ lat, lon, surfAz = 0 }) {
        const q = [
            `latitude=${lat.toFixed(2)}`, `longitude=${lon.toFixed(2)}`, `current=${CURRENT.join(',')}`,
            'tilt=90', `azimuth=${Math.round(surfAz)}`, 'models=knmi_seamless', 'wind_speed_unit=ms',
            'timezone=Europe%2FAmsterdam'
        ];
        return `${API}?${q.join('&')}`;
    }

    /** Lokale tijd "YYYY-MM-DDTHH:MM" + utc_offset_seconds → ISO (UTC). */
    function toUTC(local, offsetSec) {
        const ms = Date.parse(local + 'Z');
        if (!isFinite(ms)) return null;
        return new Date(ms - (offsetSec || 0) * 1000).toISOString();
    }

    const num = (v) => (v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v));

    /**
     * Open-Meteo-respons → weerwaarden (SI, zie EwfModel.normalizeWeather).
     * Straling op de gevel: beam = DNI·cos θ (eigen zonnestand op current.time), diffuus = GTI − beam.
     */
    function mapOpenMeteo(json, { surfAz = 0 } = {}) {
        const c = json && json.current;
        if (!c || num(c.temperature_2m) == null || num(c.relative_humidity_2m) == null) throw new WeatherError('parse');
        const time = toUTC(c.time, json.utc_offset_seconds);
        if (!time) throw new WeatherError('parse');
        const lat = num(json.latitude), lon = num(json.longitude);
        const w = {
            t: num(c.temperature_2m), rh: Math.max(0.5, Math.min(100, num(c.relative_humidity_2m))),
            p: num(c.surface_pressure) != null ? num(c.surface_pressure) * 100 : 101325,
            U10: num(c.wind_speed_10m) != null ? num(c.wind_speed_10m) : 0, dir: num(c.wind_direction_10m),
            gust: num(c.wind_gusts_10m), cloud: num(c.cloud_cover),
            ghi: num(c.shortwave_radiation), dni: num(c.direct_normal_irradiance), dhi: num(c.diffuse_radiation),
            gti: num(c.global_tilted_irradiance), gtiAz: num(c.global_tilted_irradiance) != null ? surfAz : null,
            time, localTime: c.time, interval: num(c.interval), facadeManual: false, facade: 0,
            lat: lat != null ? lat : 52.10, lon: lon != null ? lon : 5.18
        };
        // Splitsing op de gevel (informatief; het model rekent dezelfde splitsing opnieuw)
        const sun = SOL.sunPosition(time, w.lat, w.lon);
        if (w.gti != null && w.dni != null) {
            const cosTh = sun.alt > 0 ? Math.max(0, SOL.cosIncidence(sun.alt, sun.az, surfAz, 90)) : 0;
            w.beam = Math.min(w.gti, w.dni * cosTh);
            w.diffuse = Math.max(0, w.gti - w.beam);
        } else {
            const r = SOL.onSurface({ ghi: w.ghi == null ? 0 : w.ghi, dni: w.dni == null ? undefined : w.dni,
                dhi: w.dhi == null ? undefined : w.dhi, alt: sun.alt, az: sun.az, doy: sun.doy, surfAz });
            w.beam = r.beam;
            w.diffuse = r.diffuse;
        }
        w.sunAlt = sun.alt;
        w.sunAz = sun.az;
        return w;
    }

    const cache = new Map();
    function clearCache() { cache.clear(); }

    /**
     * Haal het actuele weer op. Time-out 8 s (AbortController), cache 10 min per locatie/azimut.
     * Fouten worden als WeatherError afgewezen (nooit onafgevangen).
     */
    async function fetchCurrent({ lat = 52.10, lon = 5.18, surfAz = 0, fetchImpl, signal, now = Date.now, timeoutMs = TIMEOUT_MS } = {}) {
        const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
        if (!f) throw new WeatherError('network');
        if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) throw new WeatherError('offline');
        const url = buildUrl({ lat, lon, surfAz });
        const hit = cache.get(url);
        if (hit && now() - hit.at < CACHE_MS) return Object.assign({}, hit.value, { cached: true });
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; if (ctrl) ctrl.abort(); }, timeoutMs);
        if (signal && ctrl) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
        try {
            let res;
            try {
                res = await f(url, ctrl ? { signal: ctrl.signal } : undefined);
            } catch (e) {
                throw new WeatherError(timedOut ? 'timeout' : 'network', e && e.message);
            }
            if (!res || !res.ok) throw new WeatherError('http', res && res.status);
            let json;
            try { json = await res.json(); } catch (e) { throw new WeatherError(timedOut ? 'timeout' : 'parse'); }
            const value = Object.assign(mapOpenMeteo(json, { surfAz }), { fetchedAt: new Date(now()).toISOString() });
            cache.set(url, { at: now(), value });
            return value;
        } catch (e) {
            throw e instanceof WeatherError ? e : new WeatherError('parse', e && e.message);
        } finally {
            clearTimeout(timer);
        }
    }

    return { API, CURRENT, STATIONS, TIMEOUT_MS, CACHE_MS, WeatherError, buildUrl, toUTC, mapOpenMeteo, fetchCurrent, clearCache };
});
