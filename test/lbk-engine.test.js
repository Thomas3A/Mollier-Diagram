// LBK-rekenkern: regeling per component, energiebalansen, capaciteitsgrenzen en jaarberekening.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/psychro.js');
const E = require('../js/lbk/engine.js');

const p = 101325;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const outdoor = (t, rh) => ({ t, x: P.xFromTRh(t, rh, p) });
const unit = (comps, ret = [], sup = {}, mode = 'design') => {
    const u = E.defaultUnit(mode, 'test');
    Object.assign(u.sup, sup);
    u.comps = comps;
    u.retComps = ret;
    return E.normalizeUnit(u);
};
const run = (u, out, o) => E.step(E.compile(u, p), out, o);
const comp = (r, type) => r.comps[Object.keys(r.comps).find((id) => r.comps[id].type === type)];

test('verwarmer: Q = ṁ·Δh met ṁ = V·1,2/3600, toevoer precies op setpoint', () => {
    const u = unit([E.makeComp('heater')], [], { mode: 'const', t: 20 });
    const r = run(u, outdoor(0, 80));
    near(r.supply.t, 20, 1e-9, 't toevoer');
    near(r.m, 10000 / 3600 * 1.2, 1e-12, 'ṁ');
    near(comp(r, 'heater').q, r.m * (r.supply.h - r.out.h), 1e-9, 'Q');
    near(r.sums.heat, comp(r, 'heater').q, 1e-12, 'som');
});

test('ventilator: P = q_v·Δp/η, deellast P ∝ f^n, warmte komt in de lucht', () => {
    const fan = E.makeComp('fan', { dpExt: 400, eta: 50, n: 2 });
    const u = unit([E.makeComp('filter', { dp: 100 }), fan]);
    const s = E.summary(u, p);
    near(s.fanSup, 10000 / 3600 * 500 / 0.5 / 1000, 1e-9, 'P ontwerp');
    const r = run(u, outdoor(10, 50), { f: 0.5 });
    near(r.fanSup, s.fanSup * 0.25, 1e-9, 'P bij 50 %');
    near(r.supply.h - r.out.h, r.fanSup / r.m, 1e-9, 'Δh = P/ṁ');
    near(s.sfpSup, 1, 1e-12, 'SFP');
    assert.equal(E.sfpClass(s.sfpSup), 3);
    assert.equal(E.sfpClass(2.2), 5);
});

test('ventilatoropwarming wordt door de verwarmer ervóór gecompenseerd', () => {
    const u = unit([E.makeComp('heater'), E.makeComp('fan', { dpExt: 800 })], [], { mode: 'const', t: 18 });
    const r = run(u, outdoor(-5, 90));
    near(r.supply.t, 18, 1e-6, 't toevoer');
    assert.ok(comp(r, 'heater').tOut < 18);
});

test('capaciteitsgrens alleen bij een bestaande LBK', () => {
    const comps = [E.makeComp('heater', { qMax: 10 })];
    const ex = run(unit(comps, [], {}, 'existing'), outdoor(-10, 90));
    near(comp(ex, 'heater').q, 10, 1e-9, 'begrensd');
    assert.ok(comp(ex, 'heater').capped);
    assert.ok(ex.unmet.tLow);
    const de = run(unit(comps, [], {}, 'design'), outdoor(-10, 90));
    assert.ok(comp(de, 'heater').q > 10 && !de.unmet.tLow);
});

test('platenwisselaar: rendement, modulatie en vorstbeveiliging op de afvoertemperatuur', () => {
    const hr = E.makeComp('hr', { kind: 'plate', eta: 75, frost: 1 });
    const u = unit([hr, E.makeComp('heater')], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 20 });
    // Mild: volledig rendement zonder vorst
    let r = run(u, outdoor(5, 80));
    near(r.comps[hr.id].phi, 1, 1e-12, 'φ');
    near(r.points[0].t, 5 + 0.75 * (r.retFan.t - 5), 1e-9, 't na WTW');
    near(r.retFan.t, 21 + 3 * 5 / 20, 1e-12, 'retourtemperatuur volgt de buitentemperatuur');
    // Streng: rendement terug tot de droge afvoertemperatuur 1 °C is
    r = run(u, outdoor(-10, 90));
    assert.ok(r.comps[hr.id].frost);
    const c = r.comps[hr.id];
    const cpS = P.CP_DA + P.CP_V * r.out.x, cpE = P.CP_DA + P.CP_V * r.retFan.x;
    near(r.retFan.t - cpS * (r.points[0].t - r.out.t) / cpE, 1, 1e-6, 'droge afvoertemperatuur');
    assert.ok(c.eta < 75);
    // Geen warmtevraag (buiten tussen setpoint en retour): bypass
    r = run(unit([hr], [], { mode: 'const', t: 18 }), outdoor(19, 50));
    near(r.comps[hr.id].phi, 0, 1e-12, 'bypass');
});

test('koeler: ontvochtigen tot x_max via ADP en bypassfactor, naverwarmer haalt het setpoint', () => {
    const cool = E.makeComp('cooler', { bf: 0.1, adpMin: 5 });
    const u = unit([cool, E.makeComp('heater')], [], { mode: 'const', t: 18, xMaxOn: true, xMax: 9 });
    const r = run(u, outdoor(30, 50));
    near(r.supply.x * 1000, 9, 1e-6, 'x toevoer');
    near(r.supply.t, 18, 1e-6, 't toevoer');
    const c = r.comps[cool.id];
    // Uittrede ligt op de lijn intrede → ADP: (s2 − ADP) = BF·(s1 − ADP)
    const xa = P.satHumRatio(c.adp, p);
    near(r.points[0].t - c.adp, 0.1 * (30 - c.adp), 1e-9, 't-lijn');
    near(r.points[0].x - xa, 0.1 * (r.out.x - xa), 1e-12, 'x-lijn');
    // Energiebalans met condensaat: Q = ṁ·[(h1 − h2) − (x1 − x2)·h_w(t2)]
    near(-c.q, r.m * ((r.out.h - r.points[0].h) - (r.out.x - r.points[0].x) * P.CP_W * r.points[0].t), 1e-9, 'Q koeler');
    near(r.sums.cond, r.m * (r.out.x - r.points[0].x) * 3600, 1e-9, 'condensaat');
});

test('koeler zonder ontvochtigingseis koelt droog zolang het ADP boven het dauwpunt ligt', () => {
    const u = unit([E.makeComp('cooler', { bf: 0.15 })], [], { mode: 'const', t: 20 });
    const r = run(u, outdoor(26, 40));
    near(r.supply.t, 20, 1e-9, 't');
    near(r.supply.x, r.out.x, 1e-15, 'x constant');
});

test('min. ADP begrenst de ontvochtiging (hoge koudwatertemperatuur)', () => {
    const u = unit([E.makeComp('cooler', { adpMin: 15 }), E.makeComp('heater')], [], { mode: 'const', t: 18, xMaxOn: true, xMax: 9 });
    const r = run(u, outdoor(28, 60));
    assert.ok(r.unmet.xHigh, 'x_max niet gehaald');
    assert.ok(comp(r, 'cooler').adp >= 15 - 1e-9);
});

test('stoombevochtiger: x_min exact, Δh/Δx = h_stoom, temperatuur van de stoom verrekend', () => {
    const hum = E.makeComp('humid', { kind: 'steam' });
    const u = unit([E.makeComp('heater'), hum, E.makeComp('fan')], [], { mode: 'const', t: 20, xMinOn: true, xMin: 7 });
    const r = run(u, outdoor(-5, 80));
    near(r.supply.x * 1000, 7, 1e-9, 'x');
    near(r.supply.t, 20, 0.02, 't (stoomopwarming vooraf meegenomen)');
    const c = r.comps[hum.id], i = r.points.findIndex((q) => q.id === hum.id);
    near((r.points[i].h - r.points[i - 1].h) / (r.points[i].x - r.points[i - 1].x), E.H_STEAM, 1e-6, 'Δh/Δx');
    near(c.water, r.m * (r.points[i].x - r.points[i - 1].x) * 3600, 1e-9, 'kg/h');
});

test('adiabatische bevochtiger: voorverwarmer verwarmt tot de isenthalp van het doel', () => {
    const u = unit([E.makeComp('heater', { role: 'pre', tSet: 5 }), E.makeComp('humid', { kind: 'adiabatic', eta: 90 }), E.makeComp('heater'), E.makeComp('fan')], [],
        { mode: 'const', t: 20, xMinOn: true, xMin: 6 });
    const r = run(u, outdoor(-10, 90));
    near(r.supply.x * 1000, 6, 1e-6, 'x');
    near(r.supply.t, 20, 1e-6, 't');
    // Naverwarmer hoeft niets meer te doen
    const heaters = Object.values(r.comps).filter((c) => c.type === 'heater');
    near(heaters[1].q, 0, 1e-9, 'naverwarmer');
    assert.ok(heaters[0].tOut > 25);
});

test('adiabatische bevochtiger met laag rendement haalt x_min niet', () => {
    const u = unit([E.makeComp('heater'), E.makeComp('humid', { kind: 'adiabatic', eta: 20 })], [], { mode: 'const', t: 20, xMinOn: true, xMin: 8 });
    const r = run(u, outdoor(-10, 90));
    // Voorverwarmen tot max. 50 °C; daarmee lukt 8 g/kg niet bij 20 % rendement
    assert.ok(r.unmet.xLow);
});

test('regelende mengkamer: maximaal recirculeren bij warmtevraag, buitenlucht als die gunstig is', () => {
    const mix = E.makeComp('mix', { ctrl: 'econ', share: 60 });
    const u = unit([mix, E.makeComp('heater')], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 18 });
    let r = run(u, outdoor(-5, 80));
    near(r.comps[mix.id].share, 0.6, 1e-9, 'max recirculatie');
    r = run(u, outdoor(14, 60));
    // Zonder ventilatoropwarming na de mengkamer: menging precies tot 18 °C
    near(r.supply.t, 18, 0.02, 't');
    assert.ok(r.comps[mix.id].share > 0 && r.comps[mix.id].share < 0.6);
    r = run(u, outdoor(18, 50));
    near(r.comps[mix.id].share, 0, 1e-12, 'gratis koeling: 100 % buitenlucht');
});

test('mengkamer vast: massabalans en minder buitenlucht door de WTW', () => {
    const mix = E.makeComp('mix', { share: 25 });
    const hr = E.makeComp('hr', { eta: 70, frost: -30 });
    const u = unit([hr, mix], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 30 });
    const r = run(u, outdoor(0, 80));
    const before = r.points[0], after = r.points[1];
    near(after.h, 0.75 * before.h + 0.25 * r.retFan.h, 1e-9, 'h meng');
    near(r.comps[hr.id].m, r.m * 0.75, 1e-12, 'ṁ door WTW');
});

test('sorptiewiel: vochtterugwinning in de winter', () => {
    const hr = E.makeComp('hr', { kind: 'sorption' });
    assert.equal(hr.etaX, 70);
    const u = unit([hr], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 30 });
    const r = run(u, outdoor(-5, 80));
    // Vaste punt: x_toe = x_buiten + η_x·(x_toe + Δx_ruimte − x_buiten) → x_toe − x_buiten = η_x·Δx/(1 − η_x)
    near((r.supply.x - r.out.x) * 1000, 0.7 * 1 / 0.3, 1e-4, 'Δx');
});

test('indirect adiabatisch koelen verlaagt de toevoertemperatuur en verbruikt water', () => {
    const base = unit([E.makeComp('hr', { kind: 'plate' })], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 16 });
    const iec = unit([E.makeComp('hr', { kind: 'plate', iec: true, iecEta: 85 })], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 16 });
    const a = run(base, outdoor(30, 40)), b = run(iec, outdoor(30, 40));
    assert.ok(b.supply.t < a.supply.t - 3);
    assert.ok(b.sums.iecKg > 0);
});

test('bedrijfsmodi: eco verwarmt alleen tot de minimumtemperatuur, nachtventilatie behandelt niet', () => {
    const u = unit([E.makeComp('hr'), E.makeComp('cooler'), E.makeComp('heater'), E.makeComp('fan')], [E.makeComp('fan', {}, 'ret')], { mode: 'const', t: 20 });
    u.ops.ecoT = 12;
    const eco = run(u, outdoor(0, 90), { mode: 'eco', occ: 0, f: 0.3 });
    near(comp(eco, 'hr').phi, 1, 1e-12, 'WTW werkt volledig');
    near(comp(eco, 'heater').q, 0, 1e-12, 'verwarmer niet nodig boven 12 °C');
    near(comp(eco, 'cooler').q, 0, 1e-12, 'geen koeling');
    const cold = run(unit([E.makeComp('heater'), E.makeComp('fan')], [], { mode: 'const', t: 20 }), outdoor(-10, 90), { mode: 'eco', occ: 0, f: 0.3 });
    near(cold.supply.t, 14, 1e-6, 'eco: verwarmen tot de standaard minimumtemperatuur 14 °C');
    const night = run(u, outdoor(16, 70), { mode: 'night', occ: 0, f: 1 });
    near(night.sums.heat + night.sums.cool + night.sums.recovered, 0, 1e-12, 'geen behandeling');
    assert.ok(night.fanSup > 0);
});

test('adviezen: ontbrekende componenten en naverwarmer', () => {
    let u = unit([E.makeComp('cooler')], [], { xMaxOn: true });
    let w = E.check(u, E.designPoints(u, p)).map((x) => x.code);
    assert.ok(w.includes('noFan') && w.includes('noReheat') && w.includes('noHeater'));
    u = E.normalizeUnit(Object.assign(E.defaultUnit('design'), { sup: Object.assign(E.defaultUnit().sup, { xMinOn: true, xMaxOn: true }) }));
    Object.assign(u, E.propose(u));
    w = E.check(u, E.designPoints(u, p));
    assert.deepEqual(w.filter((x) => x.level === 'warn'), []);
});

test('normalisatie: begrenzing, één WTW, onbekende types eruit', () => {
    const u = E.normalizeUnit({
        flow: -5, comps: [{ type: 'hr', eta: 400 }, { type: 'hr' }, { type: 'bogus' }, { type: 'fan', pos: 'before' }],
        retComps: [{ type: 'heater' }, { type: 'fan', pos: 'before' }]
    });
    assert.equal(u.flow, 50);
    assert.equal(u.comps.filter((c) => c.type === 'hr').length, 1);
    assert.equal(u.comps[0].eta, 95);
    assert.equal(u.comps.length, 2);
    assert.equal(u.retComps.length, 1);
    assert.equal(u.retComps[0].pos, 'before');
    const st = E.normalizeState({ units: [u, u], energy: { schedule: 'x', climate: 'y1979' } });
    assert.equal(st.units.length, 2);
    assert.notEqual(st.units[0].id, st.units[1].id);
    assert.equal(st.energy.climate, 'y1979');
    assert.equal(st.energy.schedule[0][8], 80);
});

test('weekpatroon: standaard werkweek 8–17 uur met 80 %, 45 uur per week', () => {
    const s = E.defaultSchedule();
    const st = E.scheduleStats(s, 1);
    assert.equal(st.hours, 45);
    near(st.mean, 80, 1e-12, 'bezetting');
    assert.equal(st.year, 52 * 45 + 9);         // 365 dagen = 52 weken + 1 maandag
    assert.equal(E.scheduleStats(s, 6).year, 52 * 45);   // begint op zaterdag: extra dag is een zaterdag
});

test('jaarberekening: bedrijfsuren volgen het weekpatroon en de weekdag van 1 januari', () => {
    const u = E.exampleUnit();
    const T = new Float64Array(8760).fill(5), x = new Float64Array(8760).fill(P.xFromTRh(5, 80, p));
    const y = E.simulateYear(u, { T, x, startWeekday: 1 }, { p, schedule: E.defaultSchedule() });
    assert.equal(y.total.hoursOn, 2349);
    assert.equal(y.total.hoursOcc, 2349);
    // Constante buitenlucht: elk bedrijfsuur hetzelfde → jaar = uren × uurwaarde
    const h = E.step(E.compile(u, p), { t: 5, x: x[0] }, { f: 0.8, occ: 0.8 });
    near(y.total.heat, 2349 * h.sums.heat, 1e-6, 'warmte');
    near(y.total.fanSup + y.total.fanRet, 2349 * (h.fanSup + h.fanRet), 1e-6, 'ventilatoren');
    assert.equal(y.months.reduce((a, m) => a + m.hoursOn, 0), 2349);
    // CAV: altijd 100 % debiet
    u.ops.control = 'cav';
    const yc = E.simulateYear(u, { T, x, startWeekday: 1 }, { p, schedule: E.defaultSchedule() });
    near(yc.total.fanSup / y.total.fanSup, 1 / 0.64, 1e-9, 'n = 2');
});

test('jaarberekening: buiten kantooruren basisventilatie of uit', () => {
    const u = E.exampleUnit();
    const T = new Float64Array(8760).fill(0), x = new Float64Array(8760).fill(P.xFromTRh(0, 80, p));
    const clim = { T, x, startWeekday: 1 };
    const off = E.simulateYear(u, clim, { p, schedule: E.defaultSchedule() });
    u.ops.off = 'vent';
    u.ops.offFlow = 30;
    const vent = E.simulateYear(u, clim, { p, schedule: E.defaultSchedule() });
    assert.equal(vent.total.hoursOn, 8760);
    assert.ok(vent.total.heat > off.total.heat && vent.total.fanSup > off.total.fanSup);
    u.ops.off = 'eco';
    const eco = E.simulateYear(u, clim, { p, schedule: E.defaultSchedule() });
    assert.ok(eco.total.steam < vent.total.steam, 'eco bevochtigt niet');
});

test('eindenergie: gasketel, warmtepomp, koelmachine, stoom en kosten', () => {
    const t = { heat: 9769, cool: 4500, steam: 950, humidKg: 1000, iecKg: 0, fanSup: 1000, fanRet: 500 };
    const tar = { elec: 0.3, gas: 1.2, heat: 40, water: 2 };
    let f = E.finalEnergy(t, { heat: 'boiler', etaHeat: 100, seer: 4.5, steam: 'elec', etaSteam: 95 }, tar);
    near(f.parts.heat.gas, 9769 / E.GAS_KWH, 1e-9, 'm³ gas');
    near(f.parts.cool.elec, 1000, 1e-9, 'koeling');
    near(f.parts.humid.elec, 1000, 1e-9, 'stoom');
    near(f.parts.humid.water, 1, 1e-12, 'water');
    near(f.sum.elec, 1000 + 1000 + 1500, 1e-9, 'elektriciteit');
    near(f.sum.cost, f.sum.elec * 0.3 + f.sum.gas * 1.2 + 2, 1e-9, 'kosten');
    f = E.finalEnergy(t, { heat: 'hp', scop: 4, seer: 4.5, steam: 'gas', etaSteam: 100 }, tar);
    near(f.parts.heat.elec, 9769 / 4, 1e-9, 'warmtepomp');
    near(f.parts.humid.gas, 950 / E.GAS_KWH, 1e-9, 'gasgestookte stoom');
});
