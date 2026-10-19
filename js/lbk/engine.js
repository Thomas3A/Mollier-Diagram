/**
 * engine.js — luchtbehandelingskast (LBK): samenstelling, regeling en jaarberekening (geen DOM)
 *
 * Een LBK is een geordende reeks componenten aan de toevoerzijde (buitenlucht → toevoer) plus een
 * retour-/afvoerzijde. Per uur bepaalt een regelstrategie wat elk component doet om de eisen aan de
 * toevoerlucht (temperatuur, min./max. vochtgehalte) te halen:
 *   - WTW moduleert (bypass/toerental) tot het setpoint, met vorstbeveiliging op de afvoertemperatuur;
 *   - mengkamer vast of regelend (meer recirculatie bij warmte- of koudevraag);
 *   - verwarmer naar het toevoer-setpoint (min. de ventilatoropwarming erna) of een vast setpoint;
 *   - koeler volgens het bypassfactor-model met apparaatdauwpunt (ADP), ontvochtigt tot x_max;
 *   - bevochtiger (stoom of adiabatisch) tot x_min; de verwarmer ervóór levert de verdampingswarmte;
 *   - ventilatoren: P = q_v·Δp/η·(q/q_n)^n, alle elektrische energie wordt warmte in de luchtstroom.
 * Bestaande LBK: vermogens begrensd op de ingevulde capaciteit. Nieuw ontwerp: onbegrensd (= benodigd).
 *
 * Eenheden in de LBK-definitie: debiet m³/h (massastroom bij ρ = 1,2 kg/m³), t °C, x g/kg, Δp Pa,
 * vermogen kW, water kg/h. Intern x in kg/kg, h in kJ/kg droge lucht, ṁ in kg/s.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('../psychro.js'));
    else root.LbkEngine = factory(root.Psychro);
})(typeof self !== 'undefined' ? self : this, function (P) {
    'use strict';

    const G = 1000;                        // g/kg ↔ kg/kg
    const RHO_REF = 1.2;                   // kg/m³: volumestroom → massastroom (standaardlucht)
    const H_STEAM = P.R0 + P.CP_V * 100;   // kJ/kg: stoom van 100 °C (Mollier-conventie, zoals processes.js)
    const T_FEED = 10;                     // °C suppletiewater bevochtiger
    const GAS_KWH = 35.17 / 3.6;           // kWh per m³ aardgas (bovenwaarde, Groningen-equivalent)
    const N = 8760;
    const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const T_TOL = 0.5, X_TOL = 0.2 / G;    // tolerantie "eis gehaald"
    const MAX_UNITS = 8, MAX_COMPS = 16, MAX_RET = 6;

    const uid = () => Math.random().toString(36).slice(2, 9);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const isNum = (v) => typeof v === 'number' && isFinite(v);

    // =====================================================================
    // Componentcatalogus
    // =====================================================================
    const num = (key, unit, def, min, max, extra) => Object.assign({ key, type: 'num', unit, def, min, max }, extra || {});
    const sel = (key, options, def, extra) => Object.assign({ key, type: 'select', options, def }, extra || {});
    const bool = (key, def, extra) => Object.assign({ key, type: 'bool', def }, extra || {});
    const wheel = (c) => c.kind === 'wheel' || c.kind === 'sorption';
    const existing = (c, u) => !u || u.mode === 'existing';

    /** Standaardwaarden die afhangen van de uitvoering (WTW, bevochtiger). */
    const KIND_DEFAULTS = {
        hr: {
            plate: { eta: 75, etaX: 0, frost: 1, dp: 150 },
            runaround: { eta: 60, etaX: 0, frost: -20, dp: 200 },
            wheel: { eta: 78, etaX: 15, frost: -20, dp: 140 },
            sorption: { eta: 78, etaX: 70, frost: -20, dp: 140 }
        },
        humid: { steam: { dp: 20 }, adiabatic: { dp: 80, eta: 90 } }
    };

    const TYPES = {
        filter: { sides: ['sup', 'ret'], fields: [num('dp', 'Pa', 120, 0, 1000)] },
        hr: {
            sides: ['sup'], single: true,
            fields: [
                sel('kind', ['plate', 'runaround', 'wheel', 'sorption'], 'plate'),
                num('eta', '%', 75, 5, 95),
                num('etaX', '%', 0, 0, 95, { when: wheel }),
                num('frost', '°C', 1, -30, 10),
                num('dp', 'Pa', 150, 0, 800),
                bool('iec', false, { when: (c) => !wheel(c) }),
                num('iecEta', '%', 85, 10, 100, { when: (c) => !wheel(c) && c.iec })
            ]
        },
        mix: {
            sides: ['sup'], single: true,
            fields: [sel('ctrl', ['fixed', 'econ'], 'fixed'), num('share', '%', 30, 0, 95), num('dp', 'Pa', 30, 0, 300)]
        },
        heater: {
            sides: ['sup'],
            fields: [
                sel('role', ['main', 'pre'], 'main'),
                num('tSet', '°C', 5, -20, 40, { when: (c) => c.role === 'pre' }),
                num('qMax', 'kW', 0, 0, 1e5, { when: existing }),
                num('dp', 'Pa', 60, 0, 500)
            ]
        },
        cooler: {
            sides: ['sup'],
            fields: [
                num('bf', '–', 0.1, 0, 0.5, { dec: 2 }),
                num('adpMin', '°C', 7, 0, 20),
                bool('dehum', true),
                num('qMax', 'kW', 0, 0, 1e5, { when: existing }),
                num('dp', 'Pa', 140, 0, 600)
            ]
        },
        humid: {
            sides: ['sup'],
            fields: [
                sel('kind', ['steam', 'adiabatic'], 'steam'),
                num('eta', '%', 90, 10, 100, { when: (c) => c.kind === 'adiabatic' }),
                num('cap', 'kg/h', 0, 0, 1e4, { when: existing }),
                num('dp', 'Pa', 20, 0, 400)
            ]
        },
        fan: {
            sides: ['sup', 'ret'],
            fields: [
                num('dpExt', 'Pa', 300, 0, 3000),
                num('eta', '%', 60, 10, 90),
                num('n', '–', 2, 1, 3, { dec: 1 }),
                sel('pos', ['after', 'before'], 'after', { when: (c, u, side) => side === 'ret' })
            ]
        },
        silencer: { sides: ['sup', 'ret'], fields: [num('dp', 'Pa', 40, 0, 300)] }
    };
    const SUP_TYPES = ['filter', 'hr', 'mix', 'heater', 'cooler', 'humid', 'fan', 'silencer'];
    const RET_TYPES = ['filter', 'fan', 'silencer'];

    /** Zichtbare velden van een component (afhankelijk van uitvoering, rol en LBK-modus). */
    const fieldsOf = (c, u, side = 'sup') => TYPES[c.type].fields.filter((f) => !f.when || f.when(c, u, side));

    /** Nieuw component met standaardwaarden; params overschrijven. */
    function makeComp(type, params, side = 'sup') {
        const T = TYPES[type];
        if (!T) throw new Error('LBK_TYPE');
        const c = { id: uid(), type, on: true };
        for (const f of T.fields) if (f.type !== 'num') c[f.key] = f.def;
        Object.assign(c, pickSelects(type, params));
        const kd = KIND_DEFAULTS[type] && KIND_DEFAULTS[type][c.kind];
        for (const f of T.fields) if (f.type === 'num') c[f.key] = kd && kd[f.key] != null ? kd[f.key] : f.def;
        if (type === 'fan' && side === 'ret') c.dpExt = 250;
        return normalizeComp(Object.assign(c, params || {}), side);
    }
    function pickSelects(type, params) {
        const out = {};
        for (const f of TYPES[type].fields) if (f.type === 'select' && params && f.options.includes(params[f.key])) out[f.key] = params[f.key];
        return out;
    }
    /** Wissel van uitvoering: neem de standaardwaarden van de nieuwe uitvoering over. */
    function setKind(c, kind) {
        c.kind = kind;
        const kd = KIND_DEFAULTS[c.type] && KIND_DEFAULTS[c.type][kind];
        if (kd) Object.assign(c, kd);
        return c;
    }

    function normalizeComp(c, side = 'sup') {
        const T = c && TYPES[c.type];
        if (!T || !T.sides.includes(side)) return null;
        const out = { id: String(c.id || uid()).replace(/[^\w-]/g, '').slice(0, 20) || uid(), type: c.type, on: c.on !== false };
        if (typeof c.label === 'string' && c.label.trim()) out.label = c.label.trim().slice(0, 40);
        const kindF = T.fields.find((f) => f.key === 'kind');
        const kind = kindF ? (kindF.options.includes(c.kind) ? c.kind : kindF.def) : null;
        const kd = kind && KIND_DEFAULTS[c.type] ? KIND_DEFAULTS[c.type][kind] : null;
        for (const f of T.fields) {
            const v = c[f.key];
            if (f.type === 'select') out[f.key] = f.options.includes(v) ? v : f.def;
            else if (f.type === 'bool') out[f.key] = typeof v === 'boolean' ? v : f.def;
            else out[f.key] = isNum(v) ? clamp(v, f.min, f.max) : (kd && kd[f.key] != null ? kd[f.key] : f.def);
        }
        return out;
    }

    // =====================================================================
    // LBK en energie-instellingen
    // =====================================================================
    const WEEKDAYS = 7, HOURS = 24;

    /** Standaard weekpatroon: werkweek ma–vr 8–17 uur met 80 % bezetting. */
    function defaultSchedule() {
        return Array.from({ length: WEEKDAYS }, (_, d) => Array.from({ length: HOURS }, (_, h) => (d < 5 && h >= 8 && h < 17 ? 80 : 0)));
    }

    function defaultUnit(mode = 'existing', name = 'LBK 1', color = 0) {
        return {
            id: uid(), name, color, mode: mode === 'design' ? 'design' : 'existing',
            flow: 10000, retFlow: 100,
            sup: { mode: 'comp', t: 18, tWin: 20, tSum: 16, tOutWin: 0, tOutSum: 20, xMinOn: false, xMin: 6, xMaxOn: false, xMax: 10 },
            ret: { tWin: 21, tSum: 24, dx: 1 },
            design: { win: { t: -10, rh: 90 }, sum: { t: 28, rh: 50 } },
            comps: [],
            retComps: [],
            ops: { control: 'vav', minFlow: 30, off: 'off', offFlow: 30, ecoT: 14, nightFlow: 100, nightTMin: 12, nightTrig: 22 },
            gen: { heat: 'boiler', etaHeat: 95, scop: 4, seer: 4.5, steam: 'elec', etaSteam: 95 }
        };
    }

    function defaultEnergy() {
        return { climate: 'energie', schedule: defaultSchedule(), tariffs: { elec: 0.25, gas: 1.25, heat: 45, water: 1.75 } };
    }

    function defaultState() { return { active: null, units: [], energy: defaultEnergy() }; }

    const numIn = (v, def, min, max) => (isNum(v) ? clamp(v, min, max) : def);
    const pickIn = (v, opts, def) => (opts.includes(v) ? v : def);

    function normalizeUnit(src, i = 0) {
        if (!src || typeof src !== 'object') return null;
        const d = defaultUnit();
        const s = src.sup || {}, r = src.ret || {}, de = src.design || {}, o = src.ops || {}, g = src.gen || {};
        const pt = (q, def) => ({ t: numIn(q && q.t, def.t, -40, 50), rh: numIn(q && q.rh, def.rh, 1, 100) });
        const u = {
            id: String(src.id || uid()).replace(/[^\w-]/g, '').slice(0, 20) || uid(),
            name: String(src.name || `LBK ${i + 1}`).slice(0, 40),
            color: Math.abs(parseInt(src.color, 10) || 0) % 6,
            mode: src.mode === 'design' ? 'design' : 'existing',
            flow: numIn(src.flow, d.flow, 50, 500000),
            retFlow: numIn(src.retFlow, d.retFlow, 0, 150),
            sup: {
                mode: pickIn(s.mode, ['const', 'comp'], d.sup.mode),
                t: numIn(s.t, d.sup.t, 5, 45), tWin: numIn(s.tWin, d.sup.tWin, 5, 45), tSum: numIn(s.tSum, d.sup.tSum, 5, 45),
                tOutWin: numIn(s.tOutWin, d.sup.tOutWin, -30, 40), tOutSum: numIn(s.tOutSum, d.sup.tOutSum, -30, 45),
                xMinOn: !!s.xMinOn, xMin: numIn(s.xMin, d.sup.xMin, 0.5, 20),
                xMaxOn: !!s.xMaxOn, xMax: numIn(s.xMax, d.sup.xMax, 2, 30)
            },
            ret: { tWin: numIn(r.tWin, d.ret.tWin, 5, 40), tSum: numIn(r.tSum, d.ret.tSum, 5, 40), dx: numIn(r.dx, d.ret.dx, 0, 10) },
            design: { win: pt(de.win, d.design.win), sum: pt(de.sum, d.design.sum) },
            comps: [],
            retComps: [],
            ops: {
                control: pickIn(o.control, ['vav', 'cav'], d.ops.control),
                minFlow: numIn(o.minFlow, d.ops.minFlow, 0, 100),
                off: pickIn(o.off, ['off', 'vent', 'eco', 'night'], d.ops.off),
                offFlow: numIn(o.offFlow, d.ops.offFlow, 5, 100),
                ecoT: numIn(o.ecoT, d.ops.ecoT, -10, 30),
                nightFlow: numIn(o.nightFlow, d.ops.nightFlow, 5, 100),
                nightTMin: numIn(o.nightTMin, d.ops.nightTMin, 0, 25),
                nightTrig: numIn(o.nightTrig, d.ops.nightTrig, 10, 35)
            },
            gen: {
                heat: pickIn(g.heat, ['boiler', 'hp', 'district', 'elec'], d.gen.heat),
                etaHeat: numIn(g.etaHeat, d.gen.etaHeat, 10, 120),
                scop: numIn(g.scop, d.gen.scop, 1, 10),
                seer: numIn(g.seer, d.gen.seer, 1, 15),
                steam: pickIn(g.steam, ['elec', 'gas'], d.gen.steam),
                etaSteam: numIn(g.etaSteam, d.gen.etaSteam, 10, 110)
            }
        };
        if (u.sup.tOutSum <= u.sup.tOutWin) u.sup.tOutSum = u.sup.tOutWin + 1;
        const ids = new Set();
        const take = (list, side, max) => (Array.isArray(list) ? list : []).slice(0, max).map((c) => normalizeComp(c, side)).filter((c) => {
            if (!c) return false;
            if (ids.has(c.id)) c.id = uid();
            ids.add(c.id);
            return true;
        });
        u.comps = take(src.comps, 'sup', MAX_COMPS);
        for (const t of ['hr', 'mix']) {      // maximaal één WTW en één mengkamer
            let seen = false;
            u.comps = u.comps.filter((c) => { if (c.type !== t) return true; if (seen) return false; seen = true; return true; });
        }
        u.retComps = take(src.retComps, 'ret', MAX_RET);
        return u;
    }

    function normalizeSchedule(s) {
        const def = defaultSchedule();
        if (!Array.isArray(s) || s.length !== WEEKDAYS) return def;
        return s.map((row, d) => (Array.isArray(row) && row.length === HOURS
            ? row.map((v) => Math.round(numIn(v, 0, 0, 100))) : def[d]));
    }

    function normalizeState(src) {
        const out = defaultState();
        if (!src || typeof src !== 'object') return out;
        const ids = new Set();
        out.units = (Array.isArray(src.units) ? src.units : []).slice(0, MAX_UNITS).map(normalizeUnit).filter((u) => {
            if (!u) return false;
            if (ids.has(u.id)) u.id = uid();
            ids.add(u.id);
            return true;
        });
        out.active = out.units.some((u) => u.id === src.active) ? src.active : (out.units[0] ? out.units[0].id : null);
        const e = src.energy || {}, tf = e.tariffs || {}, td = out.energy.tariffs;
        out.energy = {
            climate: typeof e.climate === 'string' && /^(energie|T5|T1|winter1979|winter1963|y\d{4})$/.test(e.climate) ? e.climate : 'energie',
            schedule: normalizeSchedule(e.schedule),
            tariffs: {
                elec: numIn(tf.elec, td.elec, 0, 10), gas: numIn(tf.gas, td.gas, 0, 20),
                heat: numIn(tf.heat, td.heat, 0, 500), water: numIn(tf.water, td.water, 0, 50)
            }
        };
        return out;
    }

    /** Voorbeeld: bestaande kantoor-LBK 10 000 m³/h met platenwisselaar, koeler, naverwarmer en stoom. */
    function exampleUnit(name = 'Kantoor-LBK', color = 2) {
        const u = defaultUnit('existing', name, color);
        Object.assign(u.sup, { xMinOn: true, xMin: 6, xMaxOn: true, xMax: 10 });
        u.comps = [
            makeComp('filter', { dp: 120 }),
            makeComp('hr', { kind: 'plate', eta: 75 }),
            makeComp('cooler', { qMax: 60 }),
            makeComp('heater', { role: 'main', qMax: 45 }),
            makeComp('humid', { kind: 'steam', cap: 60 }),
            makeComp('fan', { dpExt: 300, eta: 60 })
        ];
        u.retComps = [makeComp('filter', { dp: 120 }, 'ret'), makeComp('fan', { dpExt: 250, eta: 60, pos: 'after' }, 'ret')];
        return u;
    }

    /** Voorstel voor een nieuwe LBK op basis van de eisen aan de toevoerlucht. */
    function propose(u) {
        const s = u.sup;
        const tSum = s.mode === 'comp' ? s.tSum : s.t;
        const comps = [makeComp('filter', { dp: 120 }), makeComp('hr', { kind: s.xMinOn ? 'sorption' : 'plate' })];
        if (s.xMaxOn || tSum < u.design.sum.t - 1) comps.push(makeComp('cooler', {}));
        comps.push(makeComp('heater', { role: 'main' }));
        if (s.xMinOn) comps.push(makeComp('humid', { kind: 'steam' }));
        comps.push(makeComp('fan', { dpExt: 300, eta: 65 }));
        return { comps, retComps: [makeComp('filter', { dp: 120 }, 'ret'), makeComp('fan', { dpExt: 250, eta: 65, pos: 'after' }, 'ret')] };
    }

    // =====================================================================
    // Lichte luchttoestanden {t, x, h} (snel genoeg voor 8760 uur)
    // =====================================================================
    const mk = (t, x) => ({ t, x, h: P.enthalpy(t, x) });
    const mkH = (h, x) => ({ t: P.tFromHx(h, x), x, h });
    const dew = (x, p) => (x > 1e-7 ? P.tFromSatPres(P.pwFromX(x, p)) : -100);
    const hW = (t) => P.CP_W * Math.max(t, 0);   // enthalpie condensaat

    /** Temperatuur op de verzadigingslijn bij enthalpie h (bisectie; h_sat stijgt monotoon). */
    function tSatAtH(h, p) {
        let lo = -60, hi = 95;
        for (let i = 0; i < 46; i++) {
            const m = (lo + hi) / 2;
            if (P.hSat(m, p) > h) hi = m; else lo = m;
        }
        return (lo + hi) / 2;
    }
    /** Oververzadigde lucht: het overschot slaat neer (toevoerlucht bevat geen mist). */
    function sat(s, p) {
        const xs = P.satHumRatio(s.t, p);
        if (s.x <= xs) return s;
        const t = tSatAtH(s.h, p);
        return mk(t, P.satHumRatio(t, p));
    }

    /**
     * Koelbatterij met bypassfactor BF: uittrede op de rechte lijn intrede → ADP.
     * Kies het ADP dat de temperatuur- en/of vochteis haalt, niet lager dan adpMin.
     */
    function coil(s, tT, xT, bf, adpMin, p) {
        const needT = s.t > tT + 0.05, needX = s.x > xT + 1e-9;        // dode zone: niet tegelijk verwarmen en koelen
        if (!needT && !needX) return null;
        let adp = Infinity;
        if (needT) adp = (tT - bf * s.t) / (1 - bf);
        if (needX) {
            const xa = (xT - bf * s.x) / (1 - bf);
            adp = Math.min(adp, xa > 1e-5 ? dew(xa, p) : adpMin);
        }
        adp = Math.max(adp, adpMin);
        if (adp >= s.t - 1e-6) return null;
        const xa = P.satHumRatio(adp, p);
        const t2 = adp + bf * (s.t - adp);
        const x2 = xa >= s.x ? s.x : xa + bf * (s.x - xa);
        return { s: mk(t2, x2), adp, dry: xa >= s.x };
    }

    const lerpOut = (tOut, a, b, ya, yb) => (tOut <= a ? ya : tOut >= b ? yb : ya + (yb - ya) * (tOut - a) / (b - a));

    /** Eisen bij een buitentemperatuur: toevoertemperatuur, retourtemperatuur, x-grenzen [kg/kg]. */
    function targets(u, tOut) {
        const s = u.sup;
        return {
            tSup: s.mode === 'comp' ? lerpOut(tOut, s.tOutWin, s.tOutSum, s.tWin, s.tSum) : s.t,
            tRet: lerpOut(tOut, s.tOutWin, s.tOutSum, u.ret.tWin, u.ret.tSum),
            xMin: s.xMinOn ? s.xMin / G : 0,
            xMax: s.xMaxOn ? s.xMax / G : Infinity
        };
    }

    // =====================================================================
    // Doorrekenen van één uur
    // =====================================================================
    /** Vaste gegevens van een LBK (één keer per berekening). */
    function compile(u, p) {
        const chain = u.comps.filter((c) => c.on !== false);
        const rets = u.retComps.filter((c) => c.on !== false);
        const V = u.flow / 3600;
        const retRatio = u.retFlow / 100;
        const hrIdx = chain.findIndex((c) => c.type === 'hr');
        const mixIdx = chain.findIndex((c) => c.type === 'mix');
        const hr = hrIdx >= 0 ? chain[hrIdx] : null;
        const dpSupInt = chain.reduce((a, c) => a + (c.type === 'fan' ? 0 : c.dp || 0), 0);
        const dpRetInt = rets.reduce((a, c) => a + (c.type === 'fan' ? 0 : c.dp || 0), 0) + (hr ? hr.dp : 0);
        const supFans = chain.filter((c) => c.type === 'fan');
        const retFans = rets.filter((c) => c.type === 'fan');
        const fanDes = {};
        // Interne weerstand komt voor rekening van de eerste ventilator aan elke zijde
        supFans.forEach((c, i) => { const dp = c.dpExt + (i === 0 ? dpSupInt : 0); fanDes[c.id] = { dp, P: V * dp / (c.eta / 100) / 1000 }; });
        retFans.forEach((c, i) => { const dp = c.dpExt + (i === 0 ? dpRetInt : 0); fanDes[c.id] = { dp, P: V * retRatio * dp / (c.eta / 100) / 1000 }; });
        // Eerste adiabatische bevochtiger stroomafwaarts van elke positie, en de verwarmer die hem voedt
        const adiAfter = chain.map((_, i) => chain.findIndex((c, j) => j > i && c.type === 'humid' && c.kind === 'adiabatic'));
        const feeds = chain.map((c, i) => {
            if (c.type !== 'heater' || adiAfter[i] < 0) return -1;
            const k = adiAfter[i];
            return chain.some((d, j) => j > i && j < k && d.type === 'heater') ? -1 : k;
        });
        const needIter = chain.some((c) => c.type === 'mix' || (c.type === 'hr' && (wheel(c) && c.etaX > 0 || c.iec)));
        return {
            u, p, chain, rets, V, mDes: V * RHO_REF, retRatio, hrIdx, mixIdx, dpSupInt, dpRetInt,
            supFans, retFans, fanDes, adiAfter, feeds, needIter, limit: u.mode === 'existing'
        };
    }

    /**
     * Reken één bedrijfstoestand door.
     * out: buitenlucht {t, x}; o: { f (debietfractie), mode: normal|eco|night|fans, occ (bezetting 0–1), limit }.
     */
    function step(pl, out, o = {}) {
        const { p, u } = pl;
        const f = o.f == null ? 1 : o.f;
        const mode = o.mode || 'normal';
        const occ = o.occ == null ? 1 : o.occ;
        const tg = targets(u, out.t);
        const normal = mode === 'normal', eco = mode === 'eco', passive = !normal && !eco;
        const m = pl.mDes * f, mRet = m * pl.retRatio;
        const fanP = {};
        let fanSup = 0, fanRet = 0;
        for (const c of pl.supFans) { fanP[c.id] = pl.fanDes[c.id].P * Math.pow(f, c.n); fanSup += fanP[c.id]; }
        for (const c of pl.retFans) { fanP[c.id] = pl.fanDes[c.id].P * Math.pow(f, c.n); fanRet += fanP[c.id]; }
        const ctx = {
            tg, normal, eco, passive, m, mRet, fanP,
            limit: o.limit == null ? pl.limit : o.limit,
            heatT: normal ? tg.tSup : eco ? u.ops.ecoT : -Infinity,
            xMin: normal ? tg.xMin : 0,
            xMax: normal ? tg.xMax : Infinity,
            dxRoom: occ > 0 ? u.ret.dx / G : 0
        };
        const o0 = sat(mk(out.t, Math.max(0, out.x)), p);
        // Retourlucht = toevoerlucht + vochtlast ruimte: vaste punt x_toe = g(x_toe), opgelost met de secantmethode
        let x0 = clamp(o0.x, ctx.xMin, ctx.xMax);
        let r = pl.mixIdx >= 0 ? pl.chain[pl.mixIdx].share / 100 : 0;
        let res = walk(pl, o0, ctx, x0 + ctx.dxRoom, r);
        if (pl.needIter) {
            let F0 = res.supply.x - x0, x1 = res.supply.x;
            for (let k = 0; k < 8; k++) {
                r = res.r;
                res = walk(pl, o0, ctx, x1 + ctx.dxRoom, r);
                const F1 = res.supply.x - x1;
                if (Math.abs(F1) < 1e-7 && Math.abs(res.r - r) < 1e-5) break;
                const x2 = Math.abs(F1 - F0) > 1e-12 ? x1 - F1 * (x1 - x0) / (F1 - F0) : res.supply.x;
                x0 = x1; F0 = F1; x1 = Math.max(0, x2);
            }
        }
        res.mode = mode;
        res.f = f;
        res.fanSup = fanSup;
        res.fanRet = fanRet;
        return res;
    }

    function walk(pl, out, ctx, xRet, rPrev) {
        const { p, chain, rets } = pl;
        const { tg, normal, passive, m, mRet, fanP, heatT, xMin, xMax, limit } = ctx;
        // Retourlucht uit de ruimte; retourventilator vóór de WTW warmt hem op
        const r0 = sat(mk(tg.tRet, xRet), p);
        let e = r0;
        for (const c of rets) if (c.type === 'fan' && c.pos === 'before' && mRet > 0) e = mkH(e.h + fanP[c.id] / mRet, e.x);
        const eRec = e;
        let r = pl.mixIdx >= 0 ? rPrev : 0;
        const mAt = (i) => (pl.mixIdx >= 0 && i < pl.mixIdx ? m * (1 - r) : m);
        const mExh = () => Math.max(0, mRet - (pl.mixIdx >= 0 ? r * m : 0));
        /** Temperatuurstijging stroomafwaarts van positie i: ventilatoren en (voelbaar deel van) stoombevochtiging. */
        const dTdown = (i, x) => {
            let dh = 0, xs = x;
            for (let j = i + 1; j < chain.length; j++) {
                const c = chain[j];
                if (c.type === 'fan' && mAt(j) > 0) dh += fanP[c.id] / mAt(j);
                else if (c.type === 'humid' && c.kind === 'steam' && normal && xs < xMin) {
                    dh += (xMin - xs) * P.CP_V * (100 - tg.tSup);
                    xs = xMin;
                }
            }
            return dh / (P.CP_DA + P.CP_V * x);
        };
        /** Temperatuur waartoe een verwarmer (of WTW) vóór adiabatische bevochtiger k moet verwarmen. */
        const adiNeed = (k, x) => {
            if (k < 0 || !normal || !(x < xMin - 1e-9)) return -Infinity;
            const tA = heatT - dTdown(k, xMin);
            const hIsen = P.enthalpy(tA, xMin) - (xMin - x) * P.CP_W * T_FEED;   // water brengt zelf wat enthalpie mee
            const xsNeed = x + (xMin - x) / (chain[k].eta / 100);
            const hEff = xsNeed < 0.1 ? P.enthalpy(dew(xsNeed, p), xsNeed) : Infinity;
            return Math.min(50, P.tFromHx(Math.max(hIsen, hEff), x));
        };

        const comps = {};
        const points = [];
        let s = out, exhaust = e, hrOut = null;
        for (let i = 0; i < chain.length; i++) {
            const c = chain[i], sIn = s, mi = mAt(i);
            const cr = { type: c.type, dh: 0, q: 0, water: 0, elec: 0, capped: false };
            switch (c.type) {
                case 'fan':
                    cr.elec = fanP[c.id];
                    if (mi > 0) s = mkH(s.h + cr.elec / mi, s.x);
                    break;
                case 'mix': {
                    let share = c.share / 100;
                    if (passive && c.ctrl === 'econ') share = 0;
                    else if (c.ctrl === 'econ') {
                        const dt = dTdown(i, s.x);
                        share = econShare(s.t, eRec.t, c.share / 100, heatT - dt, normal ? tg.tSup - dt : Infinity);
                    }
                    if (mRet <= 0) share = 0;
                    r = share;
                    s = sat(mkH((1 - share) * s.h + share * eRec.h, (1 - share) * s.x + share * eRec.x), p);
                    cr.share = share;
                    break;
                }
                case 'hr': {
                    const res = recover(c, s, e, i);
                    s = res.s;
                    Object.assign(cr, res.info);
                    hrOut = res.exhaust;
                    break;
                }
                case 'heater': {
                    if (passive) break;
                    let tNeed = c.role === 'pre' ? c.tSet : heatT - dTdown(i, s.x);
                    if (pl.feeds[i] >= 0) tNeed = Math.max(tNeed, adiNeed(pl.feeds[i], s.x));
                    if (s.t < tNeed - 1e-9 && mi > 0) {
                        let h2 = P.enthalpy(tNeed, s.x);
                        const qMax = limit && c.qMax > 0 ? c.qMax : Infinity;
                        if (mi * (h2 - s.h) > qMax) { h2 = s.h + qMax / mi; cr.capped = true; }
                        s = mkH(h2, s.x);
                    }
                    break;
                }
                case 'cooler': {
                    if (!normal || mi <= 0) break;
                    const res = coil(s, tg.tSup - dTdown(i, s.x), c.dehum ? xMax : Infinity, c.bf, c.adpMin, p);
                    if (!res) break;
                    let so = res.s;
                    const q = mi * ((s.h - so.h) - (s.x - so.x) * hW(so.t));
                    const qMax = limit && c.qMax > 0 ? c.qMax : Infinity;
                    if (q > qMax) {
                        const g = qMax / q;
                        so = mkH(s.h + g * (so.h - s.h), s.x + g * (so.x - s.x));
                        cr.capped = true;
                    }
                    cr.adp = res.adp;
                    cr.dry = res.dry;
                    s = so;
                    break;
                }
                case 'humid': {
                    if (!normal || !(s.x < xMin - 1e-9) || mi <= 0) break;
                    const capKgs = limit && c.cap > 0 ? c.cap / 3600 : Infinity;
                    let dx;
                    if (c.kind === 'steam') {
                        dx = Math.min(xMin - s.x, Math.max(0, P.xFromTRh(s.t, 95, p) - s.x));   // geen mist: max. 95 % RV
                        if (mi * dx > capKgs) { dx = capKgs / mi; cr.capped = true; }
                        s = mkH(s.h + dx * H_STEAM, s.x + dx);
                        cr.steam = mi * dx * (H_STEAM - P.CP_W * T_FEED);       // kW naar de stoomproductie
                    } else {
                        const ts = tSatAtH(s.h, p);
                        dx = Math.max(0, Math.min(xMin, s.x + c.eta / 100 * (P.satHumRatio(ts, p) - s.x)) - s.x);
                        if (mi * dx > capKgs) { dx = capKgs / mi; cr.capped = true; }
                        s = mkH(s.h + dx * P.CP_W * T_FEED, s.x + dx);
                    }
                    cr.water = mi * dx * 3600;
                    break;
                }
                default: break;          // filter, geluiddemper: alleen drukverlies
            }
            cr.dh = s.h - sIn.h;
            cr.dx = s.x - sIn.x;
            cr.tOut = s.t;
            comps[c.id] = cr;
            points.push({ id: c.id, type: c.type, t: s.t, x: s.x, h: s.h });
        }

        // Vermogens met de definitieve massastromen
        const sums = { heat: 0, cool: 0, coolLat: 0, humidKg: 0, steam: 0, adiaKg: 0, iecKg: 0, recovered: 0, cond: 0 };
        chain.forEach((c, i) => {
            const cr = comps[c.id], mi = mAt(i);
            cr.m = mi;
            if (c.type === 'cooler') {
                const cond = Math.max(0, -cr.dx) * mi;
                cr.q = mi * cr.dh + cond * hW(cr.tOut);           // < 0: onttrokken
                cr.water = -cond * 3600;
                sums.cool -= cr.q;
                sums.coolLat += cond * P.R0;
                sums.cond += cond * 3600;
            } else if (c.type === 'hr') {
                cr.q = mi * cr.dh;
                sums.recovered += cr.q;
                sums.iecKg += cr.iecKg || 0;
            } else if (c.type !== 'mix' && c.type !== 'fan') {
                cr.q = mi * cr.dh;
                if (c.type === 'heater') sums.heat += cr.q;
                if (c.type === 'humid') {
                    sums.humidKg += cr.water;
                    if (c.kind === 'steam') sums.steam += cr.steam || 0; else sums.adiaKg += cr.water;
                }
            } else if (c.type === 'fan') cr.q = cr.elec;
        });

        // Afvoerlucht: na de WTW, daarna retourventilatoren ná de WTW
        exhaust = hrOut || e;
        const me = mExh();
        for (const c of rets) if (c.type === 'fan' && c.pos !== 'before' && me > 0) exhaust = mkH(exhaust.h + fanP[c.id] / me, exhaust.x);

        const unmet = { dT: s.t - tg.tSup, tLow: false, tHigh: false, xLow: false, xHigh: false };
        if (normal) {
            unmet.tLow = s.t < tg.tSup - T_TOL;
            unmet.tHigh = s.t > tg.tSup + T_TOL;
            unmet.xLow = xMin > 0 && s.x < xMin - X_TOL;
            unmet.xHigh = isFinite(xMax) && s.x > xMax + X_TOL;
        }
        return { out, ret: r0, retFan: eRec, exhaust, supply: s, points, comps, sums, unmet, targets: tg, m, mRet, mExh: me, r };

        /** WTW met modulatie, vorstbeveiliging en optioneel indirect adiabatisch koelen. */
        function recover(c, s1, eIn0, i) {
            const info = { phi: 0, frost: false, iecKg: 0 };
            const ms = mAt(i), me = mExh();
            if (passive || ms <= 0 || me <= 0) return { s: s1, info, exhaust: null };
            const eta = c.eta / 100 * Math.min(1, me / ms);       // onbalans: minder rendement aan de toevoerzijde
            const etaX = wheel(c) ? c.etaX / 100 * Math.min(1, me / ms) : 0;
            const dtd = dTdown(i, s1.x);
            const tNeedHeat = Math.max(tg.tSup - dtd, pl.adiAfter[i] >= 0 ? adiNeed(pl.adiAfter[i], s1.x) : -Infinity);
            const tNeedCool = tg.tSup - dtd;
            let eIn = eIn0, heat = false;
            if (normal && c.iec && s1.t > tNeedCool) {
                // Indirect adiabatisch: afvoerlucht vóór de WTW bevochtigen (langs de natteboltemperatuur)
                const tw = tSatAtH(eIn0.h, p), xw = P.satHumRatio(tw, p);
                const ec = mkH(eIn0.h, eIn0.x + c.iecEta / 100 * (xw - eIn0.x));
                if (ec.t < s1.t) { eIn = ec; info.iecKg = me * (ec.x - eIn0.x) * 3600; }
            }
            const t2f = s1.t + eta * (eIn.t - s1.t);
            const x2f = s1.x + etaX * (eIn.x - s1.x);
            let phi = 0;
            if (eIn.t > s1.t + 0.05 && s1.t < tNeedHeat) { phi = Math.min(1, (tNeedHeat - s1.t) / (t2f - s1.t)); heat = true; }
            else if (eIn.t < s1.t - 0.05 && s1.t > tNeedCool) phi = Math.min(1, (s1.t - tNeedCool) / (s1.t - t2f));
            if (phi <= 0 && info.iecKg) info.iecKg = 0;
            const supOut = (ph) => {
                const t2 = s1.t + ph * (t2f - s1.t);
                const x2 = Math.min(s1.x + ph * (x2f - s1.x), P.satHumRatio(t2, p));
                return mk(t2, x2);
            };
            const exhOut = (ph) => {
                const so = supOut(ph);
                const hE = eIn.h - ms * (so.h - s1.h) / me;
                const xE = Math.max(0, eIn.x - ms * (so.x - s1.x) / me);
                return sat(mkH(hE, xE), p);
            };
            // Vorstcontrole op de droge afvoertemperatuur (zonder condensatiewarmte: de koude hoek bevriest eerst)
            const exhDry = (ph) => eIn.t - ms * (P.CP_DA + P.CP_V * s1.x) * ph * (t2f - s1.t) / (me * (P.CP_DA + P.CP_V * eIn.x));
            if (heat && phi > 0 && exhDry(phi) < c.frost) {
                // Vorstbeveiliging: rendement terugregelen tot de afvoerlucht de vorstgrens haalt
                phi = Math.max(0, Math.min(phi, (eIn.t - c.frost) / (ms * (P.CP_DA + P.CP_V * s1.x) * (t2f - s1.t) / (me * (P.CP_DA + P.CP_V * eIn.x)))));
                info.frost = true;
            }
            info.phi = phi;
            info.eta = phi * eta * 100;
            return { s: supOut(phi), info, exhaust: phi > 0 ? exhOut(phi) : (info.iecKg ? eIn : eIn0) };
        }
    }

    /** Regelende mengkamer: meer recirculatie als dat warmte of koude bespaart. */
    function econShare(tOut, tRet, max, tNeedHeat, tNeedCool) {
        if (tOut < tNeedHeat && tRet > tOut) return Math.min(max, (tNeedHeat - tOut) / (tRet - tOut));
        if (tOut > tNeedCool && tRet < tOut) return Math.min(max, (tOut - tNeedCool) / (tOut - tRet));
        return 0;
    }

    // =====================================================================
    // Ontwerpcondities en controle
    // =====================================================================
    /** Reken de LBK door bij winter- en zomerontwerpcondities (volle bezetting, 100 % debiet). */
    function designPoints(u, p) {
        const pl = compile(u, p);
        const pt = (q) => step(pl, { t: q.t, x: P.xFromTRh(q.t, q.rh, p) }, { f: 1, mode: 'normal', occ: 1 });
        return { win: pt(u.design.win), sum: pt(u.design.sum), plan: pl };
    }

    /** Kerngegevens: drukverliezen, ventilatorvermogens en SFP bij ontwerpdebiet. */
    function summary(u, p) {
        const pl = compile(u, p);
        const sup = pl.supFans.reduce((a, c) => a + pl.fanDes[c.id].P, 0);
        const ret = pl.retFans.reduce((a, c) => a + pl.fanDes[c.id].P, 0);
        return {
            dpSup: pl.dpSupInt, dpRet: pl.dpRetInt, fanSup: sup, fanRet: ret,
            sfpSup: pl.V > 0 ? sup / pl.V : 0, sfpRet: pl.V * pl.retRatio > 0 ? ret / (pl.V * pl.retRatio) : 0,
            mDes: pl.mDes, V: pl.V
        };
    }
    /** SFP-klasse volgens NEN-EN 16798-3 (per ventilator, kW/(m³/s)). */
    function sfpClass(v) {
        const lim = [0.5, 0.75, 1.25, 2, 3, 4.5];
        const i = lim.findIndex((l) => v <= l);
        return i < 0 ? 7 : i + 1;
    }

    /** Adviezen bij de samenstelling (codes; de weergave vertaalt ze). */
    function check(u, dp) {
        const out = [];
        const chain = u.comps.filter((c) => c.on !== false);
        const has = (t) => chain.some((c) => c.type === t);
        const idx = (pred) => chain.findIndex(pred);
        if (!chain.length) { out.push({ level: 'info', code: 'empty' }); return out; }
        if (!has('fan')) out.push({ level: 'warn', code: 'noFan' });
        if (has('hr') && u.retFlow <= 0) out.push({ level: 'warn', code: 'hrNoRet' });
        if (has('hr') && !u.retComps.some((c) => c.on !== false && c.type === 'fan')) out.push({ level: 'info', code: 'noRetFan' });
        const iCool = idx((c) => c.type === 'cooler');
        if (iCool >= 0 && u.sup.xMaxOn && !chain.some((c, j) => j > iCool && c.type === 'heater')) out.push({ level: 'warn', code: 'noReheat' });
        const iHum = idx((c) => c.type === 'humid');
        if (iHum >= 0 && !u.sup.xMinOn) out.push({ level: 'info', code: 'humidIdle' });
        if (iHum >= 0 && chain[iHum].kind === 'steam' && chain.some((c, j) => j > iHum && c.type === 'heater' && c.role === 'main')) out.push({ level: 'info', code: 'steamBeforeHeater' });
        if (iHum >= 0 && chain[iHum].kind === 'adiabatic' && !chain.some((c, j) => j < iHum && c.type === 'heater')) out.push({ level: 'warn', code: 'adiaNoHeater' });
        if (iCool >= 0 && !u.sup.xMaxOn) out.push({ level: 'info', code: 'coolNoDehum' });
        for (const key of ['win', 'sum']) {
            const r = dp[key];
            const tg = r.targets;
            const capped = chain.filter((c) => r.comps[c.id] && r.comps[c.id].capped).map((c) => c.id);
            if (r.unmet.tLow) out.push({ level: 'warn', code: has('heater') || key === 'sum' ? 'tLow' : 'noHeater', cond: key, dT: tg.tSup - r.supply.t, capped });
            if (r.unmet.tHigh) out.push({ level: key === 'sum' ? 'warn' : 'info', code: has('cooler') || key === 'win' ? 'tHigh' : 'noCooler', cond: key, dT: r.supply.t - tg.tSup, capped });
            if (r.unmet.xLow) out.push({ level: 'warn', code: has('humid') ? 'xLow' : 'noHumid', cond: key, dx: (tg.xMin - r.supply.x) * G, capped });
            if (r.unmet.xHigh) out.push({ level: 'warn', code: has('cooler') ? 'xHigh' : 'noDehum', cond: key, dx: (r.supply.x - tg.xMax) * G, capped });
            const hr = chain.find((c) => c.type === 'hr');
            if (hr && r.comps[hr.id] && r.comps[hr.id].frost) out.push({ level: 'info', code: 'frost', cond: key, eta: r.comps[hr.id].eta });
        }
        if (!out.some((w) => w.level === 'warn')) out.push({ level: 'ok', code: 'ok' });
        return out;
    }

    // =====================================================================
    // Jaarberekening
    // =====================================================================
    const monthOfHour = (() => {
        const mo = new Uint8Array(N);
        let h = 0;
        DAYS.forEach((d, i) => { for (let k = 0; k < d * 24; k++) mo[h++] = i; });
        return mo;
    })();

    /** Bedrijfstoestand per uur uit weekpatroon en instellingen buiten kantooruren. */
    function operation(u, schedule, startWeekday, T) {
        const ops = u.ops;
        const dayMax = new Float64Array(365).fill(-Infinity);
        if (ops.off === 'night') for (let h = 0; h < N; h++) dayMax[(h / 24) | 0] = Math.max(dayMax[(h / 24) | 0], T[h]);
        return (h) => {
            const day = (h / 24) | 0, hod = h % 24;
            const occ = schedule[(startWeekday - 1 + day) % 7][hod] / 100;
            if (occ > 0) return { mode: 'normal', occ, f: ops.control === 'cav' ? 1 : Math.max(ops.minFlow / 100, occ) };
            if (ops.off === 'vent') return { mode: 'normal', occ: 0, f: ops.offFlow / 100 };
            if (ops.off === 'eco') return { mode: 'eco', occ: 0, f: ops.offFlow / 100 };
            if (ops.off === 'night') {
                // Zomernachtventilatie na een warme dag: alleen ventilatoren, WTW in bypass
                const ref = hod < 12 ? dayMax[(day + 364) % 365] : dayMax[day];
                const tRet = targets(u, T[h]).tRet;
                if (ref >= ops.nightTrig && T[h] >= ops.nightTMin && T[h] <= tRet - 2) return { mode: 'night', occ: 0, f: ops.nightFlow / 100 };
            }
            return null;
        };
    }

    const zeroMonth = () => ({
        heat: 0, cool: 0, coolLat: 0, humidKg: 0, steam: 0, adiaKg: 0, iecKg: 0, fanSup: 0, fanRet: 0,
        recHeat: 0, recCool: 0, cond: 0, hoursOn: 0, hoursOcc: 0, unmetTLow: 0, unmetTHigh: 0, unmetXLow: 0, unmetXHigh: 0
    });
    const SUM_KEYS = Object.keys(zeroMonth());

    /**
     * Jaarberekening: 8760 uur, resultaten per maand (kWh, kg, uren), per component en piekwaarden.
     * clim: { T: [°C], x: [kg/kg], startWeekday }; cfg: { p, schedule (7 × 24, %) }.
     */
    function simulateYear(u, clim, cfg) {
        const pl = compile(u, cfg.p);
        const op = operation(u, cfg.schedule, clim.startWeekday || 1, clim.T);
        const months = Array.from({ length: 12 }, zeroMonth);
        const comps = {};
        for (const c of pl.chain) comps[c.id] = { pos: 0, neg: 0, water: 0, elec: 0, peak: 0, cappedHours: 0, frostHours: 0 };
        const hourly = { heat: new Float32Array(N), cool: new Float32Array(N), fan: new Float32Array(N), tSup: new Float32Array(N).fill(NaN) };
        const peaks = { heat: 0, cool: 0, humidKg: 0, fan: 0, heatHour: -1, coolHour: -1 };
        for (let h = 0; h < N; h++) {
            const st = op(h);
            if (!st || st.f <= 0) continue;
            const r = step(pl, { t: clim.T[h], x: clim.x[h] }, st);
            const M = months[monthOfHour[h]], s = r.sums;
            M.hoursOn++;
            if (st.occ > 0) {
                M.hoursOcc++;
                if (r.unmet.tLow) M.unmetTLow++;
                if (r.unmet.tHigh) M.unmetTHigh++;
                if (r.unmet.xLow) M.unmetXLow++;
                if (r.unmet.xHigh) M.unmetXHigh++;
            }
            M.heat += s.heat; M.cool += s.cool; M.coolLat += s.coolLat; M.humidKg += s.humidKg; M.steam += s.steam;
            M.adiaKg += s.adiaKg; M.iecKg += s.iecKg; M.fanSup += r.fanSup; M.fanRet += r.fanRet; M.cond += s.cond;
            if (s.recovered > 0) M.recHeat += s.recovered; else M.recCool -= s.recovered;
            for (const c of pl.chain) {
                const cr = r.comps[c.id], acc = comps[c.id];
                if (cr.q > 0) acc.pos += cr.q; else acc.neg -= cr.q;
                acc.water += cr.water;
                acc.elec += cr.elec;
                acc.peak = Math.max(acc.peak, Math.abs(cr.type === 'humid' ? cr.water : cr.q));
                if (cr.capped) acc.cappedHours++;
                if (cr.frost) acc.frostHours++;
            }
            const fan = r.fanSup + r.fanRet;
            hourly.heat[h] = s.heat; hourly.cool[h] = s.cool; hourly.fan[h] = fan; hourly.tSup[h] = r.supply.t;
            if (s.heat > peaks.heat) { peaks.heat = s.heat; peaks.heatHour = h; }
            if (s.cool > peaks.cool) { peaks.cool = s.cool; peaks.coolHour = h; }
            peaks.humidKg = Math.max(peaks.humidKg, s.humidKg);
            peaks.fan = Math.max(peaks.fan, fan);
        }
        const total = zeroMonth();
        for (const M of months) for (const k of SUM_KEYS) total[k] += M[k];
        return { months, total, comps, peaks, hourly };
    }

    /** Eindenergie en kosten uit de thermische jaarcijfers (kWh, kg) en de opwekking van de LBK. */
    function finalEnergy(t, gen, tar) {
        const part = () => ({ elec: 0, gas: 0, gj: 0, water: 0, cost: 0 });
        const parts = { heat: part(), cool: part(), humid: part(), fan: part() };
        const hp = parts.heat;
        if (gen.heat === 'boiler') hp.gas = t.heat / (gen.etaHeat / 100) / GAS_KWH;
        else if (gen.heat === 'hp') hp.elec = t.heat / gen.scop;
        else if (gen.heat === 'district') hp.gj = t.heat * 0.0036 / (gen.etaHeat / 100);
        else hp.elec = t.heat / (gen.etaHeat / 100);
        parts.cool.elec = t.cool / gen.seer;
        if (gen.steam === 'gas') parts.humid.gas = t.steam / (gen.etaSteam / 100) / GAS_KWH;
        else parts.humid.elec = t.steam / (gen.etaSteam / 100);
        parts.humid.water = (t.humidKg + (t.iecKg || 0)) / 1000;
        parts.fan.elec = t.fanSup + t.fanRet;
        const sum = part();
        for (const k of Object.keys(parts)) {
            const q = parts[k];
            q.cost = q.elec * tar.elec + q.gas * tar.gas + q.gj * tar.heat + q.water * tar.water;
            for (const f of Object.keys(sum)) sum[f] += q[f];
        }
        return { parts, sum };
    }

    /** Weekpatroon: bedrijfsuren per week, gemiddelde bezetting en uren per jaar. */
    function scheduleStats(schedule, startWeekday = 1) {
        let hours = 0, occSum = 0, year = 0;
        for (const row of schedule) for (const v of row) if (v > 0) { hours++; occSum += v; }
        for (let d = 0; d < 365; d++) year += schedule[(startWeekday - 1 + d) % 7].filter((v) => v > 0).length;
        return { hours, mean: hours ? occSum / hours : 0, year };
    }

    return {
        RHO_REF, H_STEAM, T_FEED, GAS_KWH, N, DAYS, T_TOL, X_TOL, MAX_UNITS, MAX_COMPS, MAX_RET,
        TYPES, SUP_TYPES, RET_TYPES, KIND_DEFAULTS,
        fieldsOf, makeComp, setKind, normalizeComp,
        defaultSchedule, defaultUnit, defaultEnergy, defaultState, normalizeUnit, normalizeState, normalizeSchedule,
        exampleUnit, propose, targets, compile, step, designPoints, summary, sfpClass, check,
        operation, simulateYear, finalEnergy, scheduleStats, monthOfHour, coil, tSatAtH, uid
    };
});
