/**
 * processes.js — luchtbehandelingsprocessen en scenario-doorrekening
 *
 * Elke processtap is parametrisch: { type, params }. apply() geeft de eindtoestand,
 * het te tekenen pad (lijst {t, x, h}) en hulppunten (ADP, tweede luchtstroom, ...);
 * drain = true betekent dat onttrokken water als condensaat (water/ijs bij t2) afvloeit.
 * Invoer in UI-eenheden: x in g/kg, RH in %, vermogen in kW, water in kg/h.
 * De droge-luchtmassastroom ṁ [kg/s] blijft constant, behalve bij mengen.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./psychro.js'), require('./ewf/physics.js'));
    else root.Processes = factory(root.Psychro, root.EwfPhysics);
})(typeof self !== 'undefined' ? self : this, function (P, PH) {
    'use strict';

    const { PsychroError } = P;
    const fail = (code, data) => { throw new PsychroError(code, data); };
    const G = 1000; // g/kg ↔ kg/kg

    // ---- Hulpfuncties ----
    const pt = (s) => ({ t: s.t, x: s.x, h: s.h });
    const satState = (t, p) => P.state(t, P.satHumRatio(t, p), p);

    /** Punt op de rechte (h, x)-lijn tussen a (f = 0) en b (f = 1). */
    const lerpState = (a, b, f, p) => P.fromHx(a.h + f * (b.h - a.h), a.x + f * (b.x - a.x), p);

    /** Rechte lijn in (h, x) — recht in het Mollier-diagram, bijna recht in het psychrometrisch diagram. */
    function line(a, b, p, n = 8) {
        const pts = [pt(a)];
        for (let i = 1; i < n; i++) {
            try { pts.push(pt(lerpState(a, b, i / n, p))); } catch (e) { /* buiten bereik: overslaan */ }
        }
        pts.push(pt(b));
        return pts;
    }

    /** Koelpad: bij constante x tot het dauwpunt, daarna langs de verzadigingslijn. */
    function coolPath(a, b, p) {
        const tdp = a.fog ? a.t : a.tdp;
        if (b.t >= tdp - 1e-9) return line(a, b, p, 2);
        const sd = satState(tdp, p);
        const pts = a.fog ? [pt(a)] : [pt(a), pt(sd)];
        const n = Math.max(4, Math.ceil((tdp - b.t) / 0.5));
        for (let i = 1; i <= n; i++) pts.push(pt(satState(tdp + (b.t - tdp) * i / n, p)));
        return pts;
    }

    /** Koel naar t2: droog zolang boven het dauwpunt, anders verzadigd met condensatie. */
    function coolTo(s, t2, p) {
        const tdp = s.fog ? s.t : s.tdp;
        return t2 >= tdp ? P.state(t2, s.fog ? s.xs : s.x, p) : satState(t2, p);
    }

    /** Voeg Δx water toe met richting γ = Δh/Δx [kJ/kg] (stoom, water). */
    const addWater = (s, dx, gamma, p) => P.fromHx(s.h + dx * gamma, s.x + dx, p);

    /** Zoek de verzadigingslijn op het verlengde van a → b (voorbij b). Geeft f of null. */
    function saturationOnLine(a, b, p) {
        const g = (f) => {
            const h = a.h + f * (b.h - a.h), x = a.x + f * (b.x - a.x);
            if (x < 0) return NaN;
            const t = P.tFromHx(h, x);
            if (t < P.T_LO) return NaN;
            return x - P.satHumRatio(t, p);
        };
        if (b.rh >= 99.99 || b.fog) return 1;
        let prev = 1;
        for (let f = 1.1; f < 60; f *= 1.15) {
            const v = g(f);
            if (!isFinite(v)) return null;
            if (v >= 0) return P.solve(g, prev, f, 0);
            prev = f;
        }
        return null;
    }

    const needFlow = (mdot) => { if (!(mdot > 0)) fail('ERR_NEED_FLOW'); };
    const positive = (v) => { if (!(v > 0)) fail('ERR_POSITIVE'); return v; };

    // ---- Procescatalogus ----
    const opt = (key, options, def) => ({ key, type: 'select', options, def });
    const num = (key, unit, def, extra) => Object.assign({ key, type: 'num', unit, def }, extra || {});
    const byMode = (map, modeKey = 'mode') => (prm) => map[prm[modeKey]];

    const PAIR_UNITS = { t: '°C', rh: '%', x: 'g/kg', h: 'kJ/kg', twb: '°C', tdp: '°C' };
    const PAIR_DEFAULTS = { t: 20, rh: 50, x: 7, h: 38, twb: 14, tdp: 9 };
    const pairQ = (prm, i) => (prm.pair || 't-rh').split('-')[i];

    const TYPES = {
        heat: {
            cat: 'heat', kind: 'heat',
            fields: [
                opt('mode', ['toT', 'dT', 'power', 'toH', 'toRH'], 'toT'),
                num('value', byMode({ toT: '°C', dT: 'K', power: 'kW', toH: 'kJ/kg', toRH: '%' }),
                    byMode({ toT: 22, dT: 10, power: 10, toH: 45, toRH: 40 }))
            ],
            apply(s, prm, { p, mdot }) {
                const v = prm.value;
                let s2;
                switch (prm.mode) {
                    case 'toT':
                        if (!(v > s.t)) fail('ERR_HEAT_TARGET');
                        s2 = P.state(v, s.x, p); break;
                    case 'dT':
                        s2 = P.state(s.t + positive(v), s.x, p); break;
                    case 'power':
                        needFlow(mdot);
                        s2 = P.fromHx(s.h + positive(v) / mdot, s.x, p); break;
                    case 'toH':
                        if (!(v > s.h)) fail('ERR_HEAT_TARGET');
                        s2 = P.fromHx(v, s.x, p); break;
                    case 'toRH':
                        if (s.fog || !(v < s.rh && v > 0)) fail('ERR_HEAT_RH');
                        s2 = P.state(P.tFromSatPres(s.pw / (v / 100)), s.x, p); break;
                    default: fail('ERR_INVALID');
                }
                return { state: s2, path: line(s, s2, p, 2) };
            }
        },

        cool: {
            cat: 'cool', kind: 'cool',
            fields: [
                opt('mode', ['toT', 'dT', 'power', 'toRH'], 'toT'),
                num('value', byMode({ toT: '°C', dT: 'K', power: 'kW', toRH: '%' }),
                    byMode({ toT: 14, dT: 8, power: 5, toRH: 90 }))
            ],
            apply(s, prm, { p, mdot }) {
                const v = prm.value;
                let s2;
                switch (prm.mode) {
                    case 'toT': s2 = coolTo(s, v, p); break;
                    case 'dT': s2 = coolTo(s, s.t - positive(v), p); break;
                    case 'toRH':
                        if (s.fog || !(v > s.rh && v <= 100)) fail('ERR_COOL_RH');
                        s2 = P.state(P.tFromSatPres(s.pw / (v / 100)), s.x, p); break;
                    case 'power': {
                        needFlow(mdot);
                        // Q = ṁ·[(h1 − h2) − (x1 − x2)·h_w(t2)]; boven het dauwpunt is er geen condensaat
                        const target = s.h - positive(v) / mdot;
                        const tdp = s.fog ? s.t : s.tdp;
                        const hd = s.fog ? s.h : P.enthalpy(tdp, s.x);
                        if (target >= hd) s2 = P.fromHx(target, s.x, p);
                        else {
                            const g = (t) => P.hSat(t, p) + (s.x - P.satHumRatio(t, p)) * P.hCondensed(t);
                            const t2 = P.solve(g, P.T_LO, tdp, target);
                            if (!isFinite(t2)) fail('ERR_NO_SOLUTION');
                            s2 = satState(t2, p);
                        }
                        break;
                    }
                    default: fail('ERR_INVALID');
                }
                if (!(s2.t < s.t)) fail('ERR_COOL_TARGET');
                return { state: s2, path: coolPath(s, s2, p), drain: true };
            }
        },

        coil: {
            cat: 'cool', kind: 'cool',
            fields: [
                num('tAdp', '°C', 8),
                opt('mode', ['bf', 'toT'], 'bf'),
                num('value', byMode({ bf: '–', toT: '°C' }), byMode({ bf: 0.15, toT: 14 }))
            ],
            apply(s, prm, { p }) {
                const tA = prm.tAdp;
                if (!(tA < s.t)) fail('ERR_ADP_HIGH');
                const sA = satState(tA, p);
                const dry = sA.x >= s.x;          // oppervlak boven dauwpunt: geen condensatie
                let bf;
                if (prm.mode === 'toT') {
                    const t2 = prm.value;
                    if (!(t2 > tA && t2 < s.t)) fail('ERR_COIL_T');
                    bf = dry ? (t2 - tA) / (s.t - tA) : P.solve((f) => lerpState(sA, s, f, p).t, 0, 1, t2);
                } else {
                    bf = prm.value;
                    if (!(bf >= 0 && bf < 1)) fail('ERR_BF_RANGE');
                }
                let s2 = dry ? P.state(tA + bf * (s.t - tA), s.x, p) : lerpState(sA, s, bf, p);
                const path = dry ? line(s, s2, p, 2) : line(s, s2, p);
                if (s2.fog) {
                    // Zeer vochtige intrede: de rechte lijn naar het ADP loopt door het mistgebied.
                    // De druppels slaan neer op de lamellen en verlaten de batterij als condensaat;
                    // de lucht treedt verzadigd uit bij dezelfde t (koellast blijft gelijk).
                    s2 = satState(s2.t, p);
                    path.push(pt(s2));
                }
                return {
                    state: s2, path, drain: true,
                    aux: [{ role: 'adp', state: sA, from: dry ? null : s2 }],
                    info: { bf, tAdp: tA, dry }
                };
            }
        },

        cooldehum: {
            cat: 'cool', kind: 'cool',
            fields: [num('t', '°C', 14), num('rh', '%', 90)],
            apply(s, prm, { p }) {
                const s2 = P.fromPair('t-rh', prm.t, prm.rh, p);
                if (!(s2.t < s.t)) fail('ERR_COOL_TARGET');
                if (s2.x > s.x + 1e-9) fail('ERR_DEHUM_X');
                // Verleng de proceslijn tot de verzadigingslijn: apparaatdauwpunt (ADP)
                const f = s2.x < s.x - 1e-9 ? saturationOnLine(s, s2, p) : null;
                let aux = [], info = {};
                if (f != null && isFinite(f)) {
                    const sA = f === 1 ? s2 : lerpState(s, s2, f, p);
                    aux = [{ role: 'adp', state: sA, from: s2 }];
                    info = { bf: (f - 1) / f, tAdp: sA.t };
                }
                return { state: s2, path: line(s, s2, p), aux, info, drain: true };
            }
        },

        adiabatic: {
            cat: 'humidify', kind: 'humid',
            fields: [
                opt('mode', ['eff', 'toRH', 'toX', 'toT'], 'eff'),
                num('value', byMode({ eff: '%', toRH: '%', toX: 'g/kg', toT: '°C' }),
                    byMode({ eff: 85, toRH: 80, toX: 10, toT: 18 }))
            ],
            apply(s, prm, { p }) {
                if (s.fog || s.rh >= 99.9) fail('ERR_ALREADY_SAT');
                // Adiabatische verzadigingslijn: van s naar het verzadigde punt op t_nat
                const sw = satState(s.twb, p);
                const v = prm.value;
                let f;
                switch (prm.mode) {
                    case 'eff':
                        if (!(v > 0 && v <= 100)) fail('ERR_EFF_RANGE');
                        f = v / 100; break;
                    case 'toX':
                        f = (v / G - s.x) / (sw.x - s.x);
                        if (!(f > 0 && f <= 1 + 1e-9)) fail('ERR_ADIA_X', { max: sw.x * G });
                        break;
                    case 'toRH':
                        if (!(v > s.rh && v <= 100)) fail('ERR_HUMID_RH');
                        f = P.solve((ff) => lerpState(s, sw, ff, p).rh, 0, 1, v); break;
                    case 'toT':
                        if (!(v < s.t && v >= s.twb - 1e-9)) fail('ERR_ADIA_T', { min: s.twb });
                        f = P.solve((ff) => -lerpState(s, sw, ff, p).t, 0, 1, -v); break;
                    default: fail('ERR_INVALID');
                }
                if (!isFinite(f)) fail('ERR_NO_SOLUTION');
                const s2 = f >= 1 ? sw : lerpState(s, sw, f, p);
                return {
                    state: s2, path: line(s, s2, p, 2),
                    aux: f < 0.999 ? [{ role: 'wb', state: sw, from: s2 }] : [],
                    info: { eff: f * 100, twb: s.twb }
                };
            }
        },

        steam: {
            cat: 'humidify', kind: 'humid',
            fields: [
                opt('mode', ['toRH', 'toX', 'dX', 'flow'], 'toRH'),
                num('value', byMode({ toRH: '%', toX: 'g/kg', dX: 'g/kg', flow: 'kg/h' }),
                    byMode({ toRH: 50, toX: 8, dX: 3, flow: 5 })),
                num('tSteam', '°C', 100)
            ],
            apply(s, prm, ctx) {
                if (!(prm.tSteam >= 0 && prm.tSteam <= 200)) fail('ERR_STEAM_T');
                return humidify(s, prm, P.R0 + P.CP_V * prm.tSteam, ctx);
            }
        },

        spray: {
            cat: 'humidify', kind: 'humid',
            fields: [
                opt('mode', ['dX', 'flow', 'toX', 'toRH'], 'dX'),
                num('value', byMode({ toRH: '%', toX: 'g/kg', dX: 'g/kg', flow: 'kg/h' }),
                    byMode({ toRH: 60, toX: 8, dX: 2, flow: 3 })),
                num('tWater', '°C', 15)
            ],
            apply(s, prm, ctx) {
                if (!(prm.tWater >= 0 && prm.tWater <= 100)) fail('ERR_WATER_T');
                return humidify(s, prm, P.CP_W * prm.tWater, ctx);
            }
        },

        dehum: {
            cat: 'dehumidify', kind: 'dehum',
            fields: [
                opt('mode', ['toRH', 'toX', 'dX', 'flow'], 'toRH'),
                num('value', byMode({ toRH: '%', toX: 'g/kg', dX: 'g/kg', flow: 'kg/h' }),
                    byMode({ toRH: 40, toX: 6, dX: 2, flow: 3 }))
            ],
            apply(s, prm, { p, mdot }) {
                const x2 = dehumTarget(s, prm, mdot, (rh) => P.xFromTRh(s.t, rh, p));
                const s2 = P.state(s.t, x2, p);
                return { state: s2, path: line(s, s2, p, 2) };
            }
        },

        desiccant: {
            cat: 'dehumidify', kind: 'dehum',
            fields: [
                opt('mode', ['toX', 'dX', 'toRH'], 'toX'),
                num('value', byMode({ toRH: '%', toX: 'g/kg', dX: 'g/kg' }), byMode({ toRH: 20, toX: 5, dX: 3 }))
            ],
            apply(s, prm, { p, mdot }) {
                const x2 = dehumTarget(s, prm, mdot, (rh) => {
                    const x = P.solve((xx) => P.fromHx(s.h, xx, p).rh, 1e-7, s.x, rh);
                    if (!isFinite(x)) fail('ERR_NO_SOLUTION');
                    return x;
                });
                const s2 = P.fromHx(s.h, x2, p);
                return { state: s2, path: line(s, s2, p, 2) };
            }
        },

        mix: {
            cat: 'mix', kind: 'mix',
            fields: [
                num('t2', '°C', 22),
                opt('hum', ['rh', 'x'], 'rh'),
                num('b2', byMode({ rh: '%', x: 'g/kg' }, 'hum'), byMode({ rh: 50, x: 8 }, 'hum')),
                opt('flowMode', ['fraction', 'volume', 'mass'], 'fraction'),
                num('flow2', byMode({ fraction: '%', volume: 'm³/h', mass: 'kg/h' }, 'flowMode'),
                    byMode({ fraction: 30, volume: 1000, mass: 1200 }, 'flowMode'))
            ],
            apply(s, prm, { p, mdot }) {
                const sb = prm.hum === 'x'
                    ? P.fromPair('t-x', prm.t2, prm.b2 / G, p)
                    : P.fromPair('t-rh', prm.t2, prm.b2, p);
                let m1 = mdot, m2;
                if (prm.flowMode === 'fraction') {
                    const f = prm.flow2 / 100;
                    if (!(f > 0 && f < 1)) fail('ERR_FRACTION');
                    if (!(m1 > 0)) m1 = 1;       // zonder debiet: alleen de verhouding telt
                    m2 = m1 * f / (1 - f);
                } else {
                    needFlow(mdot);
                    m2 = prm.flowMode === 'volume' ? positive(prm.flow2) / 3600 / sb.v : positive(prm.flow2) / 3600;
                }
                const mt = m1 + m2;
                const s2 = P.fromHx((m1 * s.h + m2 * sb.h) / mt, (m1 * s.x + m2 * sb.x) / mt, p);
                return {
                    state: s2, path: line(s, s2, p),
                    mdotOut: mdot > 0 ? mdot + m2 : mdot,
                    aux: [{ role: 'stream2', state: sb, from: s2, drag: true }],
                    info: { share: m2 / mt * 100, m2: mdot > 0 ? m2 : null }
                };
            }
        },

        hr: {
            cat: 'hr', kind: 'hr',
            fields: [
                opt('hrType', ['sensible', 'enthalpy'], 'sensible'),
                num('eff', '%', 75),
                num('effX', '%', 70, { when: (prm) => prm.hrType === 'enthalpy' }),
                num('tRet', '°C', 22),
                num('rhRet', '%', 40)
            ],
            apply(s, prm, { p }) {
                const sr = P.fromPair('t-rh', prm.tRet, prm.rhRet, p);
                const e = prm.eff / 100;
                if (!(e > 0 && e <= 1)) fail('ERR_EFF_RANGE');
                const t2 = s.t + e * (sr.t - s.t);
                let s2, path, drain = false;
                if (prm.hrType === 'enthalpy') {
                    const ex = prm.effX / 100;
                    if (!(ex >= 0 && ex <= 1)) fail('ERR_EFF_RANGE');
                    const x2 = Math.min(s.x + ex * (sr.x - s.x), P.satHumRatio(t2, p));
                    s2 = P.state(t2, x2, p);
                    path = line(s, s2, p);
                } else if (t2 < s.t) {
                    s2 = coolTo(s, t2, p);        // zomer: toevoerlucht wordt gekoeld
                    path = coolPath(s, s2, p);
                    drain = true;
                } else {
                    s2 = P.state(t2, s.x, p);
                    path = line(s, s2, p, 2);
                }
                return { state: s2, path, drain, aux: [{ role: 'return', state: sr, from: null, drag: true }], info: { eff: prm.eff } };
            }
        },

        load: {
            cat: 'other', kind: 'load',
            fields: [num('qs', 'kW', 5), num('mw', 'kg/h', 1)],
            apply(s, prm, { p, mdot }) {
                needFlow(mdot);
                if (!isFinite(prm.qs) || !isFinite(prm.mw) || (prm.qs === 0 && prm.mw === 0)) fail('ERR_LOAD');
                const mw = prm.mw / 3600;
                const h2 = s.h + (prm.qs + mw * (P.R0 + P.CP_V * s.t)) / mdot;
                const s2 = P.fromHx(h2, s.x + mw / mdot, p);
                return { state: s2, path: line(s, s2, p, 2) };
            }
        },

        fan: {
            cat: 'other', kind: 'fan',
            fields: [num('dp', 'Pa', 600), num('eff', '%', 65)],
            apply(s, prm, { p }) {
                if (!(prm.eff > 0 && prm.eff <= 100)) fail('ERR_EFF_RANGE');
                // Al het asvermogen komt als warmte in de luchtstroom: Δh = v·Δp / η
                const dh = s.v * positive(prm.dp) / (prm.eff / 100) / 1000;
                const s2 = P.fromHx(s.h + dh, s.x, p);
                return { state: s2, path: line(s, s2, p, 2) };
            }
        },

        // Klimaatcascade (Earth, Wind & Fire, Bronsema 2013 h3): gelijkstroom druppel–lucht, celmodel.
        // Doorsnede uit de luchtsnelheid bij ρ_ref = 1,20 kg/m³ (zoals het EWF-model); Q = ṁ·Δh (luchtzijde).
        cascade: {
            cat: 'ewf', kind: 'cascade',
            fields: [
                num('H', 'm', 28), num('w', 'm/s', 2), num('rwl', '–', 0.9), num('tW', '°C', 13),
                opt('spray', PH ? Object.keys(PH.SPRAY).filter((k) => k !== 'custom') : ['fulljet'], 'fulljet'),
                num('w0', 'm/s', 10)
            ],
            apply(s, prm, { p, mdot }) {
                needFlow(mdot);
                if (!PH) fail('ERR_INVALID');
                if (!(prm.H > 0.5 && prm.H <= 200)) fail('ERR_CASCADE_H');
                if (!(prm.w > 0.1 && prm.w <= 10) || !(prm.w0 > 0.5 && prm.w0 <= 40)) fail('ERR_POSITIVE');
                if (!(prm.rwl > 0 && prm.rwl <= 5)) fail('ERR_CASCADE_RWL');
                if (!(prm.tW > 0 && prm.tW < 60)) fail('ERR_WATER_T');
                if (s.fog) fail('ERR_ALREADY_SAT');
                const sp = PH.SPRAY[prm.spray] || PH.SPRAY.fulljet;
                const Ac = mdot * (1 + s.x) / (PH.RHO_REF * prm.w);
                const r = PH.cascade({ H: prm.H, Ac, mDa: mdot, tIn: s.t, xIn: s.x, mW: prm.rwl * mdot, tWIn: prm.tW, d30: sp.d30, d32: sp.d32, p, w0: prm.w0 });
                const s2 = P.state(r.t, r.x, p);
                return {
                    state: s2,
                    path: r.profile.map((q) => ({ t: q.t, x: q.x, h: P.enthalpy(q.t, q.x) })),
                    info: { tWOut: r.tw, dpHydr: r.dpHydr, Q: r.Q / 1000, rwl: prm.rwl }
                };
            }
        },

        point: {
            cat: 'other', kind: 'point',
            fields: [
                opt('pair', P.PAIRS, 't-rh'),
                num('a', (prm) => PAIR_UNITS[pairQ(prm, 0)], (prm) => PAIR_DEFAULTS[pairQ(prm, 0)]),
                num('b', (prm) => PAIR_UNITS[pairQ(prm, 1)], (prm) => PAIR_DEFAULTS[pairQ(prm, 1)])
            ],
            apply(s, prm, { p }) {
                const s2 = fromPairUI(prm.pair, prm.a, prm.b, p);
                return { state: s2, path: line(s, s2, p) };
            }
        }
    };

    /** Gemeenschappelijk voor stoom- en waterbevochtiging: richting γ = Δh/Δx. */
    function humidify(s, prm, gamma, { p, mdot }) {
        const v = prm.value;
        let dx;
        switch (prm.mode) {
            case 'dX': dx = positive(v) / G; break;
            case 'flow': needFlow(mdot); dx = positive(v) / 3600 / mdot; break;
            case 'toX':
                dx = v / G - s.x;
                if (!(dx > 0)) fail('ERR_HUMID_X');
                break;
            case 'toRH': {
                if (!(v > s.rh && v <= 100)) fail('ERR_HUMID_RH');
                let hi = 1e-3;
                while (addWater(s, hi, gamma, p).rh < v && hi < 0.5) hi *= 2;
                dx = P.solve((d) => addWater(s, d, gamma, p).rh, 0, hi, v);
                if (!isFinite(dx)) fail('ERR_NO_SOLUTION');
                break;
            }
            default: fail('ERR_INVALID');
        }
        const s2 = addWater(s, dx, gamma, p);
        return { state: s2, path: line(s, s2, p, 2), info: { gamma } };
    }

    /** Doel-x voor ontvochtigen; rhToX zet een RH-doel om naar x. */
    function dehumTarget(s, prm, mdot, rhToX) {
        const v = prm.value;
        let x2;
        switch (prm.mode) {
            case 'toRH':
                if (!(v >= 0 && v < s.rh)) fail('ERR_DEHUM_RH');
                x2 = v === 0 ? 0 : rhToX(v); break;
            case 'toX': x2 = v / G; break;
            case 'dX': x2 = s.x - positive(v) / G; break;
            case 'flow': needFlow(mdot); x2 = s.x - positive(v) / 3600 / mdot; break;
            default: fail('ERR_INVALID');
        }
        if (!(x2 < s.x)) fail('ERR_DEHUM_X');
        if (x2 < 0) fail('ERR_X_NEGATIVE');
        return x2;
    }

    const CATEGORIES = [
        { id: 'heat', types: ['heat'] },
        { id: 'cool', types: ['cool', 'coil', 'cooldehum'] },
        { id: 'humidify', types: ['adiabatic', 'steam', 'spray'] },
        { id: 'dehumidify', types: ['dehum', 'desiccant'] },
        { id: 'mix', types: ['mix'] },
        { id: 'hr', types: ['hr'] },
        { id: 'ewf', types: ['cascade'] },
        { id: 'other', types: ['load', 'fan', 'point'] }
    ];

    // ---- Invoerparen in UI-eenheden (x in g/kg) ----
    function fromPairUI(pair, a, b, p) {
        const [qa, qb] = pair.split('-');
        return P.fromPair(pair, qa === 'x' ? a / G : a, qb === 'x' ? b / G : b, p);
    }
    function pairValuesUI(pair, s) {
        const [qa, qb] = pair.split('-');
        const [a, b] = P.pairValues(pair, s);
        return [qa === 'x' ? a * G : a, qb === 'x' ? b * G : b];
    }

    /** Waarde van een veld-eigenschap die een functie van de parameters kan zijn. */
    const resolve = (v, prm) => (typeof v === 'function' ? v(prm) : v);

    /** Standaardparameters voor een type; bestaande waarden blijven behouden waar mogelijk. */
    function defaultParams(type, base) {
        const prm = Object.assign({}, base || {});
        for (const f of TYPES[type].fields) {
            if (f.type === 'select' && !f.options.includes(prm[f.key])) prm[f.key] = f.def;
        }
        for (const f of TYPES[type].fields) {
            if (f.type === 'num' && !isFinite(prm[f.key])) prm[f.key] = resolve(f.def, prm);
        }
        return prm;
    }

    /**
     * Reken een scenario door: begintoestand → alle ingeschakelde stappen.
     * Een ongeldige stap krijgt een foutmelding en wordt overgeslagen; de keten loopt door.
     */
    function computeScenario(scn, p) {
        const res = { states: [], steps: [], error: null, mdot: 0, totals: null };
        let s0;
        try {
            s0 = fromPairUI(scn.start.pair, scn.start.a, scn.start.b, p);
        } catch (e) {
            res.error = e;
            res.steps = scn.steps.map((step) => ({ step, ok: false, blocked: true }));
            return res;
        }
        const fv = Number(scn.flow && scn.flow.value);
        let mdot = 0;
        if (fv > 0) mdot = scn.flow.mode === 'mass' ? fv / 3600 : fv / 3600 / s0.v;
        res.mdot = mdot;

        let cur = Object.assign({}, s0, { mdot, n: 1, stepId: null });
        res.states.push(cur);
        const totals = { heating: 0, cooling: 0, recovered: 0, fan: 0, humid: 0, dehum: 0 };

        for (const step of scn.steps) {
            const T = TYPES[step.type];
            if (!T) { res.steps.push({ step, ok: false, error: new PsychroError('ERR_UNKNOWN_TYPE') }); continue; }
            if (step.enabled === false) { res.steps.push({ step, ok: false, skipped: true }); continue; }
            try {
                const out = T.apply(cur, step.params, { p, mdot: cur.mdot });
                const s2 = out.state;
                if (!s2 || !isFinite(s2.t) || !isFinite(s2.x)) fail('ERR_NO_SOLUTION');
                const m = cur.mdot;
                const end = Object.assign({}, s2, { mdot: out.mdotOut != null ? out.mdotOut : m, n: cur.n + 1, stepId: step.id });
                const dt = end.t - cur.t, dx = end.x - cur.x, dh = end.h - cur.h;
                const r = {
                    step, ok: true, kind: T.kind, start: cur, end,
                    path: out.path, aux: out.aux || [], info: out.info || {},
                    dt, dx, dh,
                    gamma: Math.abs(dx) > 1e-9 ? dh / dx : (dh >= 0 ? Infinity : -Infinity),
                    qt: null, qs: null, ql: null, shr: null, water: 0
                };
                if (T.kind !== 'mix' && m > 0) {
                    // Condensaat verlaat de batterij met enthalpie h_w(t2) (ASHRAE: q = ṁ·[(h1 − h2) − (x1 − x2)·h_w2])
                    const hDrain = out.drain && dx < 0 ? -dx * P.hCondensed(end.t) : 0;
                    r.qt = m * (dh + hDrain);
                    r.qs = m * (P.CP_DA + P.CP_V * (cur.x - cur.xl)) * dt;
                    r.ql = r.qt - r.qs;
                    r.shr = Math.abs(r.qt) > 1e-9 ? r.qs / r.qt : null;
                    r.water = dx * m * 3600;
                    if (T.kind === 'heat' && r.qt > 0) totals.heating += r.qt;
                    if (T.kind === 'cool' && r.qt < 0) totals.cooling -= r.qt;
                    if (T.kind === 'hr') totals.recovered += Math.abs(r.qt);
                    if (T.kind === 'fan') totals.fan += r.qt;
                    if (r.water > 0 && T.kind === 'humid') totals.humid += r.water;
                    if (r.water < 0) totals.dehum -= r.water;
                }
                if (T.kind === 'humid' && r.info.gamma && r.water > 0) {
                    r.info.power = r.water / 3600 * r.info.gamma;   // energie in stoom/water t.o.v. 0 °C
                }
                res.steps.push(r);
                res.states.push(end);
                cur = end;
            } catch (e) {
                res.steps.push({ step, ok: false, error: e });
            }
        }
        res.totals = totals;
        return res;
    }

    return {
        TYPES, CATEGORIES, PAIR_UNITS,
        computeScenario, defaultParams, resolve, fromPairUI, pairValuesUI,
        lerpState, satState, line
    };
});
