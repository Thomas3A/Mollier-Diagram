/**
 * solar.js — zonnestand en zonnestraling op een (verticaal) vlak
 *
 *  - zonnestand: NOAA "General Solar Position Calculations" (Spencer-reeksen)
 *  - splitsing GHI → DNI/DHI: Erbs, Klein & Duffie (1982)
 *  - transpositie: Hay & Davies (1980), Duffie & Beckman (2013) §2.16
 *  - invalshoekcorrectie g-waarde: Bronsema fig. 4.2.2 (zie EwfPhysics.gAngleFactor)
 *
 * Conventie azimut: 0 = zuid, −90 = oost, +90 = west, ±180 = noord (gelijk aan Open-Meteo).
 * Hoeken in graden, straling in W/m², tijd in UTC. Geen DOM.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'));
    else root.EwfSolar = factory(root.EwfPhysics);
})(typeof self !== 'undefined' ? self : this, function (PH) {
    'use strict';

    const RAD = Math.PI / 180;
    const SOLAR_CONST = 1367;    // W/m²

    /** Dag van het jaar (1–366) en UTC-uur uit een Date of ISO-tekst. */
    function dayAndHour(date) {
        const d = date instanceof Date ? date : new Date(date);
        const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
        const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - y0) / 86400000) + 1;
        const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
        return { doy, hour };
    }

    /** Tijdsvereffening [min] en declinatie [rad] (Spencer, via NOAA). */
    function orbit(doy, utcHours) {
        const gam = 2 * Math.PI / 365 * (doy - 1 + (utcHours - 12) / 24);
        const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam)
            - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
        const dec = 0.006918 - 0.399912 * Math.cos(gam) + 0.070257 * Math.sin(gam) - 0.006758 * Math.cos(2 * gam)
            + 0.000907 * Math.sin(2 * gam) - 0.002697 * Math.cos(3 * gam) + 0.00148 * Math.sin(3 * gam);
        return { eqt, dec };
    }

    /** Zonnestand voor dag doy en UTC-uur: { alt, az (0 = zuid, + = west), doy, dec, eqt }. */
    function sunPositionDoy(lat, lon, utcHours, doy) {
        const { eqt, dec } = orbit(doy, utcHours);
        const tst = utcHours * 60 + eqt + 4 * lon;                 // ware zonnetijd [min]
        const ha = (tst / 4 - 180) * RAD;                          // uurhoek
        const la = lat * RAD;
        const cz = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha);
        const zen = Math.acos(Math.max(-1, Math.min(1, cz)));
        const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la));
        return { alt: 90 - zen / RAD, az: az / RAD, doy, dec: dec / RAD, eqt };
    }

    /** Zonnestand op een tijdstip (Date of ISO, UTC). */
    function sunPosition(date, lat, lon) {
        const { doy, hour } = dayAndHour(date);
        return Object.assign(sunPositionDoy(lat, lon, hour, doy), { hour });
    }

    /** UTC-uur van de ware middag (uurhoek 0) op dag doy. */
    function solarNoonUTC(doy, lon) {
        let h = 12 - lon / 15;
        for (let i = 0; i < 3; i++) h = (720 - orbit(doy, h).eqt - 4 * lon) / 60;
        return h;
    }

    /** Extraterrestrische straling loodrecht op de zonnestraal [W/m²]. */
    const extraterrestrial = (doy) => SOLAR_CONST * (1 + 0.033 * Math.cos(2 * Math.PI * doy / 365));

    /** Diffuse fractie k_d = DHI/GHI uit de helderheidsindex k_t (Erbs et al. 1982). */
    function erbs(kt) {
        if (kt <= 0.22) return 1 - 0.09 * kt;
        if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * kt * kt * kt + 12.336 * kt * kt * kt * kt;
        return 0.165;
    }

    /** cos(invalshoek) op een vlak met helling tilt en azimut surfAz. */
    function cosIncidence(alt, az, surfAz, tilt) {
        const b = tilt * RAD;
        return Math.cos(alt * RAD) * Math.cos((az - surfAz) * RAD) * Math.sin(b) + Math.sin(alt * RAD) * Math.cos(b);
    }

    /**
     * Straling op een vlak. Ontbreken dni/dhi, dan splitsing met Erbs (k_t ≤ 0,8);
     * transpositie met Hay & Davies. Circumsolair telt als direct (krijgt de invalshoekcorrectie).
     * Onder α < 5° is de splitsing onbetrouwbaar: alles isotroop diffuus.
     * → { beam, diffuse, theta [°], dni, dhi, kt }
     */
    function onSurface({ ghi, dni, dhi, alt, az, doy, surfAz = 0, tilt = 90, albedo = 0.2 }) {
        const b = tilt * RAD;
        const haveSplit = isFinite(dni) && isFinite(dhi);
        if (!isFinite(ghi)) ghi = haveSplit ? dhi + dni * Math.max(0, Math.sin(alt * RAD)) : 0;
        if (!(ghi > 0)) return { beam: 0, diffuse: 0, theta: 90, dni: 0, dhi: 0, kt: null };
        if (alt < 5) {
            const diffuse = ghi * (0.5 * (1 + Math.cos(b)) + albedo * 0.5 * (1 - Math.cos(b)));
            return { beam: 0, diffuse, theta: 90, dni: 0, dhi: ghi, kt: null };
        }
        const G0 = extraterrestrial(doy);
        const cz = Math.sin(alt * RAD);
        let kt = null;
        if (!haveSplit) {
            kt = Math.min(ghi / (G0 * cz), 0.8);
            dhi = erbs(kt) * ghi;
            dni = (ghi - dhi) / cz;
        }
        const cosTh = Math.max(0, cosIncidence(alt, az, surfAz, tilt));
        const Ai = dni / G0;                                        // anisotropie-index
        const circ = dhi * Ai * cosTh / cz;
        const iso = dhi * (1 - Ai) * (1 + Math.cos(b)) / 2;
        const grd = ghi * albedo * (1 - Math.cos(b)) / 2;
        return { beam: dni * cosTh + circ, diffuse: iso + grd, theta: Math.acos(Math.min(1, cosTh)) / RAD, dni, dhi, kt };
    }

    return {
        SOLAR_CONST, dayAndHour, sunPosition, sunPositionDoy, solarNoonUTC, extraterrestrial, erbs,
        cosIncidence, onSurface, gAngleFactor: PH.gAngleFactor
    };
});
