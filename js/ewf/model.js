/**
 * model.js — Earth, Wind & Fire: gebouwmodel, weerpresets en momentopname van het hele systeem
 *
 * simulate(building, weather) koppelt Ventecdak, klimaatcascade, ruimte, zonneschoorsteen,
 * FiWiHEx en de drukbalans per verdieping (SPEC §5). Puur: geen DOM, geen globale toestand.
 * Invoer en uitvoer in SI (°C, Pa, kg/kg, kg/s, m³/s, W); FIELDS beschrijft de UI-eenheden.
 * Referentie: docs/ewf/ewf_prototype.py; validatie: runValidation() (SPEC §12.1).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../psychro.js'), require('./physics.js'), require('./solar.js'));
    } else root.EwfModel = factory(root.Psychro, root.EwfPhysics, root.EwfSolar);
})(typeof self !== 'undefined' ? self : this, function (P, PH, SOL) {
    'use strict';

    const { G, RHO_W, CP_W, CP_DA, CP_V, RHO_REF, P_STD } = PH;
    const LAT = 52.10, LON = 5.18;                       // KNMI-station 260 De Bilt
    const BBL_PER_PERSON = 6.5;                          // dm³/s per persoon, Bbl art. 4.122 lid 2
    const SFP_CONV = 2640;                               // W/(m³/s), conventionele LBK 900 + 600 Pa (§7.5.2.2)
    const COP_CONV = 3.0;                                // luchtgekoelde koelmachine (§7.5.2.3)

    // =====================================================================
    // Catalogi
    // =====================================================================
    /** Sproeispectra: Fulljet uit de testopstelling (§3.4.10.1) en tabel 3.2.3/2 (d10/d20/d30/d32 in mm). */
    const SPRAY = {
        fulljet: { d30: 1.048e-3, d32: 1.317e-3, src: '§3.4.10.1' },
        s1: { d10: 2.95e-3, d20: 3.55e-3, d30: 4.01e-3, d32: 5.14e-3 },
        s2: { d10: 2.65e-3, d20: 3.19e-3, d30: 3.61e-3, d32: 4.62e-3 },
        s3: { d10: 2.36e-3, d20: 2.84e-3, d30: 3.21e-3, d32: 4.11e-3 },
        s4: { d10: 2.06e-3, d20: 2.48e-3, d30: 2.81e-3, d32: 3.60e-3 },
        s5: { d10: 1.77e-3, d20: 2.13e-3, d30: 2.41e-3, d32: 3.08e-3 },
        s6: { d10: 1.47e-3, d20: 1.77e-3, d30: 2.01e-3, d32: 2.57e-3 },
        s7: { d10: 1.18e-3, d20: 1.42e-3, d30: 1.61e-3, d32: 2.05e-3 },
        s8: { d10: 0.88e-3, d20: 1.06e-3, d30: 1.20e-3, d32: 1.54e-3 },
        s9: { d10: 0.59e-3, d20: 0.71e-3, d30: 0.80e-3, d32: 1.03e-3 },
        s10: { d10: 0.29e-3, d20: 0.35e-3, d30: 0.40e-3, d32: 0.51e-3 },
        custom: null
    };
    for (let i = 1; i <= 10; i++) SPRAY['s' + i].src = 'tab. 3.2.3/2';

    /** Glas zonneschoorsteen (tab. 4.1.4, §4.5.6.4). */
    const GLASS = {
        ps: { g: 0.75, U: 1.10 },          // Planitherm Solar 4/15/4 argon
        pt: { g: 0.70, U: 1.32 },          // Planitherm Total low-E (testopstelling)
        clear: { g: 0.70, U: 3.00 },       // blank dubbel glas
        custom: null
    };

    /** Terreinklassen Davenport (tab. 2.1.1); d voor klasse 7–8 is een aanname. */
    const TERRAIN = {
        4: { z0: 0.1, d: 0 }, 5: { z0: 0.25, d: 0 }, 6: { z0: 0.5, d: 10 }, 7: { z0: 1.0, d: 10 }, 8: { z0: 2.0, d: 15 }
    };

    /** NEN-EN 16798-1 (tab. 3.5.1/1): q_p [dm³/s·p] en q_B [dm³/(s·m²)] per emissieklasse. */
    const VENT_CATS = {
        I: { qp: 10, qB: { verylow: 0.5, low: 1.0, non: 2.0 } },
        II: { qp: 7, qB: { verylow: 0.35, low: 0.7, non: 1.4 } },
        III: { qp: 4, qB: { verylow: 0.2, low: 0.4, non: 0.8 } }
    };

    // =====================================================================
    // Invoervelden (standaardgebouw = 8-laags model uit het proefschrift, SPEC §7)
    //   def/range/hard in SI; ui = { unit, scale (SI → UI), dec }; assume = aanname (badge in de UI)
    // =====================================================================
    const num = (key, group, def, range, hard, unit, src, extra) =>
        Object.assign({ key, group, type: 'num', def, range, hard, unit, scale: 1, src }, extra || {});
    const sel = (key, group, def, options, src, extra) => Object.assign({ key, group, type: 'select', def, options, src }, extra || {});
    const is = (k, v) => (b) => b[k] === v;

    const FIELDS = [
        // Gebouw
        num('floors', 'building', 8, [4, 20], [1, 40], '', '§1.3.6', { int: true, dec: 0 }),
        num('hFloor', 'building', 3.5, [3.0, 4.5], [2, 10], 'm', '§1.3.6'),
        num('avoFloor', 'building', 1000, [100, 5000], [10, 100000], 'm²', '§3.5.2.1', { dec: 0 }),
        num('bvoFactor', 'building', 1.5, [1.2, 2.0], [1, 5], '–', '§7.2.2'),
        num('occDensity', 'building', 0.10, [0.03, 0.25], [0.001, 2], 'p/m²', '§3.1.7.2'),
        num('presence', 'building', 0.9, [0.5, 1.0], [0, 1], '%', 'tab. 7.4.4', { scale: 100, dec: 0 }),
        num('qInt', 'building', 35, [10, 80], [0, 500], 'W/m²', 'tab. 7.4.4'),
        num('moistPerson', 'building', 65, [40, 100], [0, 500], 'g/(h·p)', '§3.1.7.2'),
        num('tRoomSummer', 'building', 25, [20, 28], [10, 40], '°C', '§3.1.5, §3.5.1.2'),
        num('tRoomWinter', 'building', 21, [18, 23], [10, 40], '°C', 'tab. 7.4.4'),
        num('rhRoomMax', 'building', 60, null, [10, 100], '%', '§3.1.5.5', { dec: 0 }),
        num('xRoomMax', 'building', 0.012, null, [0.002, 0.03], 'g/kg', '§3.1.5.5', { scale: 1000 }),
        // Ventilatie
        sel('ventMethod', 'vent', 'nen', ['nen', 'manual'], '§3.5.1.1'),
        sel('ventCat', 'vent', 'II', ['I', 'II', 'III'], 'NEN-EN 16798-1', { when: is('ventMethod', 'nen') }),
        sel('emission', 'vent', 'low', ['verylow', 'low', 'non'], 'NEN-EN 16798-1', { when: is('ventMethod', 'nen') }),
        num('qManual', 'vent', 11.2, null, [0.01, 200], 'm³/h', '—', { scale: 3600, dec: 0, when: is('ventMethod', 'manual') }),
        num('tSupCool', 'vent', 17, [14, 20], [5, 30], '°C', '§3.1.7'),
        num('tSupHeat', 'vent', 18, [14, 20], [5, 30], '°C', '§3.5.6.6'),
        // Klimaatcascade
        num('wCascade', 'cascade', 2.0, [1.0, 2.5], [0.2, 6], 'm/s', '§3.2.15.3, §3.5.2.2'),
        sel('spray', 'cascade', 'fulljet', Object.keys(SPRAY), '§3.4.10.1, tab. 3.2.3/2'),
        num('d30', 'cascade', 1.048e-3, null, [0.1e-3, 10e-3], 'mm', '§3.2.3', { scale: 1000, dec: 3, when: is('spray', 'custom') }),
        num('d32', 'cascade', 1.317e-3, null, [0.1e-3, 10e-3], 'mm', '§3.2.3', { scale: 1000, dec: 3, when: is('spray', 'custom') }),
        num('w0', 'cascade', 10, [4, 15], [1, 30], 'm/s', '§3.2.4'),
        sel('rwlMode', 'cascade', 'auto', ['auto', 'manual'], '§3.5.3'),
        num('rwlMin', 'cascade', 0.3, [0.2, 1.6], [0.05, 3], '–', '§3.5.3', { when: is('rwlMode', 'auto') }),
        num('rwlMax', 'cascade', 1.2, [0.2, 1.6], [0.05, 3], '–', '§3.5.3', { when: is('rwlMode', 'auto') }),
        num('rwlWinter', 'cascade', 0.9, [0.2, 1.6], [0.05, 3], '–', '§3.4.8, §3.5.5.7', { when: is('rwlMode', 'auto') }),
        num('rwlManual', 'cascade', 0.9, [0.2, 1.6], [0.05, 3], '–', '§3.1.8', { when: is('rwlMode', 'manual') }),
        num('tWCool', 'cascade', 13, [8, 20], [1, 40], '°C', '§3.1.7.4'),
        num('tWHeat', 'cascade', 13, [8, 20], [1, 40], '°C', '§3.5.6'),
        num('tWFrost', 'cascade', 15, [8, 20], [1, 40], '°C', 'case D4'),
        num('tFrostLimit', 'cascade', 0, null, [-20, 10], '°C', 'case D4'),
        { key: 'variantA1', group: 'cascade', type: 'bool', def: false, src: '§3.5.6.4' },
        num('tA1Min', 'cascade', 10, null, [-20, 17], '°C', '§3.5.6.4', { assume: true, when: is('variantA1', true) }),
        // Ventecdak
        sel('terrain', 'ventec', '6', ['4', '5', '6', '7', '8'], 'tab. 2.1.1, §2.5.2'),
        num('roofExtra', 'ventec', 4, [2, 8], [0, 20], 'm', 'fig. 2.2.2', { assume: true }),
        num('cpIn', 'ventec', 0.8, [0.5, 0.9], [0, 1.2], '–', '§2.4.3'),
        sel('cTop', 'ventec', '2', ['1', '2'], '2.3.1/2.3.2, §2.3.4'),
        num('uEjDesign', 'ventec', 1.0, [0.5, 2.5], [0.1, 10], 'm/s', '§2.5.3'),
        // Zonneschoorsteen
        sel('chimType', 'chimney', 'chimney', ['chimney', 'facade'], '§4.1'),
        num('chimAz', 'chimney', 0, [-180, 180], [-180, 180], '°', '§4.1.8', { dec: 0 }),
        num('chimB', 'chimney', 11.5, [1, 60], [0.2, 200], 'm', '§4.5.4'),
        num('chimD', 'chimney', 0.65, [0.25, 1.5], [0.05, 5], 'm', '§4.2.8.1'),
        sel('glass', 'chimney', 'pt', Object.keys(GLASS), 'tab. 4.1.4'),
        num('glassG', 'chimney', 0.70, null, [0.05, 0.95], '–', 'tab. 4.1.4', { when: is('glass', 'custom') }),
        num('glassU', 'chimney', 1.32, null, [0.3, 6], 'W/(m²·K)', 'tab. 4.1.4', { when: is('glass', 'custom') }),
        num('chimR', 'chimney', 0.95, [0.8, 1.0], [0.3, 1], '–', '§4.2.8.1'),
        num('epsAbs', 'chimney', 0.05, [0.05, 0.95], [0.02, 1], '–', 'tab. 4.2.5'),
        num('uWall', 'chimney', 0.25, [0.1, 1.0], [0.01, 5], 'W/(m²·K)', '§4.4.1.2'),
        num('f1', 'chimney', 0.25, null, [0, 1], '–', '§4.2.2'),
        num('f2', 'chimney', 0.75, null, [0, 1], '–', '§4.2.2'),
        num('cwc', 'chimney', 7.65, null, [1, 20], 'W·s/(m³·K)', '4.2.4/9'),
        // Afvoer & drukverlies
        num('dpSupDesign', 'exhaust', 25, [5, 80], [0, 300], 'Pa', '§3.5.5.7', { dec: 0 }),
        num('dpExhExt', 'exhaust', 5, [1, 30], [0, 200], 'Pa', '§4.2.7.7', { dec: 0 }),
        num('wShunt', 'exhaust', 1.0, null, [0.2, 5], 'm/s', '§4.2.7.8'),
        num('zetaU', 'exhaust', 0.5, null, [0, 5], '–', '§4.2.7.8'),
        num('roughness', 'exhaust', 0.010, [0.001, 0.020], [0, 0.1], 'mm', 'fig. 4.2.7/1', { scale: 1000, dec: 0 }),
        num('dpFiwihex', 'exhaust', 10, null, [0, 100], 'Pa', '§4.5.8.2', { assume: true, dec: 0 }),
        num('fiwiEff', 'exhaust', 0.7, null, [0, 1], '–', '§4.5.8.2', { assume: true }),
        num('fiwiTWater', 'exhaust', 20, null, [0, 60], '°C', '§4.5.8.2', { assume: true }),
        // Geavanceerd
        num('nCells', 'advanced', 400, [100, 2000], [20, 4000], '', '—', { int: true, dec: 0 }),
        num('pNozzle', 'advanced', 50e3, null, [0, 500e3], 'kPa', '§3.5.4.2', { scale: 1e-3, dec: 0 }),
        num('pipeR', 'advanced', 100, null, [0, 1000], 'Pa/m', '§3.5.4.2', { dec: 0 }),
        num('dpLocal', 'advanced', 1e3, null, [0, 100e3], 'kPa', '§3.5.4.2', { scale: 1e-3, dec: 1 }),
        num('etaPump', 'advanced', 0.75, null, [0.1, 1], '–', '§3.5.4.2'),
        num('dpSource', 'advanced', 15e3, null, [0, 300e3], 'kPa', '§3.5.4.3', { scale: 1e-3, dec: 0 }),
        num('etaFanV', 'advanced', 0.85, null, [0.1, 1], '–', '§4.5.11.8'),
        num('etaFanM', 'advanced', 0.90, null, [0.1, 1], '–', '§4.5.11.8'),
        num('dtStrat', 'advanced', 0, [0, 4], [-5, 15], 'K', '—')
    ];
    const FIELD = {};
    for (const f of FIELDS) FIELD[f.key] = f;

    const DEFAULTS = {};
    for (const f of FIELDS) DEFAULTS[f.key] = f.def;

    /** Weervelden (SI). Straling op de gevel: berekend uit GHI/DNI/DHI/GTI of handmatig (facadeManual). */
    const WEATHER_FIELDS = [
        num('t', 'weather', 28, [-25, 40], [-40, 50], '°C', '—'),
        num('rh', 'weather', 55, [1, 100], [0.5, 100], '%', '—', { dec: 0 }),
        num('p', 'weather', 101325, [95000, 105000], [80000, 110000], 'hPa', '—', { scale: 0.01, dec: 1 }),
        num('U10', 'weather', 3.5, [0, 30], [0, 60], 'm/s', 'KNMI potentiële wind'),
        num('dir', 'weather', 0, null, [0, 360], '°', '§2.2.4', { dec: 0 }),
        num('ghi', 'weather', 0, [0, 1100], [0, 1400], 'W/m²', '—', { dec: 0 }),
        num('facade', 'weather', 400, [0, 1100], [0, 1400], 'W/m²', '§4.2.3', { dec: 0 })
    ];
    const WFIELD = {};
    for (const f of WEATHER_FIELDS) WFIELD[f.key] = f;

    // =====================================================================
    // Weersituaties (SPEC §6.3) — namen en toelichting in i18n (ewf.preset.<id>)
    // =====================================================================
    const SEASON_DATE = { summer: '2026-07-21', spring: '2026-03-21', winter: '2026-12-21' };
    const PRESETS = [
        { id: 'ontwerp_zomer', t: 28.0, rh: 55, U10: 3.5, facade: 400, season: 'summer', src: '§3.1.7.2 (D1), §2.5.4, §4.2.3' },
        { id: 'gem_zomer', t: 20.0, rh: 80, U10: 3.5, facade: 400, season: 'summer', src: '§3.5.3 (D2/B2), §4.2.3' },
        { id: 'hitte_2019', t: 37.1, rh: 29, U10: 3.0, ghi: 728, time: '2019-07-25T13:30:00Z', src: 'KNMI 260, uur 14' },
        { id: 'benauwd_2020', t: 31.3, rh: 44, U10: 3.0, ghi: 706, time: '2020-08-12T12:30:00Z', src: 'KNMI 260, uur 13' },
        { id: 'voorjaar_2023', t: 8.1, rh: 51, U10: 3.0, ghi: 617, time: '2023-03-15T11:30:00Z', src: 'KNMI 260, uur 12' },
        { id: 'tussen', t: 10.1, rh: 99, U10: 3.5, facade: 150, season: 'spring', assumed: ['facade'], src: '§3.4.5 (B4)' },
        { id: 'gem_winter', t: 5.0, rh: 90, U10: 4.0, facade: 80, season: 'winter', assumed: ['U10', 'facade'], src: 'case D3' },
        { id: 'zon_winter', t: 0.55, rh: 80, U10: 3.0, facade: 730, season: 'winter', assumed: ['rh', 'U10'], src: '§4.4.5.2' },
        { id: 'koude_2021', t: -7.0, rh: 75, U10: 3.0, ghi: 217, time: '2021-02-13T08:30:00Z', src: 'KNMI 260, uur 9' },
        { id: 'ontwerp_winter', t: -10.0, rh: 90, U10: 5.0, facade: 0, season: 'winter', assumed: ['U10'], src: 'case D4; ISSO 51/53/57' },
        { id: 'storm_2022', t: 11.0, rh: 56, U10: 13.0, ghi: 175, time: '2022-02-18T14:30:00Z', src: 'KNMI 260, uur 15' },
        { id: 'windstil', t: 20.0, rh: 80, U10: 0.8, facade: 120, season: 'summer', assumed: ['U10', 'facade'], src: '—' }
    ];
    const PRESET = {};
    for (const pr of PRESETS) PRESET[pr.id] = pr;

    /** ISO-tijdstip (UTC) van de ware middag in De Bilt op een datum. */
    function solarNoonISO(dateStr, lon = LON) {
        const d0 = new Date(dateStr + 'T00:00:00Z');
        const { doy } = SOL.dayAndHour(d0);
        return new Date(d0.getTime() + Math.round(SOL.solarNoonUTC(doy, lon) * 3600) * 1000).toISOString();
    }

    /** Weerwaarden (SI) voor een preset. */
    function presetWeather(idOrPreset) {
        const pr = typeof idOrPreset === 'string' ? PRESET[idOrPreset] : idOrPreset;
        if (!pr) throw new Error('unknown preset');
        const fixed = pr.facade != null;
        return {
            t: pr.t, rh: pr.rh, p: P_STD, U10: pr.U10, dir: null,
            ghi: fixed ? null : pr.ghi, dni: null, dhi: null, gti: null, gtiAz: null,
            time: fixed ? solarNoonISO(SEASON_DATE[pr.season]) : pr.time,
            facadeManual: fixed, facade: fixed ? pr.facade : 0, lat: LAT, lon: LON
        };
    }

    // =====================================================================
    // Normalisatie en waarschuwingen
    // =====================================================================
    const warn = (code, level, vars) => ({ code, level, vars: vars || {} });
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    /** Lees één veld: standaardwaarde bij ongeldige invoer, harde grenzen, waarschuwing buiten zinvol bereik. */
    function readField(f, src, out, warnings) {
        const raw = src[f.key];
        if (f.type === 'select') { out[f.key] = f.options.includes(String(raw)) ? String(raw) : f.def; return; }
        if (f.type === 'bool') { out[f.key] = typeof raw === 'boolean' ? raw : f.def; return; }
        let v = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
        if (!isFinite(v)) v = f.def;
        if (f.int) v = Math.round(v);
        if (v < f.hard[0] || v > f.hard[1]) {
            warnings.push(warn('inputClamped', 'warn', { field: f.key, value: v, min: f.hard[0], max: f.hard[1], scale: f.scale, unit: f.unit }));
            v = clamp(v, f.hard[0], f.hard[1]);
        } else if (f.range && (v < f.range[0] - 1e-9 || v > f.range[1] + 1e-9)) {
            warnings.push(warn('inputRange', 'warn', { field: f.key, value: v, min: f.range[0], max: f.range[1], scale: f.scale, unit: f.unit }));
        }
        out[f.key] = v;
    }

    /** Gebouw aanvullen met DEFAULTS; catalogi (sproeier, glas) leveren hun waarden. */
    function normalizeBuilding(src, warnings = []) {
        const b = {};
        for (const f of FIELDS) readField(f, src || {}, b, warnings);
        if (b.spray !== 'custom') { b.d30 = SPRAY[b.spray].d30; b.d32 = SPRAY[b.spray].d32; }
        if (b.glass !== 'custom') { b.glassG = GLASS[b.glass].g; b.glassU = GLASS[b.glass].U; }
        if (b.rwlMax < b.rwlMin) b.rwlMax = b.rwlMin;
        return b;
    }

    /** Weer aanvullen; tijd als ISO (UTC), optionele stralingscomponenten blijven null. */
    function normalizeWeather(src, warnings = []) {
        src = src || {};
        const w = {};
        for (const f of WEATHER_FIELDS) {
            if ((f.key === 'ghi' && src.facadeManual) || (f.key === 'facade' && !src.facadeManual)) {
                const v = Number(src[f.key]);
                w[f.key] = isFinite(v) ? clamp(v, f.hard[0], f.hard[1]) : (f.key === 'ghi' ? null : 0);
                continue;
            }
            readField(f, src, w, warnings);
        }
        if (src.dir == null || !isFinite(Number(src.dir))) w.dir = null;
        for (const k of ['dni', 'dhi', 'gti', 'gtiAz']) {
            const v = Number(src[k]);
            w[k] = src[k] != null && isFinite(v) ? v : null;
        }
        if (w.dni != null) w.dni = clamp(w.dni, 0, 1400);
        if (w.dhi != null) w.dhi = clamp(w.dhi, 0, 1400);
        if (w.gti != null) w.gti = clamp(w.gti, 0, 1400);
        w.facadeManual = !!src.facadeManual;
        const d = new Date(src.time || '');
        w.time = isFinite(d.getTime()) ? d.toISOString() : solarNoonISO(SEASON_DATE.summer);
        w.lat = isFinite(Number(src.lat)) && src.lat != null ? clamp(Number(src.lat), -90, 90) : LAT;
        w.lon = isFinite(Number(src.lon)) && src.lon != null ? clamp(Number(src.lon), -180, 180) : LON;
        return w;
    }

    /**
     * Straling op de zonneschoorsteen: { beam, diffuse, theta, angleCorr, total, sun }.
     * Handmatig/vaste gevelwaarde: totaal als diffuus, zonder invalshoekcorrectie (conventie proefschrift).
     * Open-Meteo-GTI voor dezelfde gevelazimut: beam = DNI·cos θ, diffuus = GTI − beam (SPEC §6.2).
     * Anders Erbs + Hay-Davies uit GHI (SPEC §6.4).
     */
    function facadeRadiation(w, b) {
        const sun = SOL.sunPosition(w.time, w.lat, w.lon);
        if (w.facadeManual) {
            return { beam: 0, diffuse: w.facade, theta: 0, angleCorr: false, total: w.facade, sun, method: 'manual' };
        }
        if (w.gti != null && w.dni != null && w.gtiAz != null && Math.abs(w.gtiAz - b.chimAz) < 0.5) {
            const cosTh = sun.alt > 0 ? Math.max(0, SOL.cosIncidence(sun.alt, sun.az, b.chimAz, 90)) : 0;
            const beam = Math.min(w.gti, w.dni * cosTh);
            return {
                beam, diffuse: Math.max(0, w.gti - beam), theta: Math.acos(Math.min(1, cosTh)) * 180 / Math.PI,
                angleCorr: true, total: Math.max(w.gti, beam), sun, method: 'gti'
            };
        }
        const r = SOL.onSurface({ ghi: w.ghi == null ? undefined : w.ghi, dni: w.dni == null ? undefined : w.dni, dhi: w.dhi == null ? undefined : w.dhi,
            alt: sun.alt, az: sun.az, doy: sun.doy, surfAz: b.chimAz, tilt: 90 });
        return { beam: r.beam, diffuse: r.diffuse, theta: r.theta, angleCorr: true, total: r.beam + r.diffuse, sun, method: 'model' };
    }

    // =====================================================================
    // Momentopname
    // =====================================================================
    const safeState = (t, x, p) => {
        try { return P.state(t, Math.max(0, x), p); } catch (e) { return null; }
    };
    const pathPt = (t, x) => ({ t, x, h: P.enthalpy(t, x) });

    /** Ventilatiedebiet [m³/s] bij ρ_ref = 1,20 kg/m³ (SPEC §5.1). */
    function ventilationFlow(b, AVO, nPers) {
        if (b.ventMethod === 'manual') return b.qManual;
        const c = VENT_CATS[b.ventCat];
        return (nPers * c.qp + AVO * c.qB[b.emission]) / 1000;
    }

    /**
     * Quasi-stationaire momentopname van het EWF-systeem voor één weersituatie (SPEC §5.11).
     * options.rwl forceert de water/luchtfactor (bijv. voor gevoeligheidsanalyse).
     */
    function simulate(building, weather, options = {}) {
        const warnings = [];
        const b = normalizeBuilding(building, warnings);
        const w = normalizeWeather(weather, warnings);
        const p = w.p;
        const te = w.t, xe = P.xFromTRh(te, w.rh, p);
        const outdoor = safeState(te, xe, p);
        const rhoE = PH.rhoMoist(te, xe, p);

        // ---- Gebouw en debiet (§5.1)
        const n = b.floors, hf = b.hFloor, H = n * hf;
        const AVO = n * b.avoFloor, BVO = AVO * b.bvoFactor, nPers = AVO * b.occDensity;
        const qV = ventilationFlow(b, AVO, nPers);
        if (qV < nPers * BBL_PER_PERSON / 1000 - 1e-9) {
            warnings.push(warn('bblFlow', 'warn', { q: qV * 1000 / Math.max(nPers, 1e-9), min: BBL_PER_PERSON }));
        }
        const mDa = qV * RHO_REF / (1 + xe);
        const Ac = qV / b.wCascade, sideC = Math.sqrt(Ac);
        const zRoof = H + b.roofExtra, aEj = qV / b.uEjDesign;
        const terrain = TERRAIN[b.terrain];

        // ---- Bedrijfsmodus (§3.5.3, §3.5.6)
        let mode = te > b.tSupCool ? 'cool' : 'heat';
        if (mode === 'heat' && b.variantA1 && te >= b.tA1Min) mode = 'off';

        // ---- Klimaatcascade
        const casIn = { H, Ac, mDa, tIn: te, xIn: xe, d30: b.d30, d32: b.d32, p, w0: b.w0 };
        let rwl, tWIn;
        if (mode === 'cool') {
            tWIn = b.tWCool;
            if (isFinite(options.rwl)) rwl = options.rwl;
            else if (b.rwlMode === 'manual') rwl = b.rwlManual;
            else {
                const a = PH.cascadeAutoRwl(Object.assign({ tTarget: b.tSupCool, rwlMin: b.rwlMin, rwlMax: b.rwlMax, tWIn }, casIn));
                rwl = a.rwl;
                if (a.warning) warnings.push(a.warning);
            }
        } else if (mode === 'heat') {
            tWIn = te < b.tFrostLimit ? b.tWFrost : b.tWHeat;
            rwl = isFinite(options.rwl) ? options.rwl : b.rwlMode === 'manual' ? b.rwlManual : b.rwlWinter;
        } else {
            tWIn = b.tWHeat;
            rwl = 0;
            warnings.push(warn('cascadeOff', 'info'));
        }
        const cas = PH.cascade(Object.assign({}, casIn, { mW: rwl * mDa, tWIn, N: b.nCells, active: mode !== 'off' }));
        warnings.push(...cas.warnings);
        if (mode !== 'off' && te < 0 && rwl < 0.5) warnings.push(warn('iceLikely', 'warn', { rwl }));
        if (cas.active && cas.rh < 90) warnings.push(warn('rhOutLow', 'info', { rh: cas.rh }));
        const casOut = safeState(cas.t, cas.x, p);

        // ---- Naverwarming (§3.5.6.6)
        const tSet = mode === 'cool' ? b.tSupCool : b.tSupHeat;
        let tSup = cas.t, Qreheat = 0;
        const xSup = cas.x;
        if (cas.t < tSet - 0.05) { Qreheat = mDa * (PH.hAir(tSet, xSup) - PH.hAir(cas.t, xSup)); tSup = tSet; }
        const supply = safeState(tSup, xSup, p);

        // ---- Ruimte (§5.5)
        const tRoom = mode === 'cool' ? b.tRoomSummer : b.tRoomWinter;
        const Gmoist = nPers * b.presence * b.moistPerson / 3.6e6;           // kg/s
        const xRoom = xSup + Gmoist / mDa;
        const room = safeState(tRoom, xRoom, p);
        const rhRoom = room ? room.rh : 100;
        const Qvent = mDa * (CP_DA + CP_V * xSup) * (tRoom - tSup);         // + = koelend
        const Qint = b.qInt * AVO * b.presence;
        if (rhRoom > b.rhRoomMax || xRoom > b.xRoomMax) {
            warnings.push(warn('roomHumid', 'warn', { rh: rhRoom, x: xRoom * 1000, rhMax: b.rhRoomMax, xMax: b.xRoomMax * 1000 }));
        }
        if (te < 0 && rhRoom > 45) warnings.push(warn('condensWinter', 'warn', { rh: rhRoom }));

        // ---- Zonneschoorsteen (§5.6)
        const rad = facadeRadiation(w, b);
        const chim = PH.chimney({
            H, B: b.chimB, D: b.chimD, q: qV, tIn: tRoom + b.dtStrat, tE: te, xE: xe,
            phiBeam: rad.beam, phiDiff: rad.diffuse, theta: rad.theta, angleCorr: rad.angleCorr,
            g: b.glassG, U: b.glassU, R: b.chimR, f1: b.f1, f2: b.f2, epsW: b.epsAbs, Uwall: b.uWall,
            tBack: tRoom, p, hSeg: hf, cwc: b.cwc
        });
        const chimOpen = chim.Q > 0;                                        // kantelpunt §4.5.6.8
        if (!chimOpen) warnings.push(warn('chimneyClosed', 'info', { q: chim.Q / 1000 }));
        if (chim.tGlassMax > 80) warnings.push(warn('glassHot', 'warn', { t: chim.tGlassMax }));
        const tTop = chimOpen ? chim.tOut : tRoom;

        // ---- FiWiHEx (§4.5.8.2, aannames)
        const dTfiwi = b.fiwiEff * Math.max(0, tTop - b.fiwiTWater);
        const Qhr = mDa * CP_DA * dTfiwi;
        const tAfter = tTop - dTfiwi;

        // ---- Ventecdak (§5.2)
        const vd = PH.ventecdak({ U10: w.U10, zRoof, qExh: qV, aEjector: aEj, rho: rhoE, c: +b.cTop, cpIn: b.cpIn, z0: terrain.z0, d: terrain.d });
        warnings.push(...vd.warnings);

        // ---- Drukbalans toevoer (§5.4)
        const dpThKc = PH.stackDraft(cas.profile, rhoE);
        const rhoTs = PH.rhoMoist(tSup, xSup, p);
        const pBase = vd.pOver + cas.dpHydr + dpThKc;
        const supplyRows = [];
        for (let k = 1; k <= n; k++) {
            const z = (k - 0.5) * hf;
            const dpShaft = G * z * (rhoTs - rhoE);
            const available = pBase - dpShaft - b.dpSupDesign;
            supplyRows.push({
                floor: k, z, available, throttle: Math.max(0, available), deficit: Math.max(0, -available),
                parts: { pOver: vd.pOver, dpHydr: cas.dpHydr, dpThCascade: dpThKc, dpShaft: -dpShaft, loss: -b.dpSupDesign }
            });
        }

        // ---- Drukbalans afvoer (§5.6–5.7)
        const rhoRoom = PH.rhoMoist(tRoom, xRoom, p);
        const DhCh = 2 * b.chimB * b.chimD / (b.chimB + b.chimD);
        const dpChFric = PH.frictionDp(H, DhCh, chim.w, RHO_REF, b.roughness);
        const Ash = qV / b.wShunt, DhSh = Math.sqrt(Ash);                   // vierkante shunt (aanname)
        const dpDyn = 0.5 * RHO_REF * chim.w * chim.w;
        const dpU = b.zetaU * 0.5 * RHO_REF * b.wShunt * b.wShunt;
        const dpThCh = chimOpen ? chim.dpTh : G * H * (rhoE - rhoRoom);
        const exhaustRows = [];
        for (let k = 1; k <= n; k++) {
            const z = (k - 0.5) * hf;
            const dpShFric = PH.frictionDp(z, DhSh, b.wShunt, RHO_REF, b.roughness);
            const shuntCol = G * z * (rhoRoom - rhoE);
            const losses = { ext: b.dpExhExt, shunt: dpShFric, ubend: dpU, chimney: dpChFric, fiwihex: b.dpFiwihex, dyn: dpDyn };
            const lossSum = losses.ext + losses.shunt + losses.ubend + losses.chimney + losses.fiwihex + losses.dyn;
            const available = dpThCh + shuntCol - vd.pEj - lossSum;
            exhaustRows.push({
                floor: k, z, available, throttle: Math.max(0, available), deficit: Math.max(0, -available),
                parts: { dpThChimney: dpThCh, dpShunt: shuntCol, pEj: -vd.pEj, losses: -lossSum, lossDetail: losses }
            });
        }
        const fanSupplyPa = Math.max(0, -Math.min(...supplyRows.map((r) => r.available)));
        const fanExhaustPa = Math.max(0, -Math.min(...exhaustRows.map((r) => r.available)));

        // ---- Vermogens (§5.8)
        const etaFan = b.etaFanV * b.etaFanM;
        const PfanSupply = qV * fanSupplyPa / etaFan, PfanExhaust = qV * fanExhaustPa / etaFan;
        const qW = rwl * mDa / RHO_W;
        const head = H + b.pNozzle / (RHO_W * G) + b.pipeR * (H + 10) / (RHO_W * G) + b.dpLocal / (RHO_W * G);
        const Pspray = cas.active ? RHO_W * G * head * qW / b.etaPump : 0;
        const twOut = cas.active ? cas.tw : tWIn;
        const dTsrc = Math.max(1, Math.abs(twOut - tWIn));
        const Psource = Math.abs(cas.Q) / (CP_W * dTsrc) / RHO_W * b.dpSource / b.etaPump;
        const COP = mode === 'cool' && cas.Q < 0 ? Math.abs(cas.Q) / (Pspray + Psource) : null;
        const Qcool = mode === 'cool' && cas.Q < 0 ? -cas.Q : 0;

        const result = {
            inputs: { building: b, weather: w },
            derived: {
                H, AVO, BVO, nPers, qV, mDa, Ac, sideC, zRoof, aEj, z0: terrain.z0, d: terrain.d,
                wAir: cas.wAir, DhChimney: DhCh, Ashunt: Ash, head, qW
            },
            mode, outdoor, rad,
            ventec: { Uref: vd.Uref, qDyn: vd.qDyn, pOver: vd.pOver, pEj: vd.pEj, cpEj: vd.cpEj, Uej: vd.Uej, ratio: vd.ratio },
            cascade: {
                rwl, mW: rwl * mDa, tWIn, tWOut: cas.active ? cas.tw : null, out: casOut, Q: cas.Q, dpHydr: cas.dpHydr,
                dpAero: cas.dpAero, dpTh: dpThKc, profile: cas.profile, balanceErr: cas.balanceErr, mEvap: cas.mEvap,
                mWOut: cas.mWOut, twMin: cas.twMin, tRes: cas.tRes, active: cas.active
            },
            reheat: { Q: Qreheat, out: supply },
            supply, room,
            loads: { Qvent, Qint, Qrest: Qint - Qvent, Gmoist },
            chimney: {
                open: chimOpen, tIn: tRoom + b.dtStrat, tOut: chim.tOut, Q: chim.Q, eta: chim.eta, dpTh: chim.dpTh,
                dpThUsed: dpThCh, w: chim.w, tGlassMax: chim.tGlassMax, tWallMax: chim.tWallMax, profile: chim.profile, S: chim.S
            },
            fiwihex: { Q: Qhr, tTop, tAfter },
            pressure: { supply: supplyRows, exhaust: exhaustRows, fanSupplyPa, fanExhaustPa, pBase },
            power: {
                Pfan: PfanSupply + PfanExhaust, PfanSupply, PfanExhaust, Pspray, Psource, COP,
                ref: { PfanConv: qV * SFP_CONV, PcoolConv: Qcool / COP_CONV }
            },
            warnings
        };
        result.mollier = mollierChain(result, p);
        return result;
    }

    /**
     * Procesketen voor het h,x-diagram (SPEC §9.1) in het formaat van computeScenario/chart.setData:
     * 1 buiten → 2 uit cascade → 3 toevoer → 4 ruimte → 5 top zonneschoorsteen → 6 na FiWiHEx.
     */
    function mollierChain(r, p) {
        const states = [], steps = [];
        const add = (n, role, s, stepId) => { if (s) states.push(Object.assign({}, s, { n, role, stepId: stepId || null, mdot: r.derived.mDa })); return s; };
        const step = (id, type, kind, a, b, path) => {
            if (!a || !b) return;
            steps.push({ ok: true, step: { id, type }, kind, start: a, end: b, path, aux: [], info: {}, dt: b.t - a.t, dx: b.x - a.x, dh: b.h - a.h });
        };
        const s1 = add(1, 'outdoor', r.outdoor);
        const s2 = add(2, 'cascade', r.cascade.out, 'ewf-cascade');
        step('ewf-cascade', 'cascade', r.cascade.active ? (r.cascade.Q < 0 ? 'cool' : 'heat') : 'point', s1, s2,
            r.cascade.profile.map((q) => pathPt(q.t, q.x)));
        let last = s2;
        if (r.reheat.Q > 0) {
            const s3 = add(3, 'supply', r.supply, 'ewf-reheat');
            step('ewf-reheat', 'heat', 'heat', last, s3, [pathPt(last.t, last.x), pathPt(s3.t, s3.x)]);
            last = s3;
        }
        const s4 = add(4, 'room', r.room, 'ewf-room');
        step('ewf-room', 'load', 'load', last, s4, [pathPt(last.t, last.x), pathPt(s4.t, s4.x)]);
        last = s4;
        if (r.chimney.open && s4) {
            const s5 = add(5, 'chimney', safeState(r.chimney.tOut, s4.x, p), 'ewf-chimney');
            step('ewf-chimney', 'heat', 'heat', last, s5, [pathPt(last.t, last.x), pathPt(s5.t, s5.x)]);
            last = s5;
        }
        if (r.fiwihex.Q > 0 && last) {
            const s6 = add(6, 'fiwihex', safeState(r.fiwihex.tAfter, last.x, p), 'ewf-fiwihex');
            step('ewf-fiwihex', 'cool', 'cool', last, s6, [pathPt(last.t, last.x), pathPt(s6.t, s6.x)]);
        }
        return { states, steps };
    }

    /** Samenvatting voor de vergelijkingstabel (SPEC §8.7). */
    function summarize(id, r) {
        const minOf = (rows) => Math.min(...rows.map((q) => q.available));
        return {
            id, mode: r.mode, rwl: r.cascade.rwl, tCascadeOut: r.cascade.out ? r.cascade.out.t : null,
            rhCascadeOut: r.cascade.out ? r.cascade.out.rh : null, Qcascade: r.cascade.Q, Qreheat: r.reheat.Q,
            rhRoom: r.room ? r.room.rh : null, phiFacade: r.rad.beam + r.rad.diffuse, tChimneyOut: r.chimney.tOut,
            chimneyOpen: r.chimney.open, Qchimney: r.chimney.Q, dpChimney: r.chimney.dpTh, pOver: r.ventec.pOver,
            pEj: r.ventec.pEj, minSupply: minOf(r.pressure.supply), minExhaust: minOf(r.pressure.exhaust),
            Pfan: r.power.Pfan, Ppump: r.power.Pspray + r.power.Psource, COP: r.power.COP,
            warnings: r.warnings.filter((x) => x.level !== 'info' && x.code !== 'inputRange')
        };
    }

    /** Alle weersituaties op hetzelfde gebouw (SPEC §8.7). */
    function simulateAll(building, presets = PRESETS) {
        return presets.map((pr) => summarize(pr.id, simulate(building, presetWeather(pr))));
    }

    // =====================================================================
    // Validatie (SPEC §12.1) — gedeeld door tests, tab "Methode & bronnen" en METHODE.md
    // =====================================================================
    const REF = {
        drops: [[0.5, 2.06], [1.0, 4.03], [1.5, 5.40], [2.0, 6.49], [3.0, 8.06]],      // Gunn & Kinzer (1949)
        // Testopstelling (tab. 3.4.7): t, RV, V [m³/h], ṁ_w [kg/s], t_w,in; meting t_uit, x_uit [g/kg], t_w,uit, Δp [Pa]
        testrig: [
            { id: 'B1', t: 27.34, rh: 51.88, V: 1789, mW: 0.673, tW: 12.85, tOut: 16.85, xOut: 11.64, twOut: 15.11, dp: 5.81, tolT: 1.5 },
            { id: 'B2', t: 20.00, rh: 77.73, V: 1832, mW: 0.674, tW: 13.03, tOut: 15.21, xOut: 10.87, twOut: 14.37, dp: 6.18, tolT: 1.0 },
            { id: 'B4', t: 10.08, rh: 99.0, V: 1836, mW: 0.670, tW: 12.83, tOut: 11.60, xOut: 8.38, twOut: 12.13, dp: 7.17, tolT: 1.0 },
            { id: 'B3', t: 5.32, rh: 95.27, V: 1836, mW: 0.674, tW: 13.10, tOut: 9.54, xOut: 7.15, twOut: 11.00, dp: 8.44, tolT: 1.0 },
            { id: 'B5', t: -3.70, rh: 57.48, V: 1807, mW: 0.674, tW: 12.93, tOut: 5.78, xOut: 5.39, twOut: 8.50, dp: 9.77, tolT: 1.0 }
        ],
        // Ware grootte vs CFD (tab. 3.3.9/2): H 28 m, 40 000 m³/h, 2 m/s, p = 100 kPa
        fullscale: [
            { id: 'D1', t: 28, rh: 55, tW: 13, rwl: 1.17, cfd: 16.5 },
            { id: 'D3', t: 5, rh: 90, tW: 13, rwl: 1.07, cfd: 12.0 },
            { id: 'D4', t: -10, rh: 90, tW: 15, rwl: 1.00, cfd: 6.5 }
        ],
        // Ventecdak tab. 2.5.3: U10 = 3,5 m/s, U_ej = 1 m/s, c = 2 m, ρ = 1,229
        ventec: [
            [15, 2.20, -0.64, 2.37], [20, 2.86, -1.46, 4.01], [25, 3.25, -2.12, 5.18], [30, 3.52, -2.68, 6.09],
            [35, 3.74, -3.16, 6.85], [40, 3.91, -3.58, 7.50], [45, 4.06, -3.97, 8.07], [50, 4.19, -4.32, 8.59]
        ]
    };

    /** Kolom met uniforme temperatuur volgens de vereenvoudiging van het proefschrift: ρ = ρ0·T0/T. */
    const thesisColumn = (H, t) => {
        const rho = 1.293 * 273 / (273 + t);
        return [{ z: H, rho }, { z: 0, rho }];
    };
    const thesisRho = (t) => 1.293 * 273 / (273 + t);

    /** Thermische trek volgens §3.5.5.4/5 met de generieke integratie (10 verdiepingen à 3,5 m). */
    function thesisDraft() {
        const H = 35;
        const summerFoot = PH.stackDraft(thesisColumn(H, 22.5), thesisRho(28));
        const winterFoot = PH.stackDraft(thesisColumn(H, -1.75), thesisRho(-10));
        // Proefschrift: toevoerschacht (18 °C) gerekend t.o.v. de cascadekolom (−1,75 °C)
        const winterTopThesis = winterFoot - PH.stackDraft(thesisColumn(H, 18), thesisRho(-1.75));
        // SPEC §5.4 (neutrale zone): schacht t.o.v. de buitenlucht (−10 °C)
        const winterTopGeneric = winterFoot - PH.stackDraft(thesisColumn(H, 18), thesisRho(-10));
        return { summerFoot, winterFoot, winterTopThesis, winterTopGeneric };
    }

    /** Testopstelling (H 5,5 m, A 1 m²) of ware grootte doorrekenen. */
    function rigCase(c) {
        const p = P_STD, x = P.xFromTRh(c.t, c.rh, p);
        const mDa = c.V / 3600 * PH.rhoMoist(c.t, x, p) / (1 + x);
        const r = PH.cascade({ H: 5.5, Ac: 1, mDa, tIn: c.t, xIn: x, mW: c.mW, tWIn: c.tW, d30: 1.048e-3, d32: 1.317e-3, p });
        // Meetreferentie drukopbouw: laboratoriumhal ≈ 20 °C, 8 g/kg
        const dp = r.dpHydr + PH.stackDraft(r.profile, PH.rhoMoist(20, 0.008, p));
        return { r, mDa, dp };
    }
    function fullCase(c) {
        const p = 100e3, x = P.xFromTRh(c.t, c.rh, p);
        const mDa = 40000 / 3600 * PH.rhoMoist(c.t, x, p) / (1 + x);
        return PH.cascade({ H: 28, Ac: 40000 / 3600 / 2, mDa, tIn: c.t, xIn: x, mW: c.rwl * mDa, tWIn: c.tW, d30: 1.048e-3, d32: 1.317e-3, p });
    }
    const chimRef = (floors) => PH.chimney({ H: floors * 3.5, B: 3.6, D: 0.65, q: 3.6 * 0.65 * 1.5, tIn: 21, tE: 20, xE: 0.008, phiBeam: 0, phiDiff: 400, angleCorr: false });

    /**
     * Validatietabel: rijen { group, id, qty, value, ref, tol, unit, ok, note }.
     * tol is een getal (±), een [min, max]-interval (ref = null) of { rel, abs }.
     */
    function runValidation() {
        const rows = [];
        const row = (group, id, qty, value, ref, tol, unit, note) => {
            let ok;
            if (Array.isArray(tol)) ok = value >= tol[0] && value <= tol[1];
            else if (typeof tol === 'object') ok = Math.abs(value - ref) <= Math.max(tol.abs, tol.rel * Math.abs(ref));
            else ok = Math.abs(value - ref) <= tol;
            rows.push({ group, id, qty, value, ref, tol, unit, ok, note: note || '' });
        };
        for (const [d, gk] of REF.drops) row('drops', `${d} mm`, 'w_t', PH.dropTerminal(d * 1e-3), gk, { rel: 0.10, abs: 0 }, 'm/s');
        for (const c of REF.testrig) {
            const { r, dp } = rigCase(c);
            row('testrig', c.id, 't_uit', r.t, c.tOut, c.tolT, '°C');
            row('testrig', c.id, 't_w,uit', r.tw, c.twOut, 0.5, '°C');
            row('testrig', c.id, 'x_uit', r.x * 1000, c.xOut, 1.0, 'g/kg');
            row('testrig', c.id, 'Δp', dp, c.dp, 1.5, 'Pa');
            row('testrig', c.id, 'balans', Math.abs(r.balanceErr) * 100, 0, 0.1, '%');
        }
        for (const c of REF.fullscale) row('fullscale', c.id, 't_uit', fullCase(c).t, c.cfd, 2.0, '°C');
        for (const [z, U, pn, pp] of REF.ventec) {
            const Ur = PH.windAtHeight(3.5, z), qd = 0.5 * 1.229 * Ur * Ur;
            row('ventec', `z = ${z} m`, 'U_ref', Ur, U, 0.03, 'm/s');
            row('ventec', `z = ${z} m`, 'p_ej', PH.cpEjector(1, Ur, 2).cp * qd, pn, { rel: 0.03, abs: 0.05 }, 'Pa');
            row('ventec', `z = ${z} m`, 'p_over', 0.8 * qd, pp, { rel: 0.03, abs: 0.05 }, 'Pa');
        }
        const dr = thesisDraft();
        row('draft', 'zomer voet', 'Δp_th', dr.summerFoot, 7.5, 0.2, 'Pa');
        row('draft', 'winter voet', 'Δp_th', dr.winterFoot, -14.0, 0.2, 'Pa');
        row('draft', 'winter top', 'P_top', dr.winterTopThesis, 16.3, 0.2, 'Pa', 'thesisConvention');
        for (const fl of [4, 6, 8, 10, 14]) {
            const r = chimRef(fl);
            row('chimney', `${fl} verd.`, 'η', r.eta, null, [0.60, 0.68], '–');
            row('chimney', `${fl} verd.`, 'ΔT/verd.', (r.tOut - 21) / fl, null, [0.66, 0.80], 'K');
        }
        const ex = PH.chimney({ H: 49, B: 3.6, D: 0.65, q: 3.6 * 0.65 * 1.5, tIn: 24, tE: 32, xE: 0.010, phiBeam: 0, phiDiff: 840, g: 0.75, U: 1.10, angleCorr: false });
        row('chimney', 'extreem', 't_glas,max', ex.tGlassMax, 60, 3, '°C');
        row('chimney', 'extreem', 't_wand,max', ex.tWallMax, 73, 4, '°C');
        const rig = PH.chimney({ H: 11, B: 2.0, D: 0.25, q: 0.5, tIn: 20.92, tE: 0.55, xE: 0.003, phiBeam: 0, phiDiff: 730, U: 1.58, R: 0.83, Uwall: 0.235, angleCorr: false });
        row('chimney', '15-12-2009', 't_uit', rig.tOut, 32.1, 2.5, '°C');
        return rows;
    }

    return {
        LAT, LON, BBL_PER_PERSON, SFP_CONV, COP_CONV,
        SPRAY, GLASS, TERRAIN, VENT_CATS, FIELDS, FIELD, DEFAULTS, WEATHER_FIELDS, WFIELD,
        PRESETS, PRESET, SEASON_DATE, REF,
        solarNoonISO, presetWeather, normalizeBuilding, normalizeWeather, facadeRadiation, ventilationFlow,
        simulate, simulateAll, summarize, mollierChain, runValidation, thesisDraft, rigCase, fullCase
    };
});
