// EWF-fysica: validatie tegen metingen en proefschrift (SPEC §12.1) en regressie tegen het prototype (§12.2).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/psychro.js');
const PH = require('../js/ewf/physics.js');
const M = require('../js/ewf/model.js');
const O = require('./fixtures/ewf-oracle.json');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const nearRel = (a, b, rel, abs, msg) => near(a, b, Math.max(abs, rel * Math.abs(b)), msg);

test('eindsnelheid druppels binnen 10 % van Gunn & Kinzer (1949)', () => {
    for (const [d, gk] of M.REF.drops) nearRel(PH.dropTerminal(d * 1e-3), gk, 0.10, 0, `d = ${d} mm`);
});

test('cascade testopstelling B1–B5 tegen de metingen (tab. 3.4.7)', () => {
    for (const c of M.REF.testrig) {
        const { r, dp } = M.rigCase(c);
        near(r.t, c.tOut, c.tolT, `${c.id} t_uit`);
        near(r.tw, c.twOut, 0.5, `${c.id} t_w,uit`);
        near(r.x * 1000, c.xOut, 1.0, `${c.id} x_uit`);
        near(dp, c.dp, 1.5, `${c.id} drukopbouw`);
        assert.ok(Math.abs(r.balanceErr) < 1e-3, `${c.id} energiebalans ${r.balanceErr}`);
    }
});

test('cascade testopstelling: regressie tegen het prototype', () => {
    for (const o of O.cascade_testrig) {
        const i = o.input;
        const x = P.xFromTRh(i.tIn, i.rhIn, i.p);
        const mDa = i.Vm3h / 3600 * PH.rhoMoist(i.tIn, x, i.p) / (1 + x);
        near(mDa, o.mDa, 1e-9, `${o.id} ṁ_da`);
        const r = PH.cascade({ H: i.H, Ac: i.Ac, mDa, tIn: i.tIn, xIn: x, mW: i.mW, tWIn: i.tWIn, d30: i.d30, d32: i.d32, p: i.p, w0: i.w0, N: i.N });
        near(r.t, o.tOut, 0.3, `${o.id} t_uit`);
        near(r.tw, o.twOut, 0.3, `${o.id} t_w,uit`);
        near(r.x * 1000, o.xOut * 1000, 0.1, `${o.id} x_uit`);
        nearRel(r.dpHydr, o.dpHydr, 0.03, 1.0, `${o.id} Δp_hydr`);
        nearRel(r.Q, o.Q, 0.03, 0, `${o.id} Q`);
    }
});

test('cascade: waterbalans exact, energiebalans < 0,1 %', () => {
    for (const c of M.REF.testrig) {
        const { r } = M.rigCase(c);
        near(r.mWOut, r.mWIn - r.mEvap, 1e-12, `${c.id} ṁ_w,uit = ṁ_w,in − ṁ_ev`);
    }
    for (const id of Object.keys(O.default_building)) {
        const r = M.simulate(M.DEFAULTS, M.presetWeather(id));
        assert.ok(Math.abs(r.cascade.balanceErr) < 1e-3, `${id}: ${r.cascade.balanceErr}`);
        near(r.cascade.mWOut, r.cascade.mW - r.cascade.mEvap, 1e-9, `${id} waterbalans`);
    }
});

test('cascade ware grootte tegen CFD (tab. 3.3.9/2) en het prototype', () => {
    for (const c of M.REF.fullscale) {
        const r = M.fullCase(c);
        near(r.t, c.cfd, 2.0, `${c.id} vs CFD`);
        const o = O.cascade_fullscale.find((q) => q.id === c.id);
        near(r.t, o.tOut, 0.3, `${c.id} t_uit (orakel)`);
        nearRel(r.dpHydr, o.dpHydr, 0.03, 1.0, `${c.id} Δp_hydr (orakel)`);
        assert.ok(r.rh > 99, `${c.id} verzadigd`);
    }
});

test('droge schacht (variant A1): geen behandeling en geen hydraulische trek', () => {
    const x = P.xFromTRh(12, 70, 101325);
    const r = PH.cascade({ H: 28, Ac: 5.6, mDa: 13, tIn: 12, xIn: x, mW: 0, tWIn: 13, d30: 1e-3, d32: 1.3e-3, active: false });
    assert.equal(r.Q, 0);
    assert.equal(r.dpHydr, 0);
    near(PH.stackDraft(r.profile, PH.rhoMoist(12, x, 101325)), 0, 1e-12, 'geen thermische trek');
});

test('windprofiel: formule 2.5.3 en Ventecdak-tabel 2.5.3', () => {
    for (const z of [15, 22, 40]) near(PH.windAtHeight(1, z), 0.273 * Math.log((z - 10) / 0.5), 0.002, `z = ${z}`);
    for (const [z, U, pn, pp] of M.REF.ventec) {
        const vd = PH.ventecdak({ U10: 3.5, zRoof: z, qExh: 1, aEjector: 1, rho: 1.229, c: 2, cpIn: 0.8 });
        near(vd.Uref, U, 0.03, `U_ref z = ${z}`);
        nearRel(vd.pEj, pn, 0.03, 0.05, `onderdruk z = ${z}`);
        nearRel(vd.pOver, pp, 0.03, 0.05, `overdruk z = ${z}`);
        const o = O.ventecdak_tab253.find((q) => q.z === z);
        near(vd.Uref, o.Uref, 1e-9, 'orakel U_ref');
        near(vd.pEj, o.pNeg, 1e-9, 'orakel p_ej');
    }
});

test('ejector: geldigheidsgebied, geen wind en waarschuwingen', () => {
    assert.equal(PH.cpEjector(1, 0.01).cp, 0);
    assert.equal(PH.cpEjector(1, 0.01).warning.code, 'noWind');
    const lo = PH.cpEjector(0.5, 10);                 // U_ej/U_ref = 0,05 → grens 0,1
    near(lo.cp, 0.2913 * Math.log(0.1) + 0.0151, 1e-12, 'ondergrens');
    assert.equal(lo.warning.code, 'ejectorRange');
    const hi = PH.cpEjector(2, 1);                    // 2 → grens 0,8
    near(hi.cp, 0.2913 * Math.log(0.8) + 0.0151, 1e-12, 'bovengrens');
    assert.ok(PH.cpEjector(0.4, 1, 1).cp > 0, 'c = 1 m: Cp positief boven ratio 0,3');
    const vd = PH.ventecdak({ U10: 3, zRoof: 12, qExh: 1, aEjector: 1, rho: 1.2 });
    assert.ok(vd.warnings.some((w) => w.code === 'windProfile'), 'z_dak < d + 5 m');
});

test('thermische trek: vereenvoudiging proefschrift (§3.5.5.4/5) met generieke integratie', () => {
    const d = M.thesisDraft();
    near(d.summerFoot, 7.5, 0.2, 'zomer voet');
    near(d.winterFoot, -14.0, 0.2, 'winter voet');
    near(d.winterTopThesis, 16.3, 0.2, 'winter top (conventie proefschrift: schacht t.o.v. cascadekolom)');
    // Neutrale-zonebenadering (SPEC §5.4): schacht t.o.v. buitenlucht → U-buiseffect, hogere overdruk bovenin
    near(d.winterTopGeneric, 30.3, 0.2, 'winter top (SPEC §5.4)');
});

test('stackDraft integreert over het profiel, niet met de gemiddelde temperatuur', () => {
    const p = 101325;
    const prof = [];
    for (let i = 0; i <= 100; i++) {
        const z = 28 * (1 - i / 100), t = 17 + 11 * Math.exp(-i / 10);   // sterk niet-lineair, zoals §3.3.10
        prof.push({ z, rho: PH.rhoMoist(t, 0.012, p), t });
    }
    const exact = PH.stackDraft(prof, PH.rhoMoist(28, 0.012, p));
    const tMean = (prof[0].t + prof[prof.length - 1].t) / 2;           // rekenkundig gemiddelde in/uit
    const naive = 9.81 * 28 * (PH.rhoMoist(tMean, 0.012, p) - PH.rhoMoist(28, 0.012, p));
    assert.ok(exact > naive + 1, `profiel ${exact} vs gemiddelde ${naive}`);
});

test('zonneschoorsteen referentie: rendement en ΔT per verdieping (fig. 4.5.6/1, 4.2.8/6)', () => {
    for (const o of O.chimney_reference) {
        const r = PH.chimney({ H: o.floors * 3.5, B: 3.6, D: 0.65, q: 3.6 * 0.65 * 1.5, tIn: 21, tE: 20, xE: 0.008, phiBeam: 0, phiDiff: 400, angleCorr: false });
        assert.ok(r.eta >= 0.60 && r.eta <= 0.68, `η ${o.floors} verd. = ${r.eta}`);
        const dT = (r.tOut - 21) / o.floors;
        assert.ok(dT >= 0.66 && dT <= 0.80, `ΔT/verd ${o.floors} = ${dT}`);
        near(r.tOut, o.tOut, 0.3, `orakel t_uit ${o.floors}`);
        nearRel(r.dpTh, o.dpTh, 0.03, 1.0, `orakel trek ${o.floors}`);
    }
});

test('zonneschoorsteen extreem (§4.5.11.3) en testopstelling 15-12-2009', () => {
    const ex = PH.chimney({ H: 49, B: 3.6, D: 0.65, q: 3.6 * 0.65 * 1.5, tIn: 24, tE: 32, xE: 0.010, phiBeam: 0, phiDiff: 840, g: 0.75, U: 1.10, angleCorr: false });
    near(ex.tGlassMax, 60, 3, 'glas max');
    near(ex.tWallMax, 73, 4, 'wand max');
    const rig = PH.chimney({ H: 11, B: 2.0, D: 0.25, q: 0.5, tIn: 20.92, tE: 0.55, xE: 0.003, phiBeam: 0, phiDiff: 730, U: 1.58, R: 0.83, Uwall: 0.235, angleCorr: false });
    near(rig.tOut, 32.1, 2.5, 't_uit testopstelling');
});

test('zonneschoorsteen: zonder straling verlies (kantelpunt) en geen NaN', () => {
    const r = PH.chimney({ H: 28, B: 11.5, D: 0.65, q: 11.2, tIn: 21, tE: -10, xE: 0.0015, phiBeam: 0, phiDiff: 0 });
    assert.ok(r.Q < 0, 'netto verlies');
    assert.equal(r.eta, null);
    assert.ok(r.profile.every((q) => isFinite(q.t)));
});

test('g(θ)/g(0): 1 bij loodrechte inval, 0 vanaf 90°, hemisferisch gemiddelde ≈ 0,874', () => {
    near(PH.gAngleFactor(0), 1, 1e-12, 'θ = 0');
    assert.equal(PH.gAngleFactor(90), 0);
    // ∫ k(θ)·cos θ·sin θ dθ / ∫ cos θ·sin θ dθ over 0…90°
    let num = 0, den = 0;
    for (let i = 0; i < 900; i++) {
        const th = (i + 0.5) / 10, r = th * Math.PI / 180, wgt = Math.cos(r) * Math.sin(r);
        num += PH.gAngleFactor(th) * wgt; den += wgt;
    }
    near(num / den, PH.K_DIFFUSE, 0.02, 'hemisferisch gemiddelde');
});

test('wrijving: λ volgens 4.2.7/3 (Swamee-Jain) en randgevallen', () => {
    const Dh = 2 * 11.5 * 0.65 / 12.15, w = 1.5;
    const Re = w * Dh / 1.6e-5;
    const lam = 0.25 / Math.log10(0.010 / (3.72 * Dh) + 5.74 / Math.pow(Re, 0.901)) ** 2;
    near(PH.frictionDp(28, Dh, w, 1.2), lam * 28 / Dh * 0.5 * 1.2 * w * w, 1e-12, 'Δp');
    assert.equal(PH.frictionDp(0, Dh, w, 1.2), 0);
    assert.equal(PH.frictionDp(10, Dh, 0, 1.2), 0);
});
