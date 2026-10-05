// Processen: energie- en massabalansen en randgevallen.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/psychro.js');
const PR = require('../js/processes.js');

const p = 101325;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const scn = (start, steps, flow = { mode: 'volume', value: 3600 }) => PR.computeScenario({
    start, flow, steps: steps.map((s, i) => ({ id: 's' + i, enabled: true, ...s, params: PR.defaultParams(s.type, s.params) }))
}, p);

test('verwarmen met vermogen: Q = ṁ·Δh, x constant', () => {
    const r = scn({ pair: 't-rh', a: 0, b: 80 }, [{ type: 'heat', params: { mode: 'power', value: 12 } }]);
    const st = r.steps[0];
    assert.ok(st.ok);
    near(st.qt, 12, 1e-9, 'Q');
    near(st.dx, 0, 1e-15, 'Δx');
    near(r.totals.heating, 12, 1e-9, 'totaal verwarmen');
});

test('koelen onder dauwpunt: verzadigd eindpunt en condensaat', () => {
    const r = scn({ pair: 't-rh', a: 28, b: 55 }, [{ type: 'cool', params: { mode: 'toT', value: 12 } }]);
    const st = r.steps[0];
    near(st.end.rh, 100, 1e-6, 'RH');
    assert.ok(st.water < 0, 'water wordt afgevoerd');
    near(r.totals.dehum, -st.water, 1e-12, 'condensaat');
    // Pad gaat eerst bij constante x naar het dauwpunt
    near(st.path[1].x, st.start.x, 1e-12, 'dauwpuntknik');
});

test('koelen met vermogen voorbij het dauwpunt raakt de verzadigingslijn', () => {
    const r = scn({ pair: 't-rh', a: 30, b: 50 }, [{ type: 'cool', params: { mode: 'power', value: 25 } }]);
    const st = r.steps[0];
    near(-st.qt, 25, 1e-6, 'koelvermogen');
    near(st.end.rh, 100, 1e-6, 'verzadigd');
});

test('koelbatterij: uittrede ligt op de lijn naar het ADP met bypassfactor', () => {
    const r = scn({ pair: 't-rh', a: 30, b: 50 }, [{ type: 'coil', params: { tAdp: 8, mode: 'bf', value: 0.2 } }]);
    const st = r.steps[0];
    const adp = st.aux[0].state;
    near((st.end.h - adp.h) / (st.start.h - adp.h), 0.2, 1e-9, 'BF op h');
    near((st.end.x - adp.x) / (st.start.x - adp.x), 0.2, 1e-9, 'BF op x');
    const r2 = scn({ pair: 't-rh', a: 30, b: 50 }, [{ type: 'coil', params: { tAdp: 8, mode: 'toT', value: st.end.t } }]);
    near(r2.steps[0].info.bf, 0.2, 1e-6, 'BF terug uit t');
});

test('koellast trekt de enthalpie van het condensaat af (ASHRAE)', () => {
    for (const type of ['cool', 'coil', 'cooldehum']) {
        const params = { cool: { mode: 'toT', value: 12 }, coil: { tAdp: 8, mode: 'bf', value: 0.15 }, cooldehum: { t: 14, rh: 90 } }[type];
        const st = scn({ pair: 't-rh', a: 28, b: 55 }, [{ type, params }]).steps[0];
        const m = st.start.mdot;
        const q = m * ((st.start.h - st.end.h) - (st.start.x - st.end.x) * P.CP_W * st.end.t);
        near(-st.qt, q, 1e-9, `${type} Q`);
        near(st.qs + st.ql, st.qt, 1e-12, `${type} Q_s + Q_l`);
    }
});

test('koelbatterij met zeer vochtige intrede: uittrede verzadigd, geen mist', () => {
    const st = scn({ pair: 't-rh', a: 30, b: 90 }, [{ type: 'coil', params: { tAdp: 8, mode: 'bf', value: 0.2 } }]).steps[0];
    assert.equal(st.end.fog, false);
    near(st.end.rh, 100, 1e-6, 'RH');
    // Zelfde koellast als het (fysisch onmogelijke) mistpunt op de rechte lijn naar het ADP
    const adp = st.aux[0].state;
    const fogPt = PR.lerpState(adp, st.start, 0.2, p);
    assert.equal(fogPt.fog, true);
    near(st.end.t, fogPt.t, 1e-9, 't');
    const m = st.start.mdot;
    near(-st.qt, m * ((st.start.h - fogPt.h) - (st.start.x - fogPt.x) * P.hCondensed(fogPt.t)), 1e-9, 'Q');
});

test('energiebalans over een keten: Σ Q = ṁ·Δh + condensaat', () => {
    const r = scn({ pair: 't-rh', a: 30, b: 60 }, [
        { type: 'coil', params: { tAdp: 9, mode: 'bf', value: 0.1 } },
        { type: 'heat', params: { mode: 'toT', value: 18 } },
        { type: 'fan', params: { dp: 700, eff: 60 } }
    ]);
    const m = r.mdot, s0 = r.states[0], sN = r.states[r.states.length - 1];
    const drain = r.steps.reduce((a, s) => a + (s.dx < 0 ? -s.dx * m * P.hCondensed(s.end.t) : 0), 0);
    near(r.steps.reduce((a, s) => a + s.qt, 0), m * (sN.h - s0.h) + drain, 1e-9, 'energie');
    near(r.steps.reduce((a, s) => a + s.water, 0), m * (sN.x - s0.x) * 3600, 1e-9, 'water');
});

test('koelen & ontvochtigen: afgeleid ADP en BF zijn consistent', () => {
    const r = scn({ pair: 't-rh', a: 30, b: 50 }, [{ type: 'cooldehum', params: { t: 14, rh: 90 } }]);
    const st = r.steps[0];
    const adp = st.aux[0].state;
    near(adp.rh, 100, 1e-4, 'ADP verzadigd');
    near((st.end.h - adp.h) / (st.start.h - adp.h), st.info.bf, 1e-6, 'BF');
});

test('adiabatisch bevochtigen: rendement 100 % eindigt op natteboltemperatuur', () => {
    const r = scn({ pair: 't-rh', a: 30, b: 30 }, [{ type: 'adiabatic', params: { mode: 'eff', value: 100 } }]);
    const st = r.steps[0];
    near(st.end.t, st.start.twb, 1e-9, 't = t_nat');
    near(st.end.twb, st.start.twb, 2e-3, 't_nat blijft gelijk');
    near(st.dh, st.dx * P.CP_W * st.start.twb, 1e-6, 'Δh = Δx·c_w·t_nat');
});

test('stoombevochtigen naar RH en met debiet: massabalans', () => {
    const r = scn({ pair: 't-rh', a: 20, b: 20 }, [{ type: 'steam', params: { mode: 'toRH', value: 50, tSteam: 100 } }]);
    near(r.steps[0].end.rh, 50, 1e-6, 'RH');
    const kgph = r.steps[0].water;
    const r2 = scn({ pair: 't-rh', a: 20, b: 20 }, [{ type: 'steam', params: { mode: 'flow', value: kgph, tSteam: 100 } }]);
    near(r2.steps[0].end.x, r.steps[0].end.x, 1e-12, 'zelfde x');
    near(r.steps[0].gamma, P.R0 + P.CP_V * 100, 1e-6, 'Δh/Δx = h_stoom');
});

test('mengen: massa- en energiebalans, ṁ neemt toe', () => {
    const r = scn({ pair: 't-rh', a: -10, b: 90 }, [{ type: 'mix', params: { t2: 22, hum: 'rh', b2: 40, flowMode: 'fraction', flow2: 70 } }]);
    const st = r.steps[0];
    const sb = st.aux[0].state;
    near(st.end.h, 0.3 * st.start.h + 0.7 * sb.h, 1e-9, 'h');
    near(st.end.x, 0.3 * st.start.x + 0.7 * sb.x, 1e-12, 'x');
    near(st.end.mdot, st.start.mdot / 0.3, 1e-9, 'ṁ');
    assert.equal(st.qt, null);
});

test('mengen van twee verzadigde stromen geeft mist', () => {
    const r = scn({ pair: 't-rh', a: 2, b: 100 }, [{ type: 'mix', params: { t2: 30, hum: 'rh', b2: 100, flowMode: 'fraction', flow2: 50 } }]);
    assert.equal(r.steps[0].end.fog, true);
    near(r.steps[0].end.rh, 100, 1e-9, 'RH');
});

test('WTW sensibel en enthalpiewiel', () => {
    const r = scn({ pair: 't-rh', a: -5, b: 80 }, [{ type: 'hr', params: { hrType: 'sensible', eff: 80, tRet: 21, rhRet: 40 } }]);
    near(r.steps[0].end.t, -5 + 0.8 * 26, 1e-9, 't');
    near(r.steps[0].dx, 0, 1e-15, 'x constant');
    const r2 = scn({ pair: 't-rh', a: -5, b: 80 }, [{ type: 'hr', params: { hrType: 'enthalpy', eff: 80, effX: 60, tRet: 21, rhRet: 40 } }]);
    const sr = r2.steps[0].aux[0].state;
    near(r2.steps[0].end.x, r2.steps[0].start.x + 0.6 * (sr.x - r2.steps[0].start.x), 1e-12, 'x');
});

test('ruimtebelasting: Δx = ṁ_w/ṁ en Q_tot klopt', () => {
    const r = scn({ pair: 't-rh', a: 16, b: 60 }, [{ type: 'load', params: { qs: 4, mw: 2 } }]);
    const st = r.steps[0];
    near(st.dx, 2 / 3600 / st.start.mdot, 1e-12, 'Δx');
    near(st.qt, 4 + 2 / 3600 * (P.R0 + P.CP_V * 16), 1e-9, 'Q_tot');
});

test('ventilator: Δh = v·Δp/η', () => {
    const r = scn({ pair: 't-rh', a: 18, b: 50 }, [{ type: 'fan', params: { dp: 800, eff: 60 } }]);
    const st = r.steps[0];
    near(st.dh, st.start.v * 800 / 0.6 / 1000, 1e-9, 'Δh');
    assert.ok(st.dt > 1 && st.dt < 1.3, 'ΔT ~1,1 K');
});

test('sorptie-ontvochtigen: h constant, t stijgt', () => {
    const r = scn({ pair: 't-rh', a: 25, b: 60 }, [{ type: 'desiccant', params: { mode: 'toX', value: 6 } }]);
    const st = r.steps[0];
    near(st.dh, 0, 1e-9, 'h constant');
    assert.ok(st.dt > 0);
});

test('ongeldige stap wordt gemarkeerd en overgeslagen, keten loopt door', () => {
    const r = scn({ pair: 't-rh', a: 20, b: 50 }, [
        { type: 'heat', params: { mode: 'toT', value: 10 } },     // ongeldig: lager dan 20 °C
        { type: 'heat', params: { mode: 'dT', value: 5 } },
        { type: 'heat', params: { mode: 'dT', value: 5 }, enabled: false }
    ]);
    assert.equal(r.steps[0].ok, false);
    assert.equal(r.steps[0].error.code, 'ERR_HEAT_TARGET');
    assert.equal(r.steps[1].ok, true);
    assert.equal(r.steps[2].skipped, true);
    assert.equal(r.states.length, 2);
    near(r.states[1].t, 25, 1e-9, 't');
});

test('elke processtap rekent met standaardwaarden vanuit een passend beginpunt', () => {
    const starts = [[26, 55], [26, 35], [5, 80]];
    for (const type of Object.keys(PR.TYPES)) {
        const ok = starts.some(([a, b]) => {
            const st = scn({ pair: 't-rh', a, b }, [{ type, params: {} }]).steps[0];
            return st.ok && st.path.length >= 2 && st.path.every((q) => isFinite(q.t) && isFinite(q.x) && isFinite(q.h));
        });
        assert.ok(ok, type);
    }
});
