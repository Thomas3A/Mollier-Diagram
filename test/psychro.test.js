// Rekenkern tegen PsychroLib-referentiewaarden (ASHRAE Handbook Fundamentals 2017).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/psychro.js');
const ref = require('./reference.json').points;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);

test('verzadigingsdampdruk en toestand t-RH gelijk aan PsychroLib', () => {
    for (const r of ref) {
        const s = P.fromPair('t-rh', r.t, r.rh, r.p);
        const tag = `t=${r.t} RH=${r.rh} p=${r.p}`;
        near(P.satVapPres(r.t), r.pws, r.pws * 1e-9, `pws ${tag}`);
        near(s.x, r.x, 1e-9, `x ${tag}`);
        near(s.h, r.h, 1e-6, `h ${tag}`);
        near(s.twb, r.twb, 2e-3, `twb ${tag}`);       // PsychroLib-tolerantie 0,001 K
        near(s.tdp, r.tdp, 2e-3, `tdp ${tag}`);
        near(s.v, r.v, 1e-9, `v ${tag}`);
        near(s.rho, r.rho, 1e-9, `rho ${tag}`);
    }
});

test('alle invoerparen geven dezelfde toestand terug (round-trip)', () => {
    for (const p of [101325, 84556]) {
        for (const [t, rh] of [[-15, 70], [0.5, 95], [21, 45], [35, 30], [48, 12]]) {
            const s0 = P.fromPair('t-rh', t, rh, p);
            for (const pair of P.PAIRS) {
                const [a, b] = P.pairValues(pair, s0);
                const s = P.fromPair(pair, a, b, p);
                near(s.t, s0.t, 1e-5, `${pair} t (${t}/${rh})`);
                near(s.x, s0.x, 1e-8, `${pair} x (${t}/${rh})`);
            }
        }
    }
});

test('mistgebied: h en x blijven behouden, RH = 100 %', () => {
    const p = 101325;
    for (const [h, x] of [[40, 0.02], [25, 0.012], [-5, 0.005], [60, 0.03]]) {
        const s = P.fromHx(h, x, p);
        assert.equal(s.fog, true);
        near(s.h, h, 1e-6, 'h');
        near(s.x, x, 1e-12, 'x');
        near(s.rh, 100, 1e-6, 'RH');
        near(s.x - s.xl, s.xs, 1e-12, 'damp = x_s');
    }
});

test('luchtdruk uit hoogte (ASHRAE eq. 3)', () => {
    near(P.pressureFromAltitude(0), 101325, 1e-6, 'zeeniveau');
    near(P.pressureFromAltitude(1000), 89874.6, 1, '1000 m');
    near(P.altitudeFromPressure(P.pressureFromAltitude(1500)), 1500, 1e-6, 'inverse');
});

test('ongeldige invoer geeft foutcode', () => {
    assert.throws(() => P.fromPair('t-rh', 20, 120, 101325), { code: 'ERR_RH_RANGE' });
    assert.throws(() => P.fromPair('t-twb', 20, 25, 101325), { code: 'ERR_TWB_ABOVE_T' });
    assert.throws(() => P.fromPair('t-tdp', 10, 15, 101325), { code: 'ERR_TDP_ABOVE_T' });
    assert.throws(() => P.fromPair('t-x', 20, -0.001, 101325), { code: 'ERR_X_NEGATIVE' });
});
