// EWF-model: standaardgebouw tegen het prototype (SPEC §12.2), kernwaarden, monotonie en robuustheid (§12.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/ewf/model.js');
const O = require('./fixtures/ewf-oracle.json');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const nearRel = (a, b, rel, abs, msg) => near(a, b, Math.max(abs, rel * Math.abs(b)), msg);
const sim = (bld, w) => M.simulate(Object.assign({}, M.DEFAULTS, bld || {}), w || M.presetWeather('ontwerp_zomer'));
const deepFinite = (o, path = 'r') => {
    if (typeof o === 'number') assert.ok(!Number.isNaN(o), `NaN in ${path}`);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) deepFinite(v, `${path}.${k}`);
};

test('alle 12 presets op het standaardgebouw: regressie tegen het prototype', () => {
    for (const [id, o] of Object.entries(O.default_building)) {
        const w = M.presetWeather(id);
        const r = M.simulate(M.DEFAULTS, w);
        // Weer en straling op de gevel zoals het prototype
        near(r.rad.beam, o.weather.phiBeam, 0.5, `${id} Φ_beam`);
        near(r.rad.diffuse, o.weather.phiDiff, 0.5, `${id} Φ_diff`);
        assert.equal(r.rad.angleCorr, o.weather.angleCorr, `${id} invalshoekcorrectie`);
        assert.equal(r.mode, o.mode === 'koelen' ? 'cool' : 'heat', `${id} modus`);
        near(r.cascade.rwl, o.rwl, 0.03, `${id} RW/L`);
        near(r.cascade.out.t, o.tCascadeOut, 0.3, `${id} t uit cascade`);
        nearRel(r.cascade.Q, o.Qcascade, 0.03, 0, `${id} Q_cascade`);
        nearRel(r.cascade.dpHydr, o.dpHydr, 0.03, 1.0, `${id} Δp_hydr`);
        nearRel(r.cascade.dpTh, o.dpThCascade, 0.03, 1.0, `${id} Δp_th,kc`);
        near(r.chimney.tOut, o.tChimneyOut, 0.3, `${id} t_zs`);
        nearRel(r.chimney.Q, o.Qchimney, 0.03, 0, `${id} Q_zs`);
        nearRel(r.chimney.dpTh, o.dpChimney, 0.03, 1.0, `${id} trek zs`);
        nearRel(r.ventec.pOver, o.pOver, 0.03, 1.0, `${id} p_over`);
        nearRel(r.ventec.pEj, o.pEj, 0.03, 1.0, `${id} p_ej`);
        r.pressure.supply.forEach((q, i) => nearRel(q.available, o.supplyMargin[i], 0.03, 1.0, `${id} toevoermarge vl. ${i + 1}`));
        r.pressure.exhaust.forEach((q, i) => nearRel(q.available, o.exhaustMargin[i], 0.03, 1.0, `${id} afvoermarge vl. ${i + 1}`));
        nearRel(r.power.Pspray, o.Pspray, 0.03, 0, `${id} P_sproei`);
        nearRel(r.power.Psource, o.Psource, 0.03, 0, `${id} P_bron`);
        nearRel(r.power.Pfan, o.Pfan, 0.03, 5, `${id} P_vent`);
        if (o.COP == null) assert.equal(r.power.COP, null, `${id} COP`);
        else nearRel(r.power.COP, o.COP, 0.03, 0, `${id} COP`);
        near(r.room.rh, o.rhRoom, 0.5, `${id} RV ruimte`);
        nearRel(r.fiwihex.Q, o.QfiWiHex, 0.03, 0, `${id} Q_FiWiHEx`);
    }
});

test('kernwaarden ontwerp zomer (SPEC §12.2)', () => {
    const r = sim();
    near(r.derived.qV * 3600, 40320, 1e-6, 'q_v');
    near(r.derived.mDa, 13.27, 0.01, 'ṁ_da');
    near(r.derived.Ac, 5.60, 0.005, 'A_c');
    near(r.cascade.rwl, 0.85, 0.02, 'RW/L');
    near(r.cascade.out.t, 17.0, 0.05, 't uit');
    assert.ok(r.cascade.out.rh >= 98.5, 'RV uit ≈ 99 %');
    near(r.cascade.Q / 1000, -184, 2, 'Q_cascade');
    near(r.cascade.dpHydr, 88, 1, 'Δp_hydr');
    near(r.cascade.dpTh, 9.9, 0.3, 'Δp_th,kc');
    near(r.pressure.supply[0].available, 78, 1, 'toevoermarge vl. 1');
    near(r.pressure.supply[7].available, 67, 1, 'toevoermarge vl. 8');
    near(r.pressure.exhaust[0].available, -14.8, 0.5, 'afvoermarge vl. 1');
    near(r.pressure.exhaust[7].available, -12.1, 0.5, 'afvoermarge vl. 8');
    near(r.power.Pfan / 1000, 0.22, 0.01, 'P_vent');
    near(r.power.Pspray / 1000, 4.95, 0.05, 'P_sproei');
    near(r.power.COP, 36, 1, 'COP');
    near(r.room.rh, 65, 1, 'RV ruimte');
    assert.ok(r.warnings.some((w) => w.code === 'roomHumid'), 'waarschuwing RV ruimte');
    assert.equal(r.reheat.Q, 0);
});

test('ontwerp winter: verwarmen met vorstwater, schoorsteen dicht, bovenste verdieping minste afvoertrek', () => {
    const r = sim(null, M.presetWeather('ontwerp_winter'));
    assert.equal(r.mode, 'heat');
    assert.equal(r.cascade.tWIn, 15);
    assert.equal(r.cascade.rwl, 0.9);
    assert.ok(r.reheat.Q > 0 && Math.abs(r.supply.t - 18) < 1e-9, 'naverwarmen tot 18 °C');
    assert.equal(r.chimney.open, false);
    assert.ok(r.warnings.some((w) => w.code === 'chimneyClosed'));
    const ex = r.pressure.exhaust.map((q) => q.available);
    assert.ok(ex[0] > ex[ex.length - 1], 'shuntkolom kost trek in de winter');
    const sup = r.pressure.supply.map((q) => q.available);
    assert.ok(sup[sup.length - 1] > sup[0], 'warme toevoerschacht: meer overdruk bovenin');
});

test('monotonie: RW/L, verdiepingen, straling', () => {
    const w = M.presetWeather('ontwerp_zomer');
    const t = [0.4, 0.7, 1.0].map((rwl) => M.simulate(M.DEFAULTS, w, { rwl }).cascade.out.t);
    assert.ok(t[0] > t[1] && t[1] > t[2], `meer RW/L → lagere t_uit (${t})`);
    const dp = [6, 8, 12].map((floors) => sim({ floors }).cascade.dpHydr);
    assert.ok(dp[0] < dp[1] && dp[1] < dp[2], `meer verdiepingen → meer Δp_hydr (${dp})`);
    const tzs = [100, 400, 800].map((facade) => sim(null, Object.assign(M.presetWeather('ontwerp_zomer'), { facade })).chimney.tOut);
    assert.ok(tzs[0] < tzs[1] && tzs[1] < tzs[2], `meer straling → hogere t_zs (${tzs})`);
});

test('invoer buiten bereik: waarschuwing, geen NaN, geen crash', () => {
    const cases = [
        { floors: 30 }, { floors: 0 }, { hFloor: -1 }, { avoFloor: 'abc' }, { wCascade: 0 }, { occDensity: 5 },
        { chimB: 0 }, { chimD: 1e6 }, { nCells: 5 }, { spray: 's10' }, { terrain: '8' }, { ventMethod: 'manual', qManual: 0 }
    ];
    for (const c of cases) {
        for (const pid of ['ontwerp_zomer', 'ontwerp_winter']) {
            const r = sim(c, M.presetWeather(pid));
            deepFinite(Object.assign({}, r, { inputs: null }));
            assert.ok(r.warnings.length > 0, `${JSON.stringify(c)}: waarschuwing`);
        }
    }
    const r = sim({ floors: 30 });
    const wr = r.warnings.find((w) => w.code === 'inputRange' && w.vars.field === 'floors');
    assert.ok(wr, 'inputRange voor floors');
    const r2 = sim({ floors: 0 });
    assert.ok(r2.warnings.some((w) => w.code === 'inputClamped' && w.vars.field === 'floors'));
    assert.equal(r2.inputs.building.floors, 1);
    // Extreem weer
    for (const w of [{ t: -35, rh: 100, U10: 40 }, { t: 45, rh: 5, U10: 0 }, { t: 'x', rh: null }]) {
        deepFinite(Object.assign({}, M.simulate(M.DEFAULTS, Object.assign(M.presetWeather('ontwerp_zomer'), w)), { inputs: null }));
    }
});

test('Bbl-controle: te laag handmatig debiet geeft waarschuwing', () => {
    const r = sim({ ventMethod: 'manual', qManual: 800 * 5 / 1000 });
    assert.ok(r.warnings.some((w) => w.code === 'bblFlow'));
    assert.ok(!sim().warnings.some((w) => w.code === 'bblFlow'));
});

test('ventilatiecategorieën NEN-EN 16798-1', () => {
    near(M.ventilationFlow(M.normalizeBuilding({ ventCat: 'I', emission: 'non' }), 8000, 800) * 1000, 800 * 10 + 8000 * 2.0, 1e-9, 'cat. I');
    near(M.ventilationFlow(M.normalizeBuilding({}), 8000, 800) * 1000, 800 * 7 + 8000 * 0.7, 1e-9, 'cat. II');
});

test('handmatige RW/L, variant A1 en setpoint niet haalbaar', () => {
    const r = sim({ rwlMode: 'manual', rwlManual: 0.5 });
    near(r.cascade.rwl, 0.5, 1e-12, 'handmatig');
    const a1 = sim({ variantA1: true }, M.presetWeather('tussen'));
    assert.equal(a1.mode, 'off');
    assert.equal(a1.cascade.dpHydr, 0);
    assert.equal(a1.power.Pspray, 0);
    assert.ok(a1.pressure.fanSupplyPa > 0, 'zonder hydraulische trek is een hulpventilator nodig');
    const hot = sim({ rwlMax: 0.5 }, M.presetWeather('hitte_2019'));
    assert.ok(hot.warnings.some((w) => w.code === 'setpointUnreachable'));
    const cold = sim({ rwlWinter: 0.3 }, M.presetWeather('koude_2021'));
    assert.ok(cold.warnings.some((w) => w.code === 'iceLikely'));
});

test('waarschuwingen: legionella, aerosolen, glastemperatuur', () => {
    assert.ok(sim({ tWCool: 22 }).warnings.some((w) => w.code === 'legionella'));
    assert.ok(sim({ spray: 'custom', d30: 0.3e-3, d32: 0.4e-3 }).warnings.some((w) => w.code === 'aerosols'));
    const hot = sim({ floors: 14, glass: 'ps' }, Object.assign(M.presetWeather('hitte_2019'), { facadeManual: true, facade: 1100 }));
    assert.ok(hot.chimney.tGlassMax > 0);
    for (const w of hot.warnings) assert.ok(['info', 'warn', 'error'].includes(w.level) && typeof w.code === 'string');
});

test('Mollier-procesketen in het formaat van computeScenario', () => {
    const r = sim(null, M.presetWeather('zon_winter'));
    const { states, steps } = r.mollier;
    assert.deepEqual(states.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
    assert.equal(steps.length, 5);
    for (const st of steps) {
        assert.ok(st.ok && st.step.id && st.path.length >= 2);
        assert.ok(st.path.every((q) => isFinite(q.t) && isFinite(q.x) && isFinite(q.h)));
    }
    assert.equal(steps[0].path.length, r.cascade.profile.length, 'cascadeprofiel als gekromd pad');
    const summer = sim();
    assert.deepEqual(summer.mollier.states.map((s) => s.n), [1, 2, 4, 5, 6], 'zonder naverwarming geen punt 3');
});

test('prestatie: simulate < 30 ms, simulateAll < 400 ms', () => {
    sim();                                         // opwarmen (JIT)
    let t0 = process.hrtime.bigint();
    const N = 5;
    for (let i = 0; i < N; i++) sim(null, M.presetWeather(M.PRESETS[i * 2].id));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    assert.ok(ms < 30, `simulate ${ms.toFixed(1)} ms`);
    t0 = process.hrtime.bigint();
    const rows = M.simulateAll(M.DEFAULTS);
    const all = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(all < 400, `simulateAll ${all.toFixed(0)} ms`);
    assert.equal(rows.length, 12);
    for (const row of rows) deepFinite(row);
});

test('live validatietabel: alle rijen groen', () => {
    const rows = M.runValidation();
    assert.ok(rows.length > 60);
    for (const r of rows) assert.ok(r.ok, `${r.group} ${r.id} ${r.qty}: ${r.value} vs ${r.ref ?? JSON.stringify(r.tol)}`);
});

test('presets: tijd, zonnestand en vaste gevelstraling', () => {
    for (const pr of M.PRESETS) {
        const w = M.presetWeather(pr.id);
        assert.ok(isFinite(Date.parse(w.time)), pr.id);
        assert.equal(w.facadeManual, pr.facade != null);
    }
    // Representatieve datum, 12:00 zonnetijd
    const r = sim();
    near(r.rad.sun.az, 0, 0.1, 'zon in het zuiden');
    assert.equal(r.rad.method, 'manual');
});
