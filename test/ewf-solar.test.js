// EWF-zon: zonnestand (NOAA), Erbs-splitsing en Hay-Davies-transpositie (SPEC §6.4, §12.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/ewf/solar.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (tol ${tol})`);
const LAT = 52.10, LON = 5.18;

test('zonnestand De Bilt 21-06 en 21-12 om 12:00 UTC', () => {
    const jun = S.sunPosition('2026-06-21T12:00:00Z', LAT, LON);
    near(jun.alt, 61.1, 0.5, 'hoogte 21-06');
    near(jun.az, 9, 1.5, 'azimut 21-06 (west van zuid)');
    assert.equal(jun.doy, 172);
    const dec = S.sunPosition('2026-12-21T12:00:00Z', LAT, LON);
    near(dec.alt, 14.3, 0.5, 'hoogte 21-12');
});

test('ware middag: uurhoek 0 → azimut 0', () => {
    for (const doy of [80, 172, 355]) {
        const h = S.solarNoonUTC(doy, LON);
        near(S.sunPositionDoy(LAT, LON, h, doy).az, 0, 0.05, `doy ${doy}`);
    }
});

test('dag van het jaar en UTC-uur', () => {
    assert.deepEqual(S.dayAndHour('2019-07-25T13:30:00Z'), { doy: 206, hour: 13.5 });
    assert.deepEqual(S.dayAndHour('2020-12-31T00:00:00Z'), { doy: 366, hour: 0 });
});

test('Erbs: grenzen van de helderheidsindex', () => {
    near(S.erbs(0), 1, 1e-12, 'k_t = 0');
    near(S.erbs(0.22), 1 - 0.09 * 0.22, 1e-12, 'k_t = 0,22 (lineair deel)');
    near(S.erbs(0.8), 0.9511 - 0.1604 * 0.8 + 4.388 * 0.64 - 16.638 * 0.512 + 12.336 * 0.4096, 1e-12, 'k_t = 0,8');
    assert.equal(S.erbs(0.95), 0.165);
    // Continu rond de knikpunten
    near(S.erbs(0.2199), S.erbs(0.2201), 0.01, 'continu bij 0,22');
    near(S.erbs(0.7999), S.erbs(0.8001), 0.02, 'continu bij 0,8');
    // k_t wordt op 0,8 begrensd
    const r = S.onSurface({ ghi: 1300, alt: 30, az: 0, doy: 172, surfAz: 0 });
    near(r.kt, 0.8, 1e-12, 'k_t ≤ 0,8');
});

test('Hay-Davies: vlak loodrecht op de zon bij helder weer → beam ≈ DNI', () => {
    const alt = 50, az = 20, doy = 172;
    const dni = 850, dhi = 60;
    const ghi = dhi + dni * Math.sin(alt * Math.PI / 180);
    const r = S.onSurface({ ghi, dni, dhi, alt, az, doy, surfAz: az, tilt: 90 - alt });
    near(r.theta, 0, 1e-6, 'invalshoek');
    // beam omvat de circumsolaire component: DNI + DHI·A_i/sin α
    const Ai = dni / S.extraterrestrial(doy);
    near(r.beam, dni + dhi * Ai / Math.sin(alt * Math.PI / 180), 1e-9, 'beam = DNI + circumsolair');
    assert.ok(Math.abs(r.beam - dni) / dni < 0.1, 'beam ≈ DNI');
});

test('lage zon (< 5°) en nacht: alles diffuus of nul', () => {
    const low = S.onSurface({ ghi: 40, alt: 3, az: -60, doy: 80, surfAz: 0 });
    assert.equal(low.beam, 0);
    near(low.diffuse, 40 * (0.5 + 0.2 * 0.5), 1e-9, 'isotroop + grond');
    const night = S.onSurface({ ghi: 0, alt: -10, az: 0, doy: 80 });
    assert.equal(night.beam + night.diffuse, 0);
});

test('zon achter de gevel: geen directe straling op het glas', () => {
    const r = S.onSurface({ ghi: 600, alt: 40, az: 0, doy: 172, surfAz: 180 });   // noordgevel, zon in het zuiden
    near(r.theta, 90, 1e-9, 'invalshoek');
    assert.equal(r.beam, 0);
    assert.ok(r.diffuse > 0);
});
