/**
 * psychro.js — rekenkern vochtige lucht (SI)
 *
 * Basis: ASHRAE Handbook – Fundamentals 2017, hoofdstuk 1
 *   - verzadigingsdampdruk: Hyland & Wexler, boven water én boven ijs (eq. 5 en 6)
 *   - dauwpunt: Newton-Raphson op ln(p_ws) (zoals PsychroLib)
 *   - natteboltemperatuur: eq. 33 / 35, opgelost met bisectie
 * Uitbreiding: mistgebied (x > x_s) met vloeibaar water (t ≥ 0,01 °C) of ijsnevel.
 *
 * Eenheden: t [°C], p [Pa], x [kg/kg droge lucht], h [kJ/kg droge lucht],
 *           RH [%], v [m³/kg droge lucht], ρ [kg/m³ vochtige lucht].
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Psychro = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ---- Constanten ----
    const RA = 0.621945;        // M_water / M_droge lucht
    const R_DA = 287.042;       // gasconstante droge lucht J/(kg·K)
    const CP_DA = 1.006;        // kJ/(kg·K) droge lucht
    const CP_V = 1.86;          // kJ/(kg·K) waterdamp
    const R0 = 2501;            // kJ/kg verdampingswarmte bij 0 °C
    const CP_W = 4.186;         // kJ/(kg·K) water
    const CP_ICE = 2.09;        // kJ/(kg·K) ijs
    const H_FUS = 333.4;        // kJ/kg smeltwarmte
    const T_TRIPLE = 0.01;      // °C
    const T_LO = -100, T_HI = 200;
    const P_STD = 101325;       // Pa

    /** Fout met code, zodat de UI een vertaalde melding kan tonen. */
    class PsychroError extends Error {
        constructor(code, data) {
            super(code);
            this.name = 'PsychroError';
            this.code = code;
            this.data = data || {};
        }
    }

    const clampT = (t) => Math.min(T_HI, Math.max(T_LO, t));

    // ---- Druk ----
    /** Barometrische druk uit hoogte (ASHRAE eq. 3). z [m] → Pa */
    function pressureFromAltitude(z) {
        return P_STD * Math.pow(1 - 2.25577e-5 * z, 5.2559);
    }
    /** Inverse van eq. 3. p [Pa] → z [m] */
    function altitudeFromPressure(p) {
        return (1 - Math.pow(p / P_STD, 1 / 5.2559)) / 2.25577e-5;
    }

    // ---- Verzadiging ----
    /** Verzadigingsdampdruk p_ws(t) [Pa]; boven ijs voor t ≤ 0,01 °C. */
    function satVapPres(t) {
        t = clampT(t);
        const T = t + 273.15;
        let ln;
        if (t <= T_TRIPLE) {
            ln = -5.6745359e3 / T + 6.3925247 - 9.677843e-3 * T + 6.2215701e-7 * T * T
                + 2.0747825e-9 * T * T * T - 9.484024e-13 * T * T * T * T + 4.1635019 * Math.log(T);
        } else {
            ln = -5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T * T
                - 1.4452093e-8 * T * T * T + 6.5459673 * Math.log(T);
        }
        return Math.exp(ln);
    }

    /** Verzadigingsdampdruk boven (onderkoeld) vloeibaar water, ook onder 0 °C (Hyland-Wexler eq. 6) [Pa]. */
    function satVapPresLiquid(t) {
        const T = clampT(t) + 273.15;
        return Math.exp(-5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T * T
            - 1.4452093e-8 * T * T * T + 6.5459673 * Math.log(T));
    }

    /** d(ln p_ws)/dt, analytisch — voor Newton-Raphson. */
    function dLnPws(t) {
        const T = clampT(t) + 273.15;
        if (t <= T_TRIPLE) {
            return 5.6745359e3 / (T * T) - 9.677843e-3 + 2 * 6.2215701e-7 * T
                + 3 * 2.0747825e-9 * T * T - 4 * 9.484024e-13 * T * T * T + 4.1635019 / T;
        }
        return 5.8002206e3 / (T * T) - 4.8640239e-2 + 2 * 4.1764768e-5 * T
            - 3 * 1.4452093e-8 * T * T + 6.5459673 / T;
    }

    /**
     * Temperatuur waarbij p_ws(t) = pw — oftewel het dauwpunt (rijppunt onder 0 °C).
     * Newton-Raphson op ln(p_ws); convergeert in 3–5 stappen.
     */
    function tFromSatPres(pw) {
        if (!(pw > 0)) throw new PsychroError('ERR_VAPOUR_PRESSURE');
        if (pw < satVapPres(T_LO) || pw > satVapPres(T_HI)) throw new PsychroError('ERR_OUT_OF_RANGE');
        const lnPw = Math.log(pw);
        // Startwaarde via Magnus-benadering
        const a = Math.log(pw / 611.2);
        let t = 243.12 * a / (17.62 - a);
        for (let i = 0; i < 50; i++) {
            const tNew = clampT(t - (Math.log(satVapPres(t)) - lnPw) / dLnPws(t));
            if (Math.abs(tNew - t) < 1e-9) return tNew;
            t = tNew;
        }
        return t;
    }

    /** Vochtgehalte uit dampspanning. */
    const xFromPw = (pw, p) => RA * pw / (p - pw);
    /** Dampspanning uit vochtgehalte. */
    const pwFromX = (x, p) => p * x / (RA + x);

    /** Verzadigd vochtgehalte x_s(t) [kg/kg]; Infinity wanneer p_ws ≥ p (kookgebied). */
    function satHumRatio(t, p) {
        const pws = satVapPres(t);
        return pws >= p ? Infinity : xFromPw(pws, p);
    }

    /** x uit t en RH [%] (snel, zonder volledige toestand). */
    function xFromTRh(t, rh, p) {
        const pw = rh / 100 * satVapPres(t);
        return pw >= p ? Infinity : xFromPw(pw, p);
    }

    // ---- Enthalpie ----
    /** h van onverzadigde lucht [kJ/kg]. */
    const enthalpy = (t, x) => CP_DA * t + x * (R0 + CP_V * t);
    /** t uit h en x voor onverzadigde lucht. */
    const tFromHx = (h, x) => (h - R0 * x) / (CP_DA + CP_V * x);
    /** Enthalpie van vloeibaar water (t ≥ 0,01) of ijs [kJ/kg]. */
    const hCondensed = (t) => (t >= T_TRIPLE ? CP_W * t : -H_FUS + CP_ICE * t);
    /** Enthalpie verzadigde lucht. */
    function hSat(t, p) {
        return enthalpy(t, satHumRatio(t, p));
    }
    /** Enthalpie in het mistgebied: damp tot x_s, rest als water/ijs. */
    function hFog(t, x, p) {
        const xs = satHumRatio(t, p);
        if (x <= xs) return enthalpy(t, x);
        return enthalpy(t, xs) + (x - xs) * hCondensed(t);
    }

    // ---- Natteboltemperatuur ----
    /** x uit t en natteboltemperatuur (ASHRAE eq. 33 / 35). */
    function xFromTwb(t, twb, p) {
        const ws = satHumRatio(twb, p);
        if (twb >= 0) {
            return ((2501 - 2.326 * twb) * ws - 1.006 * (t - twb)) / (2501 + 1.86 * t - 4.186 * twb);
        }
        return ((2830 - 0.24 * twb) * ws - 1.006 * (t - twb)) / (2830 + 1.86 * t - 2.1 * twb);
    }

    /** Natteboltemperatuur via bisectie tussen dauwpunt en droge bol. */
    function wetBulb(t, x, p) {
        const xb = Math.max(x, 1e-7);
        let lo = tFromSatPres(pwFromX(xb, p));
        let hi = t;
        if (lo >= hi) return t;
        for (let i = 0; i < 60 && hi - lo > 1e-6; i++) {
            const mid = (lo + hi) / 2;
            if (xFromTwb(t, mid, p) > xb) hi = mid; else lo = mid;
        }
        return (lo + hi) / 2;
    }

    // ---- Volume / dichtheid ----
    /** Specifiek volume per kg droge lucht (ASHRAE eq. 26). */
    const specificVolume = (t, xv, p) => R_DA * (t + 273.15) * (1 + 1.607858 * xv) / p;

    // ---- Volledige toestand ----
    /**
     * Volledige luchttoestand uit t en totaal watergehalte x.
     * Is x groter dan x_s(t), dan ligt het punt in het mistgebied.
     */
    function state(t, x, p) {
        if (!isFinite(t) || !isFinite(x)) throw new PsychroError('ERR_INVALID');
        if (t < T_LO || t > T_HI) throw new PsychroError('ERR_T_RANGE', { t });
        if (x < -1e-12) throw new PsychroError('ERR_X_NEGATIVE');
        x = Math.max(0, x);
        const pws = satVapPres(t);
        const xs = pws >= p ? Infinity : xFromPw(pws, p);
        const fog = x > xs * (1 + 1e-9);
        const xv = fog ? xs : x;                 // dampgehalte
        const pw = pwFromX(xv, p);
        const h = fog ? hFog(t, x, p) : enthalpy(t, x);
        const v = specificVolume(t, xv, p);
        const tdp = xv > 0 ? Math.min(t, tFromSatPres(Math.max(pw, satVapPres(T_LO)))) : -Infinity;
        return {
            t, x, h, p,
            rh: Math.min(100, pw / pws * 100),
            twb: fog ? t : (xv > 0 ? wetBulb(t, xv, p) : wetBulb(t, 1e-7, p)),
            tdp,
            pw, pws, xs,
            xl: fog ? x - xs : 0,                // mist: vloeibaar water / ijs [kg/kg]
            fog,
            v,
            rho: (1 + x) / v,
            mu: isFinite(xs) ? x / xs : 0,        // verzadigingsgraad
            cp: CP_DA + CP_V * xv                 // soortelijke warmte vochtige lucht
        };
    }

    /** Toestand uit h en x — ook correct in het mistgebied. */
    function fromHx(h, x, p) {
        if (!isFinite(h) || !isFinite(x)) throw new PsychroError('ERR_INVALID');
        if (x < 0) throw new PsychroError('ERR_X_NEGATIVE');
        const tU = tFromHx(h, x);
        if (tU < T_LO || tU > T_HI) throw new PsychroError('ERR_T_RANGE', { t: tU });
        if (x <= satHumRatio(tU, p)) return state(tU, x, p);
        // Mist: zoek t met hFog(t, x) = h, t ∈ [tU, dauwpunt(x)]
        let lo = tU, hi = tFromSatPres(pwFromX(x, p));
        for (let i = 0; i < 80 && hi - lo > 1e-9; i++) {
            const mid = (lo + hi) / 2;
            if (hFog(mid, x, p) > h) hi = mid; else lo = mid;
        }
        return state((lo + hi) / 2, x, p);
    }

    /** Generieke bisectie: zoek z in [lo, hi] met f(z) = target (f monotoon). */
    function solve(f, lo, hi, target, iter = 100, tol = 1e-10) {
        let flo = f(lo) - target;
        const fhi = f(hi) - target;
        if (flo === 0) return lo;
        if (fhi === 0) return hi;
        if (flo * fhi > 0) return NaN;
        for (let i = 0; i < iter && hi - lo > tol; i++) {
            const mid = (lo + hi) / 2;
            const fm = f(mid) - target;
            if (fm === 0) return mid;
            if (fm * flo < 0) hi = mid; else { lo = mid; flo = fm; }
        }
        return (lo + hi) / 2;
    }

    // ---- Toestand uit willekeurig invoerpaar ----
    /** Beschikbare invoerparen; x in kg/kg, RH in %. */
    const PAIRS = ['t-rh', 't-x', 't-twb', 't-tdp', 't-h', 'h-x', 'x-rh', 'h-rh', 'twb-rh'];

    function checkRh(rh) {
        if (!(rh > 0 && rh <= 100)) throw new PsychroError('ERR_RH_RANGE');
    }

    function fromPair(pair, a, b, p) {
        if (!isFinite(a) || !isFinite(b)) throw new PsychroError('ERR_INVALID');
        switch (pair) {
            case 't-rh': {
                checkRh(b);
                const x = xFromTRh(a, b, p);
                if (!isFinite(x)) throw new PsychroError('ERR_BOILING');
                return state(a, x, p);
            }
            case 't-x':
                return state(a, b, p);
            case 't-twb': {
                if (b > a) throw new PsychroError('ERR_TWB_ABOVE_T');
                const x = xFromTwb(a, b, p);
                if (x < 0) throw new PsychroError('ERR_TWB_TOO_LOW');
                return state(a, x, p);
            }
            case 't-tdp': {
                if (b > a) throw new PsychroError('ERR_TDP_ABOVE_T');
                return state(a, xFromPw(satVapPres(b), p), p);
            }
            case 't-h': {
                const x = (b - CP_DA * a) / (R0 + CP_V * a);
                if (x < 0) throw new PsychroError('ERR_H_TOO_LOW');
                const xs = satHumRatio(a, p);
                if (x <= xs) return state(a, x, p);
                // Mist bij deze temperatuur: extra enthalpie zit in vloeibaar water
                const hl = hCondensed(a);
                if (hl <= 0.5) throw new PsychroError('ERR_SUPERSAT');
                return state(a, xs + (b - hSat(a, p)) / hl, p);
            }
            case 'h-x':
                return fromHx(a, b, p);
            case 'x-rh': {
                checkRh(b);
                if (a <= 0) throw new PsychroError('ERR_X_POSITIVE');
                const t = tFromSatPres(pwFromX(a, p) / (b / 100));
                return state(t, a, p);
            }
            case 'h-rh': {
                checkRh(b);
                // Bovengrens: dampspanning blijft onder 95 % van de luchtdruk
                const tMax = tFromSatPres(Math.min(0.95 * p * 100 / b, satVapPres(T_HI)));
                const f = (t) => enthalpy(t, xFromTRh(t, b, p));
                const t = solve(f, T_LO, tMax, a);
                if (!isFinite(t)) throw new PsychroError('ERR_NO_SOLUTION');
                return state(t, xFromTRh(t, b, p), p);
            }
            case 'twb-rh': {
                checkRh(b);
                if (b >= 100) return state(a, satHumRatio(a, p), p);
                const f = (t) => {
                    const x = xFromTwb(t, a, p);
                    return x <= 0 ? -1 : pwFromX(x, p) / satVapPres(t) * 100;
                };
                // RH daalt monotoon met t langs een natteboltemperatuurlijn
                const t = solve((tt) => -f(tt), a, Math.min(T_HI, a + 150), -b);
                if (!isFinite(t)) throw new PsychroError('ERR_NO_SOLUTION');
                return state(t, xFromTwb(t, a, p), p);
            }
            default:
                throw new PsychroError('ERR_UNKNOWN_PAIR');
        }
    }

    /** Waarden van een invoerpaar voor een gegeven toestand (voor slepen/omzetten). */
    function pairValues(pair, s) {
        const pick = { t: s.t, rh: s.rh, x: s.x, h: s.h, twb: s.twb, tdp: s.tdp };
        const [qa, qb] = pair.split('-');
        return [pick[qa], pick[qb]];
    }

    return {
        RA, R_DA, CP_DA, CP_V, R0, CP_W, CP_ICE, H_FUS, T_TRIPLE, T_LO, T_HI, P_STD,
        PsychroError, PAIRS,
        pressureFromAltitude, altitudeFromPressure,
        satVapPres, satVapPresLiquid, tFromSatPres, satHumRatio, xFromTRh, xFromPw, pwFromX,
        enthalpy, tFromHx, hCondensed, hSat, hFog,
        xFromTwb, wetBulb, specificVolume,
        state, fromHx, fromPair, pairValues, solve
    };
});
