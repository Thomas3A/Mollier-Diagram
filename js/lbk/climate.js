/**
 * climate.js — klimaatjaren voor de energieberekening van de LBK (KNMI De Bilt)
 *
 * Vijf referentiejaren (reconstructie NEN 5060:2018 + twee stresstestwinters) met T en RV per uur,
 * en de werkelijke jaren 1951–2025 (alleen T). De data staan in data/klimaat/*.js en worden pas geladen
 * als ze nodig zijn: in de browser via een <script>-tag (werkt ook vanaf file://), in Node via require().
 *
 * get(id, p) → { T [°C], x [kg/kg], startWeekday (1 = maandag), approxX, meta } met 8760 uurwaarden.
 * Werkelijke jaren: x = min(x van het energiejaar op hetzelfde uur, x_s(T)) — zie docs/klimaat/README.md.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('../psychro.js'), true);
    else root.LbkClimate = factory(root.Psychro, false);
})(typeof self !== 'undefined' ? self : this, function (P, isNode) {
    'use strict';

    const N = 8760;
    const REF = ['energie', 'T5', 'T1', 'winter1979', 'winter1963'];
    const DEFAULT = 'energie';
    const YEAR_MIN = 1951, YEAR_MAX = 2025;
    const RECOMMENDED = [1956, 1963, 1979, 1985, 1986, 1987, 1996, 1997, 2010, 2012];
    const FILES = { referentiejaren: 'data/klimaat/referentiejaren.js', knmi: 'data/klimaat/knmi-debilt-1951-2025.js' };
    const NODE_FILES = { referentiejaren: '../../data/klimaat/referentiejaren.js', knmi: '../../data/klimaat/knmi-debilt-1951-2025.js' };
    const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const raw = {};            // ruwe datasets per soort
    const loading = {};        // lopende laadacties (Promise)
    const series = new Map();  // berekende reeksen per id + druk

    const years = () => { const out = []; for (let y = YEAR_MIN; y <= YEAR_MAX; y++) out.push(y); return out; };
    const isYear = (id) => /^y\d{4}$/.test(id) && +id.slice(1) >= YEAR_MIN && +id.slice(1) <= YEAR_MAX;
    const isValid = (id) => REF.includes(id) || isYear(id);
    const kindOf = (id) => (isYear(id) ? 'knmi' : 'referentiejaren');

    /** Laad een dataset (één keer); bij een mislukte poging mag opnieuw worden geprobeerd. */
    function load(kind) {
        if (raw[kind]) return Promise.resolve(raw[kind]);
        if (isNode) { raw[kind] = require(NODE_FILES[kind]); return Promise.resolve(raw[kind]); }
        const g = typeof self !== 'undefined' ? self : globalThis;
        if (g.KlimaatData && g.KlimaatData[kind]) { raw[kind] = g.KlimaatData[kind]; return Promise.resolve(raw[kind]); }
        if (!loading[kind]) {
            loading[kind] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = FILES[kind];
                s.async = true;
                s.onload = () => {
                    const d = g.KlimaatData && g.KlimaatData[kind];
                    if (d) { raw[kind] = d; resolve(d); } else { delete loading[kind]; reject(new Error('KLIMAAT_DATA')); }
                };
                s.onerror = () => { delete loading[kind]; s.remove(); reject(new Error('KLIMAAT_LOAD')); };
                document.head.appendChild(s);
            });
        }
        return loading[kind];
    }

    const loaded = (id) => !!raw[kindOf(id)] && (kindOf(id) !== 'knmi' || !!raw.referentiejaren);

    /** Metadata (synchroon, alleen als de dataset al geladen is). */
    function meta(id) {
        if (REF.includes(id)) {
            const m = raw.referentiejaren && raw.referentiejaren.meta.jaren[id];
            return m ? { omschrijving: m.omschrijving, statistiek: m.statistiek, startWeekday: raw.referentiejaren.meta.startWeekdag || 1 } : null;
        }
        if (isYear(id) && raw.knmi) {
            const y = id.slice(1);
            return { statistiek: raw.knmi.meta.statistiek[y] || null, startWeekday: raw.knmi.meta.startWeekdag[y] || 1, recommended: recommended().includes(+y) };
        }
        return null;
    }
    const recommended = () => (raw.knmi && raw.knmi.meta.aanbevolen_stresstest) || RECOMMENDED;

    /** Uurreeksen voor een klimaatjaar bij luchtdruk p [Pa]. */
    async function get(id, p) {
        if (!isValid(id)) throw new Error('KLIMAAT_ID');
        await load('referentiejaren');
        if (isYear(id)) await load('knmi');
        return getSync(id, p);
    }

    /** Als get(), maar zonder laden (de data moeten er al zijn). */
    function getSync(id, p) {
        const key = `${id}@${Math.round(p)}`;
        if (series.has(key)) return series.get(key);
        const ref = raw.referentiejaren;
        if (!ref || (isYear(id) && !raw.knmi)) throw new Error('KLIMAAT_NOT_LOADED');
        const T = new Float64Array(N), x = new Float64Array(N);
        let startWeekday = 1, approxX = false;
        if (REF.includes(id)) {
            const d = ref.data[id];
            for (let i = 0; i < N; i++) {
                T[i] = d.T[i] / 10;
                x[i] = P.xFromTRh(T[i], Math.min(100, Math.max(1, d.U[i])), p);
            }
            startWeekday = ref.meta.startWeekdag || 1;
        } else {
            const y = id.slice(1), d = raw.knmi.T[y], e = ref.data.energie;
            for (let i = 0; i < N; i++) {
                T[i] = d[i] / 10;
                const xe = P.xFromTRh(e.T[i] / 10, Math.min(100, Math.max(1, e.U[i])), p);
                x[i] = Math.min(xe, P.satHumRatio(T[i], p));
            }
            startWeekday = raw.knmi.meta.startWeekdag[y] || 1;
            approxX = true;
        }
        const out = { id, T, x, startWeekday, approxX, meta: meta(id) };
        series.set(key, out);
        return out;
    }

    /** Maandindex (0–11) per uur van een jaar van 365 dagen. */
    const monthOfHour = (() => {
        const m = new Uint8Array(N);
        let h = 0;
        DAYS.forEach((d, i) => { for (let k = 0; k < d * 24; k++) m[h++] = i; });
        return m;
    })();

    return {
        N, REF, DEFAULT, DAYS, YEAR_MIN, YEAR_MAX, RECOMMENDED,
        years, isYear, isValid, kindOf, load, loaded, meta, recommended, get, getSync, monthOfHour
    };
});
