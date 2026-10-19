// Klimaatdata: vijf referentiejaren, werkelijke jaren 1951–2025 en de jaarberekening van de voorbeeld-LBK.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/psychro.js');
const C = require('../js/lbk/climate.js');
const E = require('../js/lbk/engine.js');
const ref = require('../data/klimaat/referentiejaren.js');
const knmi = require('../data/klimaat/knmi-debilt-1951-2025.js');

const p = 101325;

test('referentiejaren: vijf jaren van 8760 uur, stresstestjaren zonder NEN-maandgemiddelden', () => {
    assert.deepEqual(Object.keys(ref.data), C.REF);
    for (const id of C.REF) {
        for (const v of ['T', 'U']) assert.equal(ref.data[id][v].length, 8760, `${id}.${v}`);
        assert.ok(ref.meta.jaren[id].omschrijving.length > 10);
    }
    assert.equal(ref.meta.jaren.winter1979.maandgemiddelde_T_NEN5060_2018, null);
    assert.equal(ref.meta.jaren.winter1963.maandgemiddelde_T_NEN5060_2018, null);
    assert.equal(ref.meta.startWeekdag, 1);
});

test('werkelijke jaren: 75 jaren, weekdag van 1 januari, aanbevolen stresstestjaren', () => {
    assert.equal(Object.keys(knmi.T).length, 75);
    assert.equal(knmi.meta.startWeekdag['1963'], 2);
    assert.equal(knmi.meta.startWeekdag['1979'], 1);
    assert.deepEqual(knmi.meta.aanbevolen_stresstest, C.RECOMMENDED);
    assert.equal(C.years().length, 75);
    assert.ok(C.isValid('y1951') && C.isValid('y2025') && !C.isValid('y1950') && !C.isValid('foo'));
});

test('get(): temperatuur en vochtgehalte per uur, statistiek klopt met de metadata', async () => {
    const e = await C.get('energie', p);
    assert.equal(e.T.length, 8760);
    const mean = e.T.reduce((a, b) => a + b, 0) / 8760;
    assert.ok(Math.abs(mean - ref.meta.jaren.energie.statistiek.Tgem) < 0.01);
    assert.equal(Math.min(...e.T), ref.meta.jaren.energie.statistiek.Tmin);
    assert.ok(!e.approxX);
    near01(e.x[0], P.xFromTRh(ref.data.energie.T[0] / 10, ref.data.energie.U[0], p));
    const y = await C.get('y1963', p);
    assert.equal(y.startWeekday, 2);
    assert.ok(y.approxX);
    for (let i = 0; i < 8760; i++) assert.ok(y.x[i] <= P.satHumRatio(y.T[i], p) + 1e-12);
    assert.equal(C.monthOfHour[0], 0);
    assert.equal(C.monthOfHour[8759], 11);
    assert.equal(C.monthOfHour[31 * 24], 1);
});

function near01(a, b) { assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`); }

test('voorbeeld-LBK over het energiejaar en T1: plausibele jaarcijfers, strengere winter kost meer', async () => {
    const u = E.exampleUnit();
    const cfg = { p, schedule: E.defaultSchedule() };
    const ye = E.simulateYear(u, await C.get('energie', p), cfg);
    const y1 = E.simulateYear(u, await C.get('T1', p), cfg);
    assert.equal(ye.total.hoursOn, 2349);
    assert.ok(ye.total.heat > 0 && ye.total.cool > 0 && ye.total.steam > 0);
    assert.ok(y1.total.heat > ye.total.heat, 'T1 meer warmte');
    assert.ok(y1.total.steam > ye.total.steam, 'T1 meer bevochtiging');
    // Som over de maanden = jaartotaal; piek koeling begrensd op de capaciteit (60 kW)
    const sum = ye.months.reduce((a, m) => a + m.cool, 0);
    assert.ok(Math.abs(sum - ye.total.cool) < 1e-6);
    assert.ok(ye.peaks.cool <= 60 + 1e-9);
    // Winter: geen koeling; zomer: geen bevochtiging
    assert.equal(ye.months[0].cool, 0);
    assert.equal(ye.months[6].steam, 0);
});
