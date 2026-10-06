// EWF-weer: Open-Meteo-mapping (fixture) en foutafhandeling van het ophalen (SPEC §6.2, §12.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/ewf/weather.js');
const M = require('../js/ewf/model.js');
const fixture = require('./fixtures/openmeteo-current-debilt.json');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const okResponse = (json) => ({ ok: true, status: 200, json: async () => json });

test('mapOpenMeteo: fixture De Bilt', () => {
    const w = W.mapOpenMeteo(fixture, { surfAz: 0 });
    near(w.t, 15.7, 1e-12, 't');
    near(w.rh, 92, 1e-12, 'RV');
    near(w.p, 101890, 1e-6, 'p');
    near(w.U10, 1.4, 1e-12, 'U10');
    near(w.ghi, 173, 1e-12, 'GHI');
    near(w.gti, 135.1, 1e-12, 'GTI');
    assert.equal(w.time, '2026-10-06T10:00:00.000Z', 'lokale tijd → UTC');
    near(w.beam + w.diffuse, w.gti, 1, 'beam + diffuus = GTI');
    assert.ok(w.beam > 0 && w.beam < w.dni, 'plausibele beam (zon ≈ 30° hoog, iets oost van zuid)');
    assert.ok(w.diffuse > w.beam, 'bewolkt: diffuus overheerst');
});

test('mapOpenMeteo zonder GTI/DNI: splitsing via Erbs + Hay-Davies', () => {
    const j = JSON.parse(JSON.stringify(fixture));
    delete j.current.global_tilted_irradiance;
    delete j.current.direct_normal_irradiance;
    delete j.current.diffuse_radiation;
    const w = W.mapOpenMeteo(j, { surfAz: 0 });
    assert.equal(w.gti, null);
    assert.ok(w.beam + w.diffuse > 0 && isFinite(w.beam));
});

test('model rekent met gemapt weer; GTI alleen gebruikt bij dezelfde gevelazimut', () => {
    const w = W.mapOpenMeteo(fixture, { surfAz: 0 });
    const r = M.simulate(M.DEFAULTS, w);
    assert.equal(r.rad.method, 'gti');
    near(r.rad.beam, w.beam, 1e-9, 'beam');
    near(r.rad.diffuse, w.diffuse, 1e-9, 'diffuus');
    const r2 = M.simulate(Object.assign({}, M.DEFAULTS, { chimAz: 90 }), w);
    assert.equal(r2.rad.method, 'model', 'andere oriëntatie → Hay-Davies uit DNI/DHI');
});

test('ongeldige respons geeft een WeatherError', () => {
    assert.throws(() => W.mapOpenMeteo({}), { name: 'WeatherError', code: 'parse' });
    assert.throws(() => W.mapOpenMeteo({ current: { time: 'x', temperature_2m: 1, relative_humidity_2m: 50 } }), { code: 'parse' });
});

test('fetchCurrent: URL, KNMI-model, cache 10 min', async () => {
    W.clearCache();
    let calls = 0, url = '';
    const fetchImpl = async (u) => { calls++; url = u; return okResponse(fixture); };
    let now = 1e12;
    const w = await W.fetchCurrent({ fetchImpl, now: () => now });
    assert.match(url, /models=knmi_seamless/);
    assert.match(url, /latitude=52\.10&longitude=5\.18/);
    assert.match(url, /tilt=90&azimuth=0/);
    assert.match(url, /wind_speed_unit=ms/);
    near(w.t, 15.7, 1e-12, 't');
    await W.fetchCurrent({ fetchImpl, now: () => now + 60e3 });
    assert.equal(calls, 1, 'binnen 10 min uit de cache');
    await W.fetchCurrent({ fetchImpl, now: () => now + 11 * 60e3 });
    assert.equal(calls, 2, 'na 10 min opnieuw');
});

test('fetchCurrent: mislukte fetch wordt een afgevangen WeatherError', async () => {
    W.clearCache();
    await assert.rejects(W.fetchCurrent({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { name: 'WeatherError', code: 'network' });
    await assert.rejects(W.fetchCurrent({ fetchImpl: async () => ({ ok: false, status: 503 }) }), { code: 'http' });
    await assert.rejects(W.fetchCurrent({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }) }), { code: 'parse' });
    await assert.rejects(W.fetchCurrent({ fetchImpl: async () => okResponse({ error: true }) }), { code: 'parse' });
});

test('fetchCurrent: time-out breekt het verzoek af', async () => {
    W.clearCache();
    const hang = (u, opts) => new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    await assert.rejects(W.fetchCurrent({ fetchImpl: hang, timeoutMs: 20 }), { code: 'timeout' });
});
