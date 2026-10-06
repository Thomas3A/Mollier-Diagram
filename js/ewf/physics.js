/**
 * physics.js — Earth, Wind & Fire: fysica van Ventecdak, klimaatcascade en zonneschoorsteen
 *
 * Bron: B. Bronsema (2013), Earth, Wind & Fire – Natuurlijke Airconditioning, proefschrift TU Delft.
 * Formulenummers (bijv. 3.2.15/6) en paragrafen (§4.5.11) verwijzen daarnaar.
 * Referentie-implementatie: docs/ewf/ewf_prototype.py (testorakel). Afwijkingen van het
 * proefschrift staan in docs/ewf/SPEC.md §5.10 en docs/ewf/METHODE.md.
 *
 * Eenheden (SI): t [°C], p [Pa], x [kg/kg droge lucht], h [J/kg droge lucht], ṁ [kg/s],
 *                q [m³/s], Q [W], d [m], z [m]. Geen DOM, geen globale toestand.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('../psychro.js'));
    else root.EwfPhysics = factory(root.Psychro);
})(typeof self !== 'undefined' ? self : this, function (P) {
    'use strict';

    // ---- Constanten (SPEC §5.3) ----
    const G = 9.81;              // m/s²
    const P_STD = 101325;        // Pa
    const RHO_W = 999;           // kg/m³ water
    const CP_W = 4186;           // J/(kg·K) water
    const CP_DA = 1006;          // J/(kg·K) droge lucht
    const CP_V = 1860;           // J/(kg·K) waterdamp
    const R_DA = 287.042;        // J/(kg·K)
    const R_V = 461.5;           // J/(kg·K)
    const SIGMA = 5.67e-8;       // W/(m²·K⁴)
    const RHO_REF = 1.20;        // kg/m³ — referentiedichtheid ventilatiedebiet (≈ 20 °C)
    const EPS_GLASS = 0.87;      // emissiecoëfficiënt glas (4.2.5/4–7)

    const warn = (code, level, vars) => ({ code, level, vars: vars || {} });

    // ---- Psychrometrie (ASHRAE 2017, via psychro.js) ----
    /** Enthalpie vochtige lucht [J/kg droge lucht]. */
    const hAir = (t, x) => CP_DA * t + x * (2501e3 + CP_V * t);
    /** Dichtheid vochtige lucht [kg/m³] (ASHRAE eq. 11/28). */
    const rhoMoist = (t, x, p) => p / (R_DA * (t + 273.15) * (1 + 1.607858 * x)) * (1 + x);
    /** Verdampingswarmte [J/kg] ≈ h_g(t) − h_f(t). */
    const rEvap = (t) => 2501e3 - 2369 * t;
    /** Relatieve vochtigheid [%], begrensd op 100. */
    const rhFrom = (t, x, p) => Math.min(100, 100 * P.pwFromX(x, p) / P.satVapPres(t));

    /** Verzadigingstemperatuur bij enthalpie h (mistcorrectie), bisectie. */
    function tSatFromH(h, p, lo = -40, hi = 60) {
        for (let i = 0; i < 80; i++) {
            const mid = 0.5 * (lo + hi);
            if (hAir(mid, P.satHumRatio(mid, p)) > h) hi = mid; else lo = mid;
        }
        return 0.5 * (lo + hi);
    }

    /**
     * Mistcorrectie: temperatuur t_s waarbij verzadigde lucht plus nevel (x − x_s) als water bij t_s
     * dezelfde enthalpie h heeft als de oververzadigde toestand. Bisectie.
     */
    function tSatFromHMix(h, x, p, lo, hi) {
        for (let i = 0; i < 80; i++) {
            const mid = 0.5 * (lo + hi), xs = P.satHumRatio(mid, p);
            if (hAir(mid, xs) + (x - xs) * CP_W * mid > h) hi = mid; else lo = mid;
        }
        return 0.5 * (lo + hi);
    }

    /** Luchteigenschappen: μ (Sutherland), λ, D_v waterdamp (3.2.7/3). */
    function airProps(t, p) {
        const T = t + 273.15;
        return {
            mu: 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4),
            lam: 0.0241 * Math.pow(T / 273.15, 0.81),
            Dv: 0.926 / (p / 1000) * Math.pow(T, 2.5) / (T + 245) * 1e-6
        };
    }

    // =====================================================================
    // 1. Wind en Ventecdak (hoofdstuk 2)
    // =====================================================================
    /**
     * Windsnelheid op hoogte z uit de potentiële windsnelheid U10 (10 m, z0 = 0,03 m).
     * 2.1.1, 2.5.1–2.5.3: U_meso(60 m) = U10·ln(60/0,03)/ln(10/0,03); U(z) = U_meso·ln((z−d)/z0)/ln(60/z0).
     */
    function windAtHeight(U10, z, { z0 = 0.5, d = 10 } = {}) {
        const zeff = Math.max(z - d, z0);
        const Um = U10 * Math.log(60 / 0.03) / Math.log(10 / 0.03);
        return Math.max(0, Um * Math.log(zeff / z0) / Math.log(60 / z0));
    }

    /**
     * Cp in de keel van de venturi-ejector (2.3.1 voor c = 1 m, 2.3.2 voor c = 2 m).
     * Geldig voor 0,1 ≤ U_ej/U_ref ≤ 0,8 (tab. 2.4.1); daarbuiten de grenswaarde + waarschuwing.
     */
    function cpEjector(Uej, Uref, c = 2) {
        if (!(Uref > 0.05)) return { cp: 0, ratio: null, warning: warn('noWind', 'info') };
        let r = Uej / Uref, warning = null;
        if (r < 0.1) { warning = warn('ejectorRange', 'info', { ratio: r, lim: 0.1 }); r = 0.1; }
        if (r > 0.8) { warning = warn('ejectorRange', 'info', { ratio: r, lim: 0.8 }); r = 0.8; }
        const cp = c <= 1.5 ? 0.5374 * Math.log(r) + 0.6381 : 0.2913 * Math.log(r) + 0.0151;
        return { cp, ratio: Uej / Uref, warning };
    }

    /** Ventecdak: overdruk inlaat (2.1.4) en onderdruk ejector (2.3.x) t.o.v. de buitendruk. */
    function ventecdak({ U10, zRoof, qExh, aEjector, rho, c = 2, cpIn = 0.8, z0 = 0.5, d = 10 }) {
        const warnings = [];
        if (zRoof < d + 5) warnings.push(warn('windProfile', 'warn', { z: zRoof, d }));
        const Uref = windAtHeight(U10, zRoof, { z0, d });
        const qDyn = 0.5 * rho * Uref * Uref;
        const Uej = qExh / aEjector;
        const ej = cpEjector(Uej, Uref, c);
        if (ej.warning) warnings.push(ej.warning);
        if (c <= 1.5 && ej.cp > 0) warnings.push(warn('ejectorPositive', 'warn', { cp: ej.cp }));
        return { Uref, qDyn, pOver: cpIn * qDyn, pEj: ej.cp * qDyn, cpEj: ej.cp, Uej, ratio: ej.ratio, warnings };
    }

    // =====================================================================
    // 2. Klimaatcascade (hoofdstuk 3)
    // =====================================================================
    /** Sproeispectra: Fulljet uit de testopstelling (§3.4.10.1) en tabel 3.2.3/2 (d10/d20/d30/d32 in m). */
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

    /** Weerstandscoëfficiënt bol, Schiller-Naumann (1933) = "Wallis (1969)" in 3.2.4/3. */
    function cdSphere(Re) {
        if (Re < 1e-9) return 1e9;
        return Re < 1000 ? 24 / Re * (1 + 0.15 * Math.pow(Re, 0.687)) : 0.44;
    }

    /**
     * Eindsnelheid van een druppel [m/s] uit het krachtenevenwicht met C_d(Re) (3.2.4/4).
     * AFWIJKING: niet formule 3.2.4/6 (strijdig met Gunn & Kinzer 1949), zie SPEC §5.10 #2.
     */
    function dropTerminal(d, t = 20, p = P_STD) {
        const rhoA = rhoMoist(t, 0.008, p), mu = airProps(t, p).mu;
        let w = 3;
        for (let i = 0; i < 300; i++) {
            w = 0.5 * w + 0.5 * Math.sqrt(4 * G * d * (RHO_W - rhoA) / (3 * rhoA * cdSphere(rhoA * w * d / mu)));
        }
        return w;
    }

    /**
     * Klimaatcascade: gelijkstroom druppel–lucht, celmodel van boven (z = H) naar beneden (z = 0).
     * Exact als cascade() in het prototype (SPEC §5.3):
     *  - druppelsnelheid: impulsvergelijking met C_d(Re) op d30, start w0 (≈ 0,5 bar, §3.2.4)
     *  - oppervlak per cel A = 6·V_water/d32 (Sauter)            AFWIJKING van 3.2.5/7 (SPEC §5.10 #1)
     *  - Ranz-Marshall voor warmte- en stofoverdracht (3.2.6/1, 3.2.7/1) op d32
     *  - verdamping/condensatie β·A·(ρ_v,s(t_w) − ρ_v,lucht) boven vloeibaar water (3.2.2/3)
     *  - mist → isenthalpisch naar verzadiging, condensaat naar het water
     *  - hydraulische trek Σ (ṁ_w/A_c)·g·Δt = gewicht van het zwevende water (3.2.15/3–6)
     *  - aerodynamische trek (3.2.15/2) alleen informatief (SPEC §5.10 #5)
     */
    function cascade({ H, Ac, mDa, tIn, xIn, mW, tWIn, d30, d32, p = P_STD, w0 = 10, N = 400, active = true }) {
        const rhoIn = rhoMoist(tIn, xIn, p);
        const wAir = mDa * (1 + xIn) / rhoIn / Ac;
        const warnings = [];
        if (!active || !(mW > 0)) {
            // Droge schacht (variant A1): geen behandeling, geen hydraulische trek
            const rhIn = rhFrom(tIn, xIn, p);
            const profile = [];
            for (let i = 0; i <= 10; i++) profile.push({ z: H * (1 - i / 10), t: tIn, x: xIn, rh: rhIn, tw: null, wd: null, rho: rhoIn });
            return {
                t: tIn, x: xIn, rh: rhIn, tw: null, Q: 0, dpHydr: 0, dpAero: 0, profile, mEvap: 0, wAir, tRes: 0,
                balanceErr: 0, mWIn: 0, mWOut: 0, twMin: null, active: false, warnings
            };
        }
        if (tWIn > 20) warnings.push(warn('legionella', 'warn', { t: tWIn }));
        if (d32 < 0.5e-3) warnings.push(warn('aerosols', 'warn', { d: d32 * 1000 }));

        let t = tIn, x = xIn, tw = tWIn, mw = mW, wd = w0;
        const dz = H / N;
        let dpH = 0, dpA = 0, tRes = 0, mEvap = 0, twMin = tw;
        const profile = [{ z: H, t, x, rh: rhFrom(t, x, p), tw, wd, rho: rhoIn }];
        for (let i = 0; i < N; i++) {
            const { mu, lam, Dv } = airProps(t, p);
            const rhoA = rhoMoist(t, x, p);
            const nu = mu / rhoA;
            const wr = wd - wAir;                                   // relatieve druppelsnelheid
            const dt = dz / wd;                                     // verblijftijd in de cel
            const acc = G * (1 - rhoA / RHO_W) - 0.75 * rhoA / RHO_W * cdSphere(rhoA * Math.abs(wr) * d30 / mu) * wr * Math.abs(wr) / d30;
            const wdNew = Math.max(wd + acc * dt, wAir + 0.05);
            dpH += mw / Ac * G * dt;                                // gewicht zwevend water (3.2.15/3–6)
            dpA += mw / Ac * (wd - wdNew);                          // impulsoverdracht (3.2.15/2), info
            tRes += dt;
            const A = 6 * (mw / RHO_W * dt) / d32;                  // druppeloppervlak in de cel
            const Re = Math.abs(wr) * d32 / nu;
            const hc = (2 + 0.6 * Math.cbrt(0.71) * Math.sqrt(Re)) * lam / d32;
            const beta = (2 + 0.6 * Math.cbrt(nu / Dv) * Math.sqrt(Re)) * Dv / d32;
            const rvA = P.pwFromX(x, p) / (R_V * (t + 273.15));
            const rvS = P.satVapPresLiquid(tw) / (R_V * (tw + 273.15));
            const mEv = beta * A * (rvS - rvA);                     // + verdamping, − condensatie
            const Qs = hc * A * (tw - t);                           // voelbaar naar de lucht
            const cpm = CP_DA + CP_V * x;
            const tN = t + (Qs + mEv * CP_V * (tw - t)) / (mDa * cpm);
            const xN = x + mEv / mDa;
            const twN = tw - (Qs + mEv * rEvap(tw)) / (mw * CP_W);
            mw -= mEv; mEvap += mEv;
            t = tN; x = xN; tw = twN; wd = wdNew;
            if (x > P.satHumRatio(t, p)) {                          // mist → verzadiging
                // Isenthalpisch voor lucht + nevel; het condensaat (bij t_s) mengt met de waterstroom
                const ts = tSatFromHMix(hAir(t, x), x, p, t - 15, t + 15);
                const xs = P.satHumRatio(ts, p);
                const mc = (x - xs) * mDa;
                tw = (mw * tw + mc * ts) / (mw + mc);
                t = ts; x = xs; mw += mc; mEvap -= mc;
            }
            if (tw < twMin) twMin = tw;
            profile.push({ z: H - (i + 1) * dz, t, x, rh: rhFrom(t, x, p), tw, wd, rho: rhoMoist(t, x, p) });
        }
        const Q = mDa * (hAir(t, x) - hAir(tIn, xIn));              // + = lucht verwarmd
        const balanceErr = (Q + (mw * CP_W * tw - mW * CP_W * tWIn)) / Math.max(Math.abs(Q), 1);
        if (twMin < 0.5) warnings.push(warn('freezeTop', 'warn', { t: twMin }));
        if (!(Math.abs(balanceErr) < 1e-3)) warnings.push(warn('balance', 'error', { err: balanceErr * 100 }));
        return {
            t, x, rh: rhFrom(t, x, p), tw, Q, dpHydr: dpH, dpAero: dpA, profile, mEvap, wAir, tRes,
            balanceErr, mWIn: mW, mWOut: mw, twMin, active: true, warnings
        };
    }

    /**
     * Capaciteitsregeling via het waterdebiet (§3.5.3): RW/L ∈ [rwlMin, rwlMax] zodat t_uit = tTarget.
     * Bisectie met N = 200 cellen (zoals het prototype); de eindberekening doet de aanroeper met N = 400.
     */
    function cascadeAutoRwl({ tTarget, rwlMin = 0.3, rwlMax = 1.2, ...c }) {
        const f = (r) => cascade(Object.assign({}, c, { mW: r * c.mDa, N: 200 })).t - tTarget;
        if (f(rwlMin) <= 0) return { rwl: rwlMin, warning: warn('rwlMin', 'info', { rwl: rwlMin }) };
        if (f(rwlMax) >= 0) return { rwl: rwlMax, warning: warn('setpointUnreachable', 'warn', { rwl: rwlMax, t: tTarget }) };
        let lo = rwlMin, hi = rwlMax;
        for (let i = 0; i < 30; i++) {
            const mid = 0.5 * (lo + hi);
            if (f(mid) > 0) lo = mid; else hi = mid;
        }
        return { rwl: 0.5 * (lo + hi), warning: null };
    }

    /**
     * Thermische trek van een verticale kolom: Σ g·Δz·(ρ_kolom − ρ_e), trapeziumregel over het profiel.
     * Nooit met de rekenkundig gemiddelde temperatuur (§3.3.10, SPEC §5.10 #6). [Pa]
     */
    function stackDraft(profile, rhoOutside) {
        let s = 0;
        for (let i = 1; i < profile.length; i++) {
            const a = profile[i - 1], b = profile[i];
            s += G * Math.abs(a.z - b.z) * (0.5 * (a.rho + b.rho) - rhoOutside);
        }
        return s;
    }

    // =====================================================================
    // 3. Zonneschoorsteen (hoofdstuk 4)
    // =====================================================================
    /** g(θ)/g(0) — polynoom fig. 4.2.2 (WIS, HR++); 0 voor θ ≥ 90°. */
    function gAngleFactor(thetaDeg) {
        if (!(thetaDeg < 90)) return 0;
        const g = (th) => -2.173e-6 * th * th * th + 1.387e-4 * th * th - 2.415e-3 * th + 0.6747;
        return Math.max(0, g(Math.max(0, thetaDeg)) / g(0));
    }
    /** Hemisferisch gemiddelde van g(θ)/g(0) voor isotrope diffuse straling. */
    const K_DIFFUSE = 0.874;

    /**
     * Driekennodenmodel per segment (4.2.5.3, vgl. 4.2.5/13–15), gemarcheerd van voet naar top.
     * phiBeam / phiDiff = directe resp. diffuse + grondstraling op het glasvlak [W/m²].
     * AFWIJKING (SPEC §5.10 #3, #4): correcte energiebalansen; verlies binnenwand in knoop 3;
     * CWC = Churchill-Usagi menging van 1,5·|Δθ|^⅓ (4.2.4/4) en cwc·w (4.2.4/9, 7,65).
     * Massastroom per segment ρ(θ_in,seg)·q, zoals het prototype.
     */
    function chimney({
        H, B, D, q, tIn, tE, xE, phiBeam, phiDiff, theta = 0, g = 0.70, U = 1.32, R = 0.95,
        f1 = 0.25, f2 = 0.75, epsW = 0.05, epsGl = EPS_GLASS, Uwall = 0.25, tBack = 21, angleCorr = true,
        p = P_STD, hSeg = 3.5, cwc = 7.65, N
    }) {
        N = N || Math.max(4, Math.round(H / hSeg) * 4);
        const Ustar = 1 / (1 / U - 0.13);                   // glasbinnenoppervlak → buitenlucht (R_si = 0,13)
        const ka = angleCorr ? gAngleFactor(theta) : 1;
        const kd = angleCorr ? K_DIFFUSE : 1;
        const S = R * g * (phiBeam * ka + phiDiff * kd);    // doorgelaten straling per m² bruto glas
        const Bstr = 0.872 * B + 1.6 * D, Bconv = B + 2 * D; // schijnbare breedtes zijwanden (4.2.5.3)
        const w = q / (B * D);
        const eres = 1 / (1 / epsW + 1 / epsGl - 1);
        const dz = H / N;
        const fw = Math.pow(cwc * w, 3);
        const cpm = CP_DA + CP_V * xE;
        const rhoE = rhoMoist(tE, xE, p);
        let ta = tIn, tgl = tE + 5, tw = tIn + 10;
        const profile = [{ z: 0, t: ta, tgl: null, tw: null }];
        let Q = 0, dp = 0, tGlassMax = -Infinity, tWallMax = -Infinity;
        for (let i = 0; i < N; i++) {
            const m = rhoMoist(ta, xE, p) * q;
            let taOut = ta + 0.5;
            for (let k = 0; k < 300; k++) {
                const tm = 0.5 * (ta + taOut);
                const hcg = Math.cbrt(Math.pow(1.5 * Math.cbrt(Math.abs(tgl - tm)), 3) + fw);
                const hcw = Math.cbrt(Math.pow(1.5 * Math.cbrt(Math.abs(tw - tm)), 3) + fw);
                const Tm = 0.5 * (tw + tgl) + 273.15;
                const hs = 4 * eres * SIGMA * Tm * Tm * Tm;
                // knoop 1 (glas) en knoop 3 (absorberwand), Gauss-Seidel
                const tglN = (f1 * S * B + Bstr * hs * tw + B * Ustar * tE + B * hcg * tm) / (B * Ustar + B * hcg + Bstr * hs);
                const twN = (f2 * S * B + Bconv * hcw * tm + Bstr * hs * tglN + B * Uwall * tBack) / (Bconv * hcw + Bstr * hs + B * Uwall);
                // knoop 2 (lucht)
                const Qc = dz * (B * hcg * (tglN - tm) + Bconv * hcw * (twN - tm));
                const taOutN = ta + Qc / (m * cpm);
                const done = Math.abs(taOutN - taOut) < 1e-7 && Math.abs(tglN - tgl) < 1e-7 && Math.abs(twN - tw) < 1e-7;
                tgl = 0.5 * (tgl + tglN); tw = 0.5 * (tw + twN); taOut = 0.5 * (taOut + taOutN);   // demping ½
                if (done) break;
            }
            Q += m * cpm * (taOut - ta);
            dp += G * dz * (rhoE - rhoMoist(0.5 * (ta + taOut), xE, p));   // 4.2.6/1, geïntegreerd
            ta = taOut;
            if (tgl > tGlassMax) tGlassMax = tgl;
            if (tw > tWallMax) tWallMax = tw;
            profile.push({ z: (i + 1) * dz, t: ta, tgl, tw });
        }
        const inc = R * B * H * (phiBeam + phiDiff);
        return {
            tOut: ta, Q, eta: inc > 1 ? Q / inc : null, dpTh: dp, w, tGlassMax, tWallMax, profile, S, N,
            Dh: 2 * B * D / (B + D)
        };
    }

    /**
     * Wrijvingsverlies (4.2.7/2) met λ expliciet volgens 4.2.7/3
     * (Swamee-Jain-vorm van Colebrook-White), wandruwheid eps [m]. [Pa]
     */
    function frictionDp(L, Dh, w, rho, eps = 0.010, nu = 1.6e-5) {
        if (!(L > 0) || !(Dh > 0)) return 0;
        const Re = Math.max(w * Dh / nu, 1);
        const lg = Math.log10(eps / (3.72 * Dh) + 5.74 / Math.pow(Re, 0.901));
        const lam = 0.25 / (lg * lg);
        return lam * L / Dh * 0.5 * rho * w * w;
    }

    return {
        G, P_STD, RHO_W, CP_W, CP_DA, CP_V, R_DA, R_V, SIGMA, RHO_REF, EPS_GLASS, K_DIFFUSE, SPRAY,
        hAir, rhoMoist, rEvap, rhFrom, tSatFromH, airProps,
        windAtHeight, cpEjector, ventecdak,
        cdSphere, dropTerminal, cascade, cascadeAutoRwl, stackDraft,
        gAngleFactor, chimney, frictionDp
    };
});
