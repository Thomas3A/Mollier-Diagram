/**
 * app.js — applicatielogica Mollier h,x-diagram
 *
 * Project (ongedaan te maken): druk, scenario's met beginpunt, debiet en processtappen.
 * Voorkeuren (niet in geschiedenis): taal, thema, diagramtype, lagen, bereik, comfortzone.
 * Alles wordt automatisch in localStorage bewaard; delen via een link met gecomprimeerd project.
 */
(function () {
    'use strict';

    const P = window.Psychro, PR = window.Processes, I = window.I18N;
    const { t, fmt, fmtAuto: fmtA, parseNum } = I;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
    const uid = () => Math.random().toString(36).slice(2, 9);
    const clone = (o) => JSON.parse(JSON.stringify(o));

    const STORE_PROJECT = 'mollier.project.v4';
    const STORE_PREFS = 'mollier.prefs';
    const STORE_LEGACY = 'psychro-project';

    // Scenariokleuren: rood, violet, aqua, geel, blauw, magenta (gevalideerd op kleurenblindheid, eerste drie paarsgewijs)
    const PALETTE = {
        light: ['#e34948', '#4a3aa7', '#1baf7a', '#eda100', '#2a78d6', '#d55181'],
        dark: ['#e66767', '#9085e9', '#199e70', '#c98500', '#3987e5', '#d55181']
    };
    const RANGE_PRESETS = {
        standard: { tMin: -20, tMax: 50, xMax: 30 },
        hvac: { tMin: 0, tMax: 40, xMax: 20 },
        winter: { tMin: -25, tMax: 30, xMax: 15 },
        hot: { tMin: 0, tMax: 90, xMax: 80 }
    };
    const DEFAULT_PREFS = {
        lang: 'nl', theme: 'auto', chart: 'mollier', tab: 'states',
        layers: { iso: true, rh: true, h: true, wb: false, rho: false, fog: true, comfort: true, edge: false, pw: true, values: false },
        range: Object.assign({}, RANGE_PRESETS.standard),
        comfort: { tMin: 20, tMax: 26, rhMin: 30, rhMax: 70, xMax: 11.5 }
    };

    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privémodus of vol */ } }
    };

    // ---- Toestand ----
    let prefs = loadPrefs();
    let project = null;
    let results = {};
    let chart = null;
    let lastChartP = null;
    const hist = { undo: [], redo: [], base: null };
    const ui = {
        selected: null,          // { scnId, n }
        highlight: null,         // { scnId, stepId }
        hover: null,
        preview: null,
        form: null,              // { cat, type, params, label, editingId }
        paramsByType: {},
        lastTypeByCat: {}
    };

    // =====================================================================
    // Project
    // =====================================================================
    function makeStep(type, params, label) {
        return { id: uid(), type, enabled: true, label: label || '', params: PR.defaultParams(type, params) };
    }
    function makeScenario(name, color, start, flow, steps) {
        return { id: uid(), name, color, visible: true, start, flow, steps: steps || [] };
    }

    function exampleProject() {
        const w = makeScenario(t('example.winter'), 0, { pair: 't-rh', a: -10, b: 90 }, { mode: 'volume', value: 5000 }, [
            makeStep('hr', { hrType: 'sensible', eff: 75, tRet: 21, rhRet: 35 }),
            makeStep('heat', { mode: 'toT', value: 20 }),
            makeStep('steam', { mode: 'toRH', value: 40, tSteam: 100 }),
            makeStep('fan', { dp: 600, eff: 65 })
        ]);
        const z = makeScenario(t('example.summer'), 1, { pair: 't-rh', a: 28, b: 50 }, { mode: 'volume', value: 5000 }, [
            makeStep('coil', { tAdp: 9, mode: 'bf', value: 0.12 }),
            makeStep('heat', { mode: 'toT', value: 16 }),
            makeStep('fan', { dp: 600, eff: 65 })
        ]);
        return { version: 4, name: t('example.name'), pressure: { mode: 'altitude', altitude: 0, kpa: 101.325 }, active: w.id, scenarios: [w, z] };
    }

    function emptyProject() {
        const sc = makeScenario(t('scn.newName', { n: 1 }), 0, { pair: 't-rh', a: 20, b: 50 }, { mode: 'volume', value: 1000 });
        return { version: 4, name: t('example.newName'), pressure: { mode: 'altitude', altitude: 0, kpa: 101.325 }, active: sc.id, scenarios: [sc] };
    }

    /** Alleen eindige getallen en korte strings uit onbekende invoer overnemen. */
    function sanitizeParams(prm) {
        const out = {};
        if (!prm || typeof prm !== 'object') return out;
        for (const [k, v] of Object.entries(prm)) {
            if (typeof v === 'number' && isFinite(v)) out[k] = v;
            else if (typeof v === 'string' && v.length < 40) out[k] = v;
        }
        return out;
    }

    /** Valideer en vul een geladen/gedeeld project aan. Oude versie (v3) wordt omgezet. */
    function normalize(pj) {
        if (!pj || typeof pj !== 'object') throw new Error('invalid');
        if (!Array.isArray(pj.scenarios)) {
            if (pj.initialState || pj.processes || pj.states) return migrateV3(pj);
            throw new Error('invalid');
        }
        const pr = pj.pressure || {};
        const out = {
            version: 4,
            name: String(pj.name || t('example.newName')).slice(0, 120),
            pressure: {
                mode: pr.mode === 'pressure' ? 'pressure' : 'altitude',
                altitude: isFinite(pr.altitude) ? +pr.altitude : 0,
                kpa: isFinite(pr.kpa) ? +pr.kpa : 101.325
            },
            active: String(pj.active || ''),
            scenarios: []
        };
        const ids = new Set();
        for (const s of pj.scenarios.slice(0, 12)) {
            if (!s || typeof s !== 'object') continue;
            let id = String(s.id || uid()).slice(0, 20);
            if (ids.has(id)) id = uid();
            ids.add(id);
            const st = s.start || {};
            const start = P.PAIRS.includes(st.pair) && isFinite(st.a) && isFinite(st.b)
                ? { pair: st.pair, a: +st.a, b: +st.b } : { pair: 't-rh', a: 20, b: 50 };
            const flow = { mode: s.flow && s.flow.mode === 'mass' ? 'mass' : 'volume', value: Math.max(0, Number(s.flow && s.flow.value) || 0) };
            const stepIds = new Set();
            const steps = (Array.isArray(s.steps) ? s.steps : []).filter((x) => x && PR.TYPES[x.type]).slice(0, 80).map((x) => {
                let sid = String(x.id || uid()).slice(0, 20);
                if (stepIds.has(sid)) sid = uid();
                stepIds.add(sid);
                return { id: sid, type: x.type, enabled: x.enabled !== false, label: String(x.label || '').slice(0, 80), params: PR.defaultParams(x.type, sanitizeParams(x.params)) };
            });
            out.scenarios.push({ id, name: String(s.name || '—').slice(0, 40), color: Math.abs(parseInt(s.color, 10) || 0) % 6, visible: s.visible !== false, start, flow, steps });
        }
        if (!out.scenarios.length) return emptyProject();
        if (!out.scenarios.some((s) => s.id === out.active)) out.active = out.scenarios[0].id;
        return out;
    }

    /** Project uit de vorige versie (psychro-project / export v3.0) omzetten. */
    function migrateV3(old) {
        const s0 = old.initialState || (Array.isArray(old.states) ? old.states[0] : null);
        const start = s0 && isFinite(s0.Tdb) && isFinite(s0.RH)
            ? { pair: 't-rh', a: round(s0.Tdb, 2), b: round(Math.min(100, Math.max(0.1, s0.RH)), 2) }
            : { pair: 't-rh', a: 20, b: 50 };
        const map = {
            'heat-to-temp': (p) => ['heat', { mode: 'toT', value: p.targetTemp }],
            'heat-by-delta': (p) => ['heat', { mode: 'dT', value: Math.abs(p.deltaT) }],
            'heat-by-power': (p) => ['heat', { mode: 'power', value: p.power }],
            'heat-to-enthalpy': (p) => ['heat', { mode: 'toH', value: p.targetH }],
            'cool-to-temp': (p) => ['cool', { mode: 'toT', value: p.targetTemp }],
            'cool-by-delta': (p) => ['cool', { mode: 'dT', value: Math.abs(p.deltaT) }],
            'cool-by-power': (p) => ['cool', { mode: 'power', value: p.power }],
            'cool-dehumid': (p) => ['cooldehum', { t: p.targetTemp, rh: p.targetRH }],
            'humid-adiabatic': (p) => ['adiabatic', { mode: p.targetType === 'rh' ? 'toRH' : 'toX', value: p.value }],
            'humid-steam': (p) => ['steam', { mode: p.targetType === 'rh' ? 'toRH' : 'toX', value: p.value, tSteam: p.steamTemp }],
            'humid-to-rh': (p) => ['steam', { mode: 'toRH', value: p.targetRH }],
            'humid-by-delta-x': (p) => ['spray', { mode: 'dX', value: Math.abs(p.deltaX), tWater: p.waterTemp }],
            'humid-by-water-flow': (p) => ['spray', { mode: 'flow', value: p.waterFlow, tWater: p.waterTemp }],
            'dehumid-to-rh': (p) => ['dehum', { mode: 'toRH', value: p.targetRH }],
            'dehumid-by-delta-x': (p) => ['dehum', { mode: 'dX', value: Math.abs(p.deltaX) }],
            'dehumid-by-water-flow': (p) => ['dehum', { mode: 'flow', value: p.waterFlow }],
            'mix-streams': (p) => ['mix', { t2: p.mixTemp, hum: 'rh', b2: p.mixRH, flowMode: 'fraction', flow2: round(100 / (1 + (p.mixRatio || 1)), 2) }],
            'custom-point': (p) => ['point', { pair: 't-rh', a: p.customTemp, b: p.customRH }]
        };
        const steps = (Array.isArray(old.processes) ? old.processes : [])
            .map((pr) => (pr && map[pr.type] && pr.params ? map[pr.type](pr.params) : null))
            .filter(Boolean)
            .map(([type, params]) => makeStep(type, sanitizeParams(params)));
        const settings = old.settings || {};
        const alt = isFinite(old.altitude) ? +old.altitude : isFinite(settings.altitude) ? +settings.altitude : 0;
        const flow = isFinite(old.airflow) ? +old.airflow : isFinite(settings.airflow) ? +settings.airflow : 1000;
        const sc = makeScenario(t('scn.newName', { n: 1 }), 0, start, { mode: 'volume', value: flow }, steps);
        return { version: 4, name: t('example.newName'), pressure: { mode: 'altitude', altitude: alt, kpa: 101.325 }, active: sc.id, scenarios: [sc] };
    }

    const activeScn = () => project.scenarios.find((s) => s.id === project.active) || project.scenarios[0];
    const activeRes = () => results[activeScn().id];
    const findStep = (sc, id) => sc.steps.find((s) => s.id === id);

    function pressure() {
        const pr = project.pressure;
        if (pr.mode === 'pressure') return (pr.kpa >= 30 && pr.kpa <= 120 ? pr.kpa : 101.325) * 1000;
        return P.pressureFromAltitude(pr.altitude >= -500 && pr.altitude <= 9000 ? pr.altitude : 0);
    }

    function recompute() {
        const p = pressure();
        results = {};
        for (const sc of project.scenarios) results[sc.id] = PR.computeScenario(sc, p);
    }

    // ---- Geschiedenis (ongedaan maken) ----
    const snapshot = () => JSON.stringify(project);
    function beginEdit() { if (hist.base === null) hist.base = snapshot(); }
    function commit() {
        if (hist.base === null) return;
        const now = snapshot();
        if (now !== hist.base) {
            hist.undo.push(hist.base);
            if (hist.undo.length > 200) hist.undo.shift();
            hist.redo = [];
            saveLocal();
        }
        hist.base = null;
        updateUndoButtons();
    }
    /** Wijzig het project. live = tijdens typen/slepen: nog niet vastleggen in de geschiedenis. */
    function change(fn, live = false) {
        beginEdit();
        fn(project);
        if (!live) commit();
        recompute();
        render();
    }
    function replaceProject(pj, msg) {
        commit();
        hist.undo.push(snapshot());
        hist.redo = [];
        project = pj;
        afterReplace();
        if (msg) toast(msg);
    }
    function afterReplace() {
        ui.selected = null;
        ui.highlight = null;
        if (ui.form.editingId && !findStep(activeScn(), ui.form.editingId)) resetForm();
        saveLocal();
        recompute();
        renderAll();
    }
    function undo() {
        commit();
        if (!hist.undo.length) return;
        hist.redo.push(snapshot());
        project = JSON.parse(hist.undo.pop());
        afterReplace();
        toast(t('toast.undo'));
    }
    function redo() {
        commit();
        if (!hist.redo.length) return;
        hist.undo.push(snapshot());
        project = JSON.parse(hist.redo.pop());
        afterReplace();
        toast(t('toast.redo'));
    }
    function updateUndoButtons() {
        $('#btn-undo').disabled = !hist.undo.length && hist.base === null;
        $('#btn-redo').disabled = !hist.redo.length;
    }

    // ---- Opslag ----
    function saveLocal() { store.set(STORE_PROJECT, snapshot()); }
    function loadPrefs() {
        let p = {};
        try { p = JSON.parse(store.get(STORE_PREFS) || '{}') || {}; } catch (e) { p = {}; }
        return {
            lang: I.languages.includes(p.lang) ? p.lang : DEFAULT_PREFS.lang,
            theme: ['auto', 'light', 'dark'].includes(p.theme) ? p.theme : 'auto',
            chart: p.chart === 'psychro' ? 'psychro' : 'mollier',
            tab: p.tab === 'steps' ? 'steps' : 'states',
            layers: Object.assign({}, DEFAULT_PREFS.layers, p.layers || {}),
            range: validRange(p.range) ? p.range : Object.assign({}, DEFAULT_PREFS.range),
            comfort: Object.assign({}, DEFAULT_PREFS.comfort, p.comfort || {})
        };
    }
    function savePrefs() { store.set(STORE_PREFS, JSON.stringify(prefs)); }
    function validRange(r) {
        return r && isFinite(r.tMin) && isFinite(r.tMax) && isFinite(r.xMax)
            && r.tMin >= -90 && r.tMax <= 190 && r.tMax - r.tMin >= 5 && r.xMax >= 1 && r.xMax <= 500;
    }

    function initialProject() {
        const raw = store.get(STORE_PROJECT);
        if (raw) {
            try { return { pj: normalize(JSON.parse(raw)) }; } catch (e) { /* beschadigd: val terug */ }
        }
        const legacy = store.get(STORE_LEGACY);
        if (legacy) {
            try { return { pj: normalize(JSON.parse(legacy)), msg: t('toast.migrated') }; } catch (e) { /* negeren */ }
        }
        return { pj: exampleProject() };
    }

    // =====================================================================
    // Opmaak-hulpjes
    // =====================================================================
    const fmtIn = (v) => (isFinite(v) ? fmtA(v, 3) : '');
    const signed = (v, d) => (isFinite(v) ? (v > 0 ? '+' : '') + fmt(v, d) : '—');
    const themeResolved = () => (prefs.theme === 'auto'
        ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : prefs.theme);
    const scnColor = (sc) => PALETTE[themeResolved()][sc.color % 6];

    function errMsg(e) {
        if (!e) return t('err.generic');
        if (e.code) {
            const data = {};
            for (const [k, v] of Object.entries(e.data || {})) data[k] = typeof v === 'number' ? fmt(v, 1) : v;
            const m = t('err.' + e.code, data);
            return m === 'err.' + e.code ? t('err.generic') : m;
        }
        return t('err.generic');
    }

    function pairLabel(pair) {
        const [a, b] = pair.split('-');
        return `${t('qs.' + a)} + ${t('qs.' + b)}  (${t('q.' + a).toLowerCase()}, ${t('q.' + b).toLowerCase()})`;
    }

    function describe(st) {
        if (st.label) return st.label;
        const prm = st.params;
        const v = (k, d = 2) => fmtA(prm[k], d);
        switch (st.type) {
            case 'heat': case 'cool': case 'adiabatic': case 'steam': case 'spray': case 'dehum': case 'desiccant':
                return t(`desc.${st.type}.${prm.mode}`, { v: v('value', 3) });
            case 'coil': return t(`desc.coil.${prm.mode}`, { v: v('value', 3), tAdp: v('tAdp') });
            case 'cooldehum': return t('desc.cooldehum', { t: v('t'), rh: v('rh') });
            case 'mix': return t(`desc.mix.${prm.flowMode}`, { t2: v('t2'), b2: prm.hum === 'x' ? `${v('b2')} g/kg` : `${v('b2')} %`, flow2: v('flow2') });
            case 'hr': return t(`desc.hr.${prm.hrType}`, { eff: v('eff'), effX: v('effX') });
            case 'load': return t('desc.load', { qs: v('qs'), mw: v('mw') });
            case 'fan': return t('desc.fan', { dp: v('dp', 0), eff: v('eff') });
            case 'point': {
                const [qa, qb] = prm.pair.split('-');
                return t('desc.point', { a: `${v('a')} ${PR.PAIR_UNITS[qa]}`, b: `${v('b')} ${PR.PAIR_UNITS[qb]}` });
            }
            default: return st.type;
        }
    }

    function infoText(r) {
        const i = r.info || {};
        const parts = [];
        if (i.bf != null) parts.push(t('info.bf', { bf: fmt(i.bf, 3), adp: fmt(i.tAdp, 1) }));
        if (i.dry) parts.push(t('info.dry'));
        if (i.eff != null && r.kind === 'humid') parts.push(t('info.eff', { eff: fmt(i.eff, 0) }));
        if (i.share != null) parts.push(t('info.share', { share: fmt(i.share, 1) }));
        if (r.kind === 'load') parts.push(t('info.gamma', { g: fmt(r.gamma, 0) }));
        if (i.power != null) parts.push(t('info.power', { p: fmt(i.power, 2) }));
        return parts.join(' · ');
    }

    function fieldLabel(type, key, prm) {
        if (key === 'value') {
            const k = `valBy.${type}.${prm.mode}`;
            return I.has(k) ? t(k) : t('val.' + prm.mode);
        }
        if (key === 'flow2') return t(`fieldBy.mix.flow2.${prm.flowMode}`);
        if (I.has(`fieldBy.${type}.${key}`)) return t(`fieldBy.${type}.${key}`);
        if (type === 'point' && (key === 'a' || key === 'b')) return t('q.' + prm.pair.split('-')[key === 'a' ? 0 : 1]);
        if (key === 'b2') return prm.hum === 'x' ? t('q.x') : t('q.rh');
        return t('field.' + key);
    }
    function optLabel(key, o) {
        if (key === 'mode') return t('mode.' + o);
        if (key === 'pair') return pairLabel(o);
        return t('opt.' + o);
    }

    // =====================================================================
    // Rendering
    // =====================================================================
    function applyI18n() {
        document.documentElement.lang = I.lang;
        $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
        $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
        $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
        $('#btn-lang').textContent = I.lang === 'nl' ? 'EN' : 'NL';
        document.title = `${project.name} · ${t('app.title')}`;
        // Categorieën
        $('#cat-grid').innerHTML = PR.CATEGORIES.map((c) =>
            `<button type="button" class="cat-btn" role="tab" data-cat="${c.id}"><svg><use href="#c-${c.id}"/></svg>${esc(t('cat.' + c.id))}</button>`).join('');
        // Invoerparen beginpunt
        $('#start-pair').innerHTML = P.PAIRS.map((p) => `<option value="${p}">${esc(pairLabel(p))}</option>`).join('');
    }

    function renderAll() {
        applyI18n();
        renderScenarioPanel();
        renderStartPanel(true);
        renderSystem(true);
        renderForm();
        renderChartChrome();
        render();
    }

    /** Alles wat van de rekenresultaten afhangt. */
    function render() {
        renderScenarioTabs();
        renderStartPanel(false);
        renderSystem(false);
        renderSteps();
        renderKPIs();
        renderTables();
        updatePreview();
        updateChart();
        updateUndoButtons();
        document.title = `${project.name} · ${t('app.title')}`;
    }

    function setVal(el, v) { if (document.activeElement !== el) el.value = v; }

    // ---- Scenario's ----
    function renderScenarioTabs() {
        $('#scn-tabs').innerHTML = project.scenarios.map((sc) => {
            const r = results[sc.id];
            const bad = r.error || r.steps.some((s) => !s.ok && !s.skipped);
            return `<button type="button" role="tab" class="scn-tab${sc.visible ? '' : ' hidden-scn'}" data-id="${esc(sc.id)}"
                aria-selected="${sc.id === project.active}" style="--c:${scnColor(sc)}"><i class="dot"></i>${esc(sc.name)}${bad ? '<span class="err">!</span>' : ''}</button>`;
        }).join('');
        const sc = activeScn();
        document.documentElement.style.setProperty('--scn', scnColor(sc));
        $('#btn-scn-visible use').setAttribute('href', sc.visible ? '#i-eye' : '#i-eye-off');
        $$('#scn-colors .swatch').forEach((b, i) => b.setAttribute('aria-pressed', String(i === sc.color)));
        setVal($('#scn-name'), sc.name);
        $('#btn-scn-del').disabled = project.scenarios.length < 2;
    }

    function renderScenarioPanel() {
        const pal = PALETTE[themeResolved()];
        $('#scn-colors').innerHTML = pal.map((c, i) => `<button type="button" class="swatch" data-color="${i}" style="--c:${c}" aria-label="${i + 1}"></button>`).join('');
        setVal($('#project-name'), project.name);
        renderScenarioTabs();
    }

    // ---- Beginpunt ----
    function renderStartPanel(full) {
        const sc = activeScn(), r = results[sc.id];
        const [qa, qb] = sc.start.pair.split('-');
        if (full || document.activeElement !== $('#start-pair')) $('#start-pair').value = sc.start.pair;
        $('#start-a-lbl').textContent = t('q.' + qa);
        $('#start-b-lbl').textContent = t('q.' + qb);
        $('#start-a-unit').textContent = PR.PAIR_UNITS[qa];
        $('#start-b-unit').textContent = PR.PAIR_UNITS[qb];
        setVal($('#start-a'), fmtIn(sc.start.a));
        setVal($('#start-b'), fmtIn(sc.start.b));
        setVal($('#flow-value'), fmtIn(sc.flow.value));
        $('#flow-mode').value = sc.flow.mode;
        const strip = $('#start-summary');
        if (r.error) {
            strip.className = 'state-strip error';
            strip.textContent = errMsg(r.error);
        } else {
            const s = r.states[0];
            strip.className = 'state-strip';
            strip.innerHTML = [
                ['qs.t', fmt(s.t, 1), '°C'], ['qs.rh', fmt(s.rh, 1), '%'], ['qs.x', fmt(s.x * 1000, 2), 'g/kg'],
                ['qs.h', fmt(s.h, 1), 'kJ/kg'], ['qs.twb', fmt(s.twb, 1), '°C'], ['qs.tdp', fmt(s.tdp, 1), '°C']
            ].map(([k, v, u]) => `<div><span>${esc(t(k))}</span> <b>${v}</b> ${u}</div>`).join('');
        }
        const fs = $('#flow-summary');
        if (!r.error && r.mdot > 0) fs.textContent = t('start.mdot', { m: fmt(r.mdot, 3), v: fmt(r.mdot * r.states[0].v * 3600, 0) });
        else fs.textContent = r.error ? '' : t('start.noFlow');
        $('#start-badge').style.setProperty('--scn', scnColor(sc));
    }

    // ---- Systeem (luchtdruk) ----
    function renderSystem(full) {
        const pr = project.pressure;
        if (full || document.activeElement !== $('#p-mode')) $('#p-mode').value = pr.mode;
        $('#p-lbl').textContent = t(pr.mode === 'altitude' ? 'sys.altitude' : 'sys.pressure');
        $('#p-unit').textContent = pr.mode === 'altitude' ? 'm' : 'kPa';
        setVal($('#p-value'), fmtIn(pr.mode === 'altitude' ? pr.altitude : pr.kpa));
        const p = pressure();
        $('#p-summary').textContent = pr.mode === 'altitude'
            ? t('sys.result', { p: fmt(p / 1000, 3) })
            : t('sys.resultAlt', { p: fmt(p / 1000, 3), z: fmt(P.altitudeFromPressure(p), 0) });
    }

    // ---- Formulier processtap ----
    function resetForm(cat) {
        const c = cat || (ui.form && ui.form.cat) || 'heat';
        const type = ui.lastTypeByCat[c] || PR.CATEGORIES.find((x) => x.id === c).types[0];
        ui.form = { cat: c, type, params: clone(ui.paramsByType[type] || PR.defaultParams(type)), label: '', editingId: null };
    }

    function renderForm() {
        const f = ui.form;
        $('#form-title').textContent = t(f.editingId ? 'panel.edit' : 'panel.add');
        $('#panel-form').classList.toggle('editing', !!f.editingId);
        $$('#cat-grid .cat-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === f.cat)));
        const types = PR.CATEGORIES.find((c) => c.id === f.cat).types;
        $('#step-type').innerHTML = types.map((ty) => `<option value="${ty}">${esc(t('type.' + ty))}</option>`).join('');
        $('#step-type').value = f.type;
        $('#type-hint').textContent = t('typeHint.' + f.type);
        const fields = PR.TYPES[f.type].fields.filter((fd) => !fd.when || fd.when(f.params));
        $('#step-fields').innerHTML = fields.map((fd) => {
            const label = esc(fieldLabel(f.type, fd.key, f.params));
            if (fd.type === 'select') {
                const opts = fd.options.map((o) => `<option value="${o}"${o === f.params[fd.key] ? ' selected' : ''}>${esc(optLabel(fd.key, o))}</option>`).join('');
                return `<label class="fld full"><span class="fld-lbl">${label}</span><select class="input" data-key="${fd.key}" data-kind="select">${opts}</select></label>`;
            }
            const unit = PR.resolve(fd.unit, f.params) || '';
            return `<label class="fld"><span class="fld-lbl" title="${label}">${label}</span><span class="input-unit">`
                + `<input class="input" data-key="${fd.key}" data-kind="num" inputmode="decimal" autocomplete="off" value="${esc(fmtIn(f.params[fd.key]))}">`
                + `<em>${esc(unit)}</em></span></label>`;
        }).join('')
            + `<label class="fld full"><span class="fld-lbl">${esc(t('field.label'))}</span><input class="input" data-key="__label" data-kind="text" maxlength="80" value="${esc(f.label || '')}"></label>`;
        $('#btn-step-submit').textContent = t(f.editingId ? 'form.update' : 'form.add');
        $('#btn-step-cancel').hidden = !f.editingId;
        updatePreview();
    }

    /** Reken de stap uit het formulier live door en toon het resultaat + spookpad in het diagram. */
    function updatePreview() {
        const f = ui.form, box = $('#step-preview'), sc = activeScn();
        ui.preview = null;
        const bad = Object.values(f.params).some((v) => typeof v === 'number' && !isFinite(v));
        const base = results[sc.id];
        let ok = false;
        if (base.error) {
            box.className = 'preview-box error';
            box.textContent = t('form.needStart');
        } else if (bad) {
            box.className = 'preview-box error';
            box.textContent = t('err.ERR_INVALID');
        } else {
            const c = clone(sc);
            const id = f.editingId || '__preview';
            const st = { id, type: f.type, enabled: true, label: '', params: f.params };
            const idx = c.steps.findIndex((s) => s.id === f.editingId);
            if (idx >= 0) c.steps[idx] = st; else c.steps.push(st);
            const r = PR.computeScenario(c, pressure());
            const sr = r.steps.find((x) => x.step.id === id);
            if (sr && sr.ok) {
                ok = true;
                const s = sr.end;
                const items = [
                    [t('qs.t'), fmt(s.t, 1), '°C'], [t('qs.rh'), fmt(s.rh, 1), '%'], [t('qs.x'), fmt(s.x * 1000, 2), 'g/kg'], [t('qs.h'), fmt(s.h, 1), 'kJ/kg']
                ];
                if (sr.qt != null) items.push(['Q', signed(sr.qt, 2), 'kW']);
                if (Math.abs(sr.water) > 1e-6) items.push([t('tbl.water').split(' ')[0], signed(sr.water, 2), 'kg/h']);
                box.className = 'preview-box';
                box.innerHTML = `<div class="pv-title">${esc(t('form.result'))} → ${esc(t('chart.point', { n: s.n }))}${s.fog ? ' · ' + esc(t('tbl.fog')) : ''}</div>`
                    + items.map(([k, v, u]) => `<div><span>${esc(k)}</span> <b>${v}</b> ${u}</div>`).join('')
                    + (infoText(sr) ? `<div><span>${esc(infoText(sr))}</span></div>` : '');
                ui.preview = { path: sr.path, state: s, color: scnColor(sc) };
            } else if (sr && sr.skipped) {
                box.className = 'preview-box';
                box.textContent = t('steps.disabled');
            } else {
                box.className = 'preview-box error';
                box.textContent = errMsg(sr && sr.error);
            }
        }
        $('#btn-step-submit').disabled = !ok && !(f.editingId && findStep(sc, f.editingId) && findStep(sc, f.editingId).enabled === false);
    }

    function startEdit(stepId) {
        const sc = activeScn(), st = findStep(sc, stepId);
        if (!st) return;
        ui.form = { cat: PR.TYPES[st.type].cat, type: st.type, params: clone(st.params), label: st.label || '', editingId: st.id };
        renderForm();
        renderSteps();
        const panel = $('#panel-form');
        const rect = panel.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function submitForm() {
        const f = ui.form;
        if ($('#btn-step-submit').disabled) return;
        ui.paramsByType[f.type] = clone(f.params);
        if (f.editingId) {
            const id = f.editingId;
            change((pj) => {
                const st = findStep(pj.scenarios.find((s) => s.id === pj.active), id);
                if (st) { st.type = f.type; st.params = clone(f.params); st.label = (f.label || '').trim(); }
            });
            resetForm(f.cat);
            renderForm();
            render();
            toast(t('toast.stepUpdated'));
        } else {
            change((pj) => {
                pj.scenarios.find((s) => s.id === pj.active).steps.push(makeStep(f.type, clone(f.params), (f.label || '').trim()));
            });
            f.label = '';
            const lbl = $('#step-fields [data-key="__label"]');
            if (lbl) lbl.value = '';
            toast(t('toast.stepAdded'));
        }
    }

    // ---- Stappenlijst ----
    function renderSteps() {
        const sc = activeScn(), r = results[sc.id], color = scnColor(sc);
        const list = $('#step-list');
        $('#step-count').textContent = sc.steps.length ? t('steps.of', { n: sc.steps.length }) : '';
        if (!sc.steps.length) {
            list.innerHTML = `<li class="step-empty">${esc(t('steps.empty'))}</li>`;
            return;
        }
        list.innerHTML = r.steps.map((sr, i) => {
            const st = sr.step;
            let nr, sub, cls = '';
            if (sr.ok) {
                nr = `${sr.start.n}→${sr.end.n}`;
                const q = sr.qt != null
                    ? ` · <b class="${sr.qt >= 0 ? 'q-heat' : 'q-cool'}">Q ${signed(sr.qt, 2)} kW</b>` : '';
                const w = Math.abs(sr.water) > 1e-6 ? ` · ${signed(sr.water, 2)} kg/h` : '';
                const info = infoText(sr);
                sub = `Δt ${signed(sr.dt, 1)} K · Δx ${signed(sr.dx * 1000, 2)} g/kg${q}${w}${info ? ' · ' + esc(info) : ''}`;
            } else if (sr.skipped) {
                nr = '–'; cls = ' off'; sub = esc(t('steps.disabled'));
            } else {
                nr = '!'; cls = ' bad';
                sub = `<span class="err">${esc(sr.blocked ? t('steps.blocked') : errMsg(sr.error))}</span>`;
            }
            if (ui.form.editingId === st.id) cls += ' editing';
            if (ui.highlight && ui.highlight.stepId === st.id) cls += ' hl';
            return `<li class="step${cls}" data-id="${esc(st.id)}" style="--c:${color}" tabindex="0">
                <span class="step-nr">${nr}</span>
                <div class="step-main"><div class="step-title">${esc(describe(st))}</div><div class="step-sub${sr.ok || sr.skipped ? '' : ' err'}">${sub}</div></div>
                <div class="step-actions">
                    <button type="button" data-act="up" title="${esc(t('steps.up'))}" ${i === 0 ? 'disabled' : ''}><svg><use href="#i-up"/></svg></button>
                    <button type="button" data-act="down" title="${esc(t('steps.down'))}" ${i === sc.steps.length - 1 ? 'disabled' : ''}><svg><use href="#i-down"/></svg></button>
                    <button type="button" data-act="toggle" title="${esc(t('steps.toggle'))}"><svg><use href="#i-power"/></svg></button>
                    <button type="button" data-act="dup" title="${esc(t('steps.duplicate'))}"><svg><use href="#i-copy"/></svg></button>
                    <button type="button" data-act="del" class="del" title="${esc(t('steps.delete'))}"><svg><use href="#i-x"/></svg></button>
                </div></li>`;
        }).join('');
    }

    function stepAction(id, act) {
        change((pj) => {
            const sc = pj.scenarios.find((s) => s.id === pj.active);
            const i = sc.steps.findIndex((s) => s.id === id);
            if (i < 0) return;
            if (act === 'up' && i > 0) [sc.steps[i - 1], sc.steps[i]] = [sc.steps[i], sc.steps[i - 1]];
            if (act === 'down' && i < sc.steps.length - 1) [sc.steps[i + 1], sc.steps[i]] = [sc.steps[i], sc.steps[i + 1]];
            if (act === 'toggle') sc.steps[i].enabled = !sc.steps[i].enabled;
            if (act === 'dup') sc.steps.splice(i + 1, 0, Object.assign(clone(sc.steps[i]), { id: uid() }));
            if (act === 'del') sc.steps.splice(i, 1);
        });
        if (act === 'del' && ui.form.editingId === id) { resetForm(); renderForm(); }
    }

    // ---- KPI's ----
    function renderKPIs() {
        const r = activeRes();
        const hasFlow = !r.error && r.mdot > 0;
        const tot = r.totals || { heating: 0, cooling: 0, recovered: 0, fan: 0, humid: 0, dehum: 0 };
        const tile = (lbl, color, v, unit, d, sub) => {
            const zero = !hasFlow || !(Math.abs(v) > 1e-9);
            return `<div class="kpi${zero ? ' zero' : ''}"><div class="kpi-lbl"><i class="kpi-icon" style="background:${color}"></i>${esc(lbl)}</div>`
                + `<div class="kpi-val">${hasFlow ? fmt(v, d) : '—'}<small>${unit}</small></div><div class="kpi-sub">${sub || '&nbsp;'}</div></div>`;
        };
        const last = r.states.length ? r.states[r.states.length - 1] : null;
        const endTile = last
            ? `<div class="kpi"><div class="kpi-lbl"><i class="kpi-icon" style="background:${scnColor(activeScn())}"></i>${esc(t('kpi.final'))} · ${last.n}</div>`
                + `<div class="kpi-val">${fmt(last.t, 1)}<small>°C</small> ${fmt(last.rh, 0)}<small>%</small></div>`
                + `<div class="kpi-sub">x ${fmt(last.x * 1000, 2)} g/kg · h ${fmt(last.h, 1)} kJ/kg</div></div>`
            : `<div class="kpi zero"><div class="kpi-lbl">${esc(t('kpi.final'))}</div><div class="kpi-val">—</div><div class="kpi-sub">&nbsp;</div></div>`;
        $('#kpis').innerHTML = [
            tile(t('kpi.heating'), 'var(--heat)', tot.heating, 'kW', 1, tot.fan > 1e-6 && hasFlow ? esc(t('kpi.fan', { v: fmt(tot.fan, 1) })) : ''),
            tile(t('kpi.cooling'), 'var(--cool)', tot.cooling, 'kW', 1),
            tile(t('kpi.recovered'), 'var(--accent)', tot.recovered, 'kW', 1),
            tile(t('kpi.humid'), '#0ea5e9', tot.humid, 'kg/h', 2),
            tile(t('kpi.dehum'), '#64748b', tot.dehum, 'kg/h', 2),
            endTile
        ].join('');
    }

    // ---- Tabellen ----
    function renderTables() {
        const sc = activeScn(), r = results[sc.id], color = scnColor(sc);
        $('#results-scn').innerHTML = `<i style="--c:${color}"></i>${esc(sc.name)}`;
        $$('.results .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === prefs.tab)));
        $('#tbl-states').hidden = prefs.tab !== 'states';
        $('#tbl-steps').hidden = prefs.tab !== 'steps';

        const th = (lbl, unit, cls) => `<th${cls ? ` class="${cls}"` : ''}>${esc(lbl)}${unit ? `<span class="u">${unit}</span>` : ''}</th>`;
        // Toestanden
        const hasFlow = r.mdot > 0;
        let head = '<thead><tr>' + th(t('tbl.point'), '', 'l') + th(t('qs.t'), '°C') + th(t('qs.x'), 'g/kg') + th(t('qs.rh'), '%')
            + th(t('qs.h'), 'kJ/kg') + th(t('qs.twb'), '°C') + th(t('qs.tdp'), '°C') + th('ρ', 'kg/m³') + th('v', 'm³/kg') + th('p_w', 'Pa')
            + (hasFlow ? th('ṁ', 'kg/s') + th('V', 'm³/h') : '') + '</tr></thead>';
        let body;
        if (!r.states.length) body = `<tr class="empty"><td colspan="12">${esc(r.error ? errMsg(r.error) : t('tbl.emptyStates'))}</td></tr>`;
        else {
            body = r.states.map((s) => {
                const sel = ui.selected && ui.selected.scnId === sc.id && ui.selected.n === s.n;
                return `<tr data-n="${s.n}" class="${sel ? 'selected' : ''}"><td><span class="nr" style="--c:${color}">${s.n}</span></td>`
                    + `<td>${fmt(s.t, 2)}</td><td>${fmt(s.x * 1000, 3)}</td><td>${fmt(s.rh, 1)}${s.fog ? `<span class="tag">${esc(t('tbl.fog'))}</span>` : ''}</td>`
                    + `<td>${fmt(s.h, 2)}</td><td>${fmt(s.twb, 2)}</td><td>${fmt(s.tdp, 2)}</td><td>${fmt(s.rho, 4)}</td><td>${fmt(s.v, 4)}</td><td>${fmt(s.pw, 0)}</td>`
                    + (hasFlow ? `<td>${fmt(s.mdot, 4)}</td><td>${fmt(s.mdot * s.v * 3600, 0)}</td>` : '') + '</tr>';
            }).join('');
        }
        $('#tbl-states').innerHTML = head + '<tbody>' + body + '</tbody>';

        // Processen
        head = '<thead><tr>' + th(t('tbl.step'), '', 'l') + th(t('tbl.process'), '', 'l') + th('Δt', 'K') + th('Δx', 'g/kg') + th('Δh', 'kJ/kg')
            + th('Q_s', 'kW') + th('Q_l', 'kW') + th('Q', 'kW') + th(t('tbl.water').split(' ')[0], 'kg/h') + th(t('tbl.shr'), '–') + th(t('tbl.gamma'), 'kJ/kg') + '</tr></thead>';
        if (!r.steps.length) body = `<tr class="empty"><td colspan="11">${esc(t('tbl.emptySteps'))}</td></tr>`;
        else {
            const cq = (v) => (v == null ? '—' : `<span class="${v > 1e-9 ? 'pos' : v < -1e-9 ? 'neg' : ''}">${signed(v, 2)}</span>`);
            body = r.steps.map((sr) => {
                const st = sr.step;
                const hl = ui.highlight && ui.highlight.stepId === st.id ? ' hl' : '';
                if (!sr.ok) {
                    const msg = sr.skipped ? t('tbl.skipped') : sr.blocked ? t('steps.blocked') : errMsg(sr.error);
                    return `<tr data-step="${esc(st.id)}" class="${sr.skipped ? 'off' : 'bad'}${hl}"><td>${sr.skipped ? '–' : '!'}</td><td class="l">${esc(describe(st))}</td><td colspan="9" class="l">${esc(msg)}</td></tr>`;
                }
                return `<tr data-step="${esc(st.id)}" class="${hl}"><td><span class="nr" style="--c:${color}">${sr.start.n}→${sr.end.n}</span></td><td class="l">${esc(describe(st))}</td>`
                    + `<td>${signed(sr.dt, 2)}</td><td>${signed(sr.dx * 1000, 3)}</td><td>${signed(sr.dh, 2)}</td>`
                    + `<td>${cq(sr.qs)}</td><td>${cq(sr.ql)}</td><td><b>${cq(sr.qt)}</b></td>`
                    + `<td>${sr.kind === 'mix' || !hasFlow ? '—' : signed(sr.water, 2)}</td><td>${sr.shr == null ? '—' : fmt(sr.shr, 2)}</td><td>${Math.abs(sr.dx) < 1e-9 ? '∞' : fmt(sr.gamma, 0)}</td></tr>`;
            }).join('');
        }
        $('#tbl-steps').innerHTML = head + '<tbody>' + body + '</tbody>';
    }

    // ---- Diagram ----
    function chartLabels() {
        return {
            axisX: t('chart.axisX'), axisT: t('chart.axisT'), axisPw: t('chart.axisPw'), axisH: t('chart.axisH'),
            axisTPsy: t('chart.axisTPsy'), axisXPsy: t('chart.axisXPsy'), comfort: t('chart.comfort'),
            fog: t('chart.fogLabel'), edge: t('chart.edge'), aux: t('chart.aux')
        };
    }
    function chartOptions() {
        return {
            type: prefs.chart, p: pressure(), theme: themeResolved(), range: prefs.range, layers: prefs.layers,
            comfort: prefs.comfort, fmt, labels: chartLabels()
        };
    }
    function configureChart() {
        lastChartP = pressure();
        chart.configure(chartOptions());
        renderChartChrome();
    }

    function chartData() {
        return {
            scenarios: project.scenarios.map((sc, i) => {
                const r = results[sc.id];
                return {
                    id: sc.id, name: sc.name, index: i, color: scnColor(sc), active: sc.id === project.active, visible: sc.visible,
                    states: r.states, steps: r.steps, stepTypeOf: (id) => (findStep(sc, id) || {}).type
                };
            }),
            selected: ui.selected, highlight: ui.highlight, preview: ui.preview
        };
    }

    function updateChart() {
        if (!chart) return;
        if (pressure() !== lastChartP) { configureChart(); }
        chart.setData(chartData());
        renderStatus();
    }

    function renderChartChrome() {
        $$('#chart-type button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.type === prefs.chart)));
        $('#chart-title').textContent = t('chart.title', { type: t('chartType.' + prefs.chart), p: fmt(pressure() / 1000, 3) });
        const C = window.MollierChart.THEMES[themeResolved()];
        const m = prefs.chart === 'mollier';
        const chips = [
            ['rh', C.rh, ''], ['h', C.h, ''], ['iso', C.isoMajor, ''], ['wb', C.wb, 'dash'],
            ['rho', C.rho, 'dot', m ? 'layer.rhoM' : 'layer.rhoP'], ['fog', C.muted, 'box'], ['comfort', C.comfort, 'fill']
        ];
        if (m) chips.push(['edge', C.muted, ''], ['pw', C.axisText, '']);
        chips.push(['values', C.text, '']);
        $('#layer-chips').innerHTML = chips.map(([k, c, sw, lbl]) =>
            `<button type="button" class="layer-chip" data-layer="${k}" aria-pressed="${!!prefs.layers[k]}" style="--c:${c}"><i class="sw ${sw}"></i>${esc(t(lbl || 'layer.' + k))}</button>`).join('');
        renderRangePop();
    }

    function renderRangePop() {
        const R = prefs.range, C = prefs.comfort;
        const inp = (id, v) => `<input class="input" id="${id}" inputmode="decimal" value="${esc(fmtIn(v))}">`;
        const f = (lbl, id, v) => `<label class="fld"><span class="fld-lbl">${esc(t(lbl))}</span>${inp(id, v)}</label>`;
        $('#range-pop').innerHTML = `<div class="pop-sec"><div class="pop-title">${esc(t('range.title'))}</div>
            <div class="range-grid">${f('range.tMin', 'rg-tmin', R.tMin)}${f('range.tMax', 'rg-tmax', R.tMax)}${f('range.xMax', 'rg-xmax', R.xMax)}</div>
            <div class="preset-row">${Object.keys(RANGE_PRESETS).map((k) => `<button type="button" data-preset="${k}">${esc(t('range.' + k))}</button>`).join('')}</div></div>
            <div class="pop-sec"><div class="pop-title">${esc(t('range.comfortTitle'))}</div>
            <div class="range-grid">${f('range.ctMin', 'cf-tmin', C.tMin)}${f('range.ctMax', 'cf-tmax', C.tMax)}${f('range.cxMax', 'cf-xmax', C.xMax)}
            ${f('range.crhMin', 'cf-rhmin', C.rhMin)}${f('range.crhMax', 'cf-rhmax', C.rhMax)}</div></div>
            <div class="pop-sec"><button type="button" class="btn primary" id="rg-apply" style="width:100%">${esc(t('range.apply'))}</button></div>`;
    }

    function applyRange(preset) {
        const g = (id) => parseNum($('#' + id).value);
        const R = preset ? Object.assign({}, RANGE_PRESETS[preset]) : { tMin: g('rg-tmin'), tMax: g('rg-tmax'), xMax: g('rg-xmax') };
        if (!validRange(R)) { toast(t('err.ERR_INVALID'), true); return; }
        const C = { tMin: g('cf-tmin'), tMax: g('cf-tmax'), rhMin: g('cf-rhmin'), rhMax: g('cf-rhmax'), xMax: g('cf-xmax') };
        if ([C.tMin, C.tMax, C.rhMin, C.rhMax].every(isFinite) && C.tMax > C.tMin && C.rhMax > C.rhMin && C.rhMin >= 0 && C.rhMax <= 100) {
            if (!isFinite(C.xMax)) C.xMax = 0;
            prefs.comfort = C;
        }
        prefs.range = R;
        savePrefs();
        configureChart();
        closeMenus();
    }

    // ---- Statusbalk ----
    function renderStatus() {
        const sb = $('#statusbar');
        let info = ui.hover;
        let head;
        if (info && info.point && !info.point.aux && info.point.n) {
            const sc = project.scenarios.find((s) => s.id === info.point.scnId);
            head = `<span class="sb-head" style="--c:${info.point.color}"><i></i>${esc(t('chart.point', { n: info.point.n }))}${sc ? ' · ' + esc(sc.name) : ''}</span>`;
        } else if (info && info.point && info.point.aux) {
            head = `<span class="sb-head" style="--c:${info.point.color}"><i></i>${esc(info.point.label || '')}${info.dragging ? ' · ' + esc(t('chart.dragging')) : ''}</span>`;
        } else if (info) {
            head = `<span class="sb-head">${esc(t('chart.cursor'))}</span>`;
        } else if (ui.selected) {
            const r = results[ui.selected.scnId];
            const s = r && r.states.find((x) => x.n === ui.selected.n);
            if (s) {
                const sc = project.scenarios.find((x) => x.id === ui.selected.scnId);
                info = { state: s };
                head = `<span class="sb-head" style="--c:${scnColor(sc)}"><i></i>${esc(t('chart.point', { n: s.n }))} · ${esc(sc.name)}</span>`;
            }
        }
        if (!info) { sb.innerHTML = `<span class="idle">${esc(t('chart.statusIdle'))}</span>`; return; }
        const s = info.state;
        const item = (k, v, u) => `<span class="sb-item"><span>${k}</span><b>${v}</b> ${u}</span>`;
        sb.innerHTML = head
            + item(esc(t('qs.t')), fmt(s.t, 1), '°C') + item(esc(t('qs.x')), fmt(s.x * 1000, 2), 'g/kg') + item('φ', fmt(s.rh, 1), '%')
            + item(esc(t('qs.h')), fmt(s.h, 1), 'kJ/kg') + item(esc(t('qs.twb')), fmt(s.twb, 1), '°C') + item(esc(t('qs.tdp')), fmt(s.tdp, 1), '°C')
            + item('ρ', fmt(s.rho, 3), 'kg/m³') + item('p_w', fmt(s.pw / 100, 1), 'hPa')
            + (s.fog ? `<span class="fog-badge">${esc(t('chart.fog'))} · ${fmt(s.xl * 1000, 2)} g/kg</span>` : '');
    }

    const chartCallbacks = {
        onHover(info) { ui.hover = info; renderStatus(); },
        onHoverStep(h) {
            const cur = ui.highlight;
            if ((!h && !cur) || (h && cur && h.scnId === cur.scnId && h.stepId === cur.stepId)) return;
            ui.highlight = h;
            $$('#step-list .step').forEach((el) => el.classList.toggle('hl', !!h && el.dataset.id === h.stepId));
            $$('#tbl-steps tbody tr').forEach((el) => el.classList.toggle('hl', !!h && el.dataset.step === h.stepId));
            chart.setHighlight(h);
        },
        onSelect(sel) {
            if (sel && sel.scnId && sel.scnId !== project.active) switchScenario(sel.scnId);
            if (sel && sel.stepId) { ui.selected = null; startEdit(sel.stepId); }
            else ui.selected = sel && sel.n ? sel : null;
            if (sel && sel.n) { prefs.tab = 'states'; savePrefs(); }
            renderTables();
            chart.setData({ selected: ui.selected });
            renderStatus();
        },
        onDblClick(s) {
            const sc = activeScn();
            const fog = s.fog;
            const params = fog
                ? { pair: 't-x', a: round(s.t, 1), b: round(s.x * 1000, 2) }
                : { pair: 't-rh', a: round(s.t, 1), b: Math.max(0.1, round(s.rh, 1)) };
            if (results[sc.id].error) {
                change((pj) => { pj.scenarios.find((x) => x.id === pj.active).start = { pair: params.pair, a: params.a, b: params.b }; });
                toast(t('toast.startSet'));
                return;
            }
            change((pj) => { pj.scenarios.find((x) => x.id === pj.active).steps.push(makeStep('point', params)); });
            toast(t('toast.pointAdded', { t: fmt(s.t, 1), x: fmt(s.x * 1000, 2) }));
        },
        onDrag(ref, s, phase) {
            const rt = (v) => round(v, 1), rx = (v) => round(v * 1000, 2);
            const valsFor = (pair) => {
                const [qa, qb] = pair.split('-');
                const [a, b] = PR.pairValuesUI(pair, s);
                const r = (q, v) => (q === 'x' ? round(v, 2) : q === 'rh' ? Math.min(100, Math.max(0.1, round(v, 1))) : round(v, 1));
                return [r(qa, a), r(qb, b)];
            };
            change((pj) => {
                const sc = pj.scenarios.find((x) => x.id === ref.scnId);
                if (!sc) return;
                if (ref.role === 'start') {
                    const pair = s.fog && sc.start.pair.includes('rh') ? 't-x' : sc.start.pair;
                    const [a, b] = valsFor(pair);
                    sc.start = { pair, a, b };
                    return;
                }
                const st = findStep(sc, ref.stepId);
                if (!st) return;
                if (ref.role === 'end' && st.type === 'point') {
                    if (s.fog && st.params.pair.includes('rh')) st.params.pair = 't-x';
                    [st.params.a, st.params.b] = valsFor(st.params.pair);
                } else if (ref.role === 'stream2') {
                    st.params.t2 = rt(s.t);
                    if (st.params.hum === 'x' || s.fog) { st.params.hum = 'x'; st.params.b2 = rx(s.x); } else st.params.b2 = Math.max(0.1, round(s.rh, 1));
                } else if (ref.role === 'return') {
                    st.params.tRet = rt(s.t);
                    st.params.rhRet = Math.min(100, Math.max(0.1, round(s.rh, 1)));
                }
            }, phase !== 'end');
            if (phase === 'end' && ui.form.editingId === ref.stepId) {
                const st = findStep(activeScn(), ref.stepId);
                if (st) { ui.form.params = clone(st.params); renderForm(); }
            }
        },
        onWheelHint: (() => {
            let timer;
            return () => {
                const el = $('#wheel-hint');
                el.classList.add('show');
                clearTimeout(timer);
                timer = setTimeout(() => el.classList.remove('show'), 1100);
            };
        })()
    };

    function switchScenario(id) {
        if (id === project.active) return;
        commit();
        project.active = id;
        saveLocal();
        ui.selected = null;
        ui.highlight = null;
        if (ui.form.editingId) resetForm();
        renderStartPanel(true);
        renderForm();
        render();
    }

    // =====================================================================
    // Export, import en delen
    // =====================================================================
    const slug = () => (project.name || 'mollier').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'mollier';

    function download(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function exportJSON() {
        commit();
        const data = Object.assign({ app: 'mollier-diagram', saved: new Date().toISOString() }, project);
        download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slug()}.json`);
        toast(t('toast.saved'));
    }

    function exportCSV() {
        const nl = I.lang === 'nl', sep = nl ? ';' : ',';
        const n = (v, d) => (v == null || !isFinite(v) ? '' : (nl ? v.toFixed(d).replace('.', ',') : v.toFixed(d)));
        const q = (s) => { s = String(s); return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        const rows = [];
        const row = (...c) => rows.push(c.map(q).join(sep));
        const p = pressure();
        row(project.name);
        row(t('sys.pressure'), n(p / 1000, 3), 'kPa');
        row(new Date().toISOString().slice(0, 16).replace('T', ' '));
        for (const sc of project.scenarios) {
            const r = results[sc.id];
            rows.push('');
            row(t('panel.scenarios'), sc.name);
            row(t('tbl.point'), 't [°C]', 'x [g/kg]', 'RH [%]', 'h [kJ/kg]', `${t('qs.twb')} [°C]`, `${t('qs.tdp')} [°C]`, 'rho [kg/m3]', 'v [m3/kg]', 'p_w [Pa]', 'mdot [kg/s]', 'V [m3/h]');
            for (const s of r.states) row(s.n, n(s.t, 2), n(s.x * 1000, 3), n(s.rh, 1), n(s.h, 2), n(s.twb, 2), n(s.tdp, 2), n(s.rho, 4), n(s.v, 4), n(s.pw, 0), n(s.mdot, 4), n(s.mdot * s.v * 3600, 0));
            rows.push('');
            row(t('tbl.step'), t('tbl.process'), 'dt [K]', 'dx [g/kg]', 'dh [kJ/kg]', 'Q_s [kW]', 'Q_l [kW]', 'Q [kW]', `${t('tbl.water')}`, 'SHR', 'dh/dx [kJ/kg]', '');
            for (const sr of r.steps) {
                if (!sr.ok) { row('', describe(sr.step), sr.skipped ? t('tbl.skipped') : errMsg(sr.error)); continue; }
                row(`${sr.start.n}-${sr.end.n}`, describe(sr.step), n(sr.dt, 2), n(sr.dx * 1000, 3), n(sr.dh, 2), n(sr.qs, 3), n(sr.ql, 3), n(sr.qt, 3),
                    n(sr.kind === 'mix' ? null : sr.water, 3), n(sr.shr, 3), n(Math.abs(sr.dx) > 1e-9 ? sr.gamma : null, 0), infoText(sr));
            }
        }
        download(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${slug()}.csv`);
    }

    async function exportPNG() {
        try { download(await chart.toPNGBlob(2), `${slug()}-${prefs.chart}.png`); } catch (e) { toast(t('toast.exportFail'), true); }
    }
    function exportSVG() {
        download(new Blob([chart.toSVGString(project.name)], { type: 'image/svg+xml' }), `${slug()}-${prefs.chart}.svg`);
    }

    function openFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const pj = normalize(JSON.parse(reader.result));
                replaceProject(pj, t('toast.opened', { name: pj.name }));
            } catch (e) { toast(t('toast.openFail'), true); }
        };
        reader.readAsText(file);
    }

    // Delen: project gecomprimeerd (deflate-raw) en base64url-gecodeerd in de URL-hash
    const b64url = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
    const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    async function encodeShare(obj) {
        const json = JSON.stringify(obj);
        if (window.CompressionStream) {
            const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
            return 'z' + b64url(new Uint8Array(await new Response(cs).arrayBuffer()));
        }
        return 'j' + b64url(new TextEncoder().encode(json));
    }
    async function decodeShare(code) {
        const kind = code[0], bytes = unb64url(code.slice(1));
        if (kind === 'z') {
            const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return JSON.parse(await new Response(ds).text());
        }
        return JSON.parse(new TextDecoder().decode(bytes));
    }
    async function share() {
        commit();
        const code = await encodeShare(project);
        const url = `${location.origin}${location.pathname}#p=${code}`;
        try {
            await navigator.clipboard.writeText(url);
            toast(t('toast.linkCopied'));
        } catch (e) {
            toast(`${esc(t('toast.linkShow'))}<input readonly value="${esc(url)}" onclick="this.select()">`, false, true, 12000);
        }
    }
    async function loadShareFromHash() {
        const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)$/);
        if (!m) return;
        try {
            const pj = normalize(await decodeShare(m[1]));
            replaceProject(pj, t('toast.shared'));
        } catch (e) { toast(t('toast.openFail'), true); }
        history.replaceState(null, '', location.pathname + location.search);
    }

    // ---- Toasts & menu's ----
    function toast(msg, error = false, html = false, ms = 3200) {
        const el = document.createElement('div');
        el.className = 'toast' + (error ? ' error' : '');
        if (html) el.innerHTML = msg; else el.textContent = msg;
        $('#toasts').appendChild(el);
        setTimeout(() => el.remove(), ms);
    }
    function closeMenus(except) {
        $$('.menu.open').forEach((m) => {
            if (m === except) return;
            m.classList.remove('open');
            const b = m.querySelector('[aria-expanded]');
            if (b) b.setAttribute('aria-expanded', 'false');
        });
    }
    function toggleMenu(menu) {
        const open = !menu.classList.contains('open');
        closeMenus(menu);
        menu.classList.toggle('open', open);
        menu.querySelector('[aria-expanded]').setAttribute('aria-expanded', String(open));
    }

    function applyTheme() {
        if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', prefs.theme);
    }

    // =====================================================================
    // Gebeurtenissen
    // =====================================================================
    function bindEvents() {
        // Topbalk
        $('#project-name').addEventListener('input', (e) => change((pj) => { pj.name = e.target.value.slice(0, 120); }, true));
        $('#project-name').addEventListener('change', commit);
        $('#chart-type').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-type]');
            if (!b || b.dataset.type === prefs.chart) return;
            prefs.chart = b.dataset.type;
            savePrefs();
            configureChart();
        });
        $('#btn-undo').addEventListener('click', undo);
        $('#btn-redo').addEventListener('click', redo);
        $('#btn-file').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu($('#menu-file')); });
        $('#menu-file .menu-pop').addEventListener('click', (e) => {
            const a = e.target.closest('[data-action]');
            if (!a) return;
            closeMenus();
            ({
                new: () => { if (confirm(t('confirm.newProject'))) replaceProject(emptyProject(), t('toast.newProject')); },
                example: () => replaceProject(exampleProject(), t('toast.example')),
                open: () => $('#file-input').click(),
                save: exportJSON, png: exportPNG, svg: exportSVG, csv: exportCSV,
                print: () => window.print()
            })[a.dataset.action]();
        });
        $('#file-input').addEventListener('change', (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
        $('#btn-share').addEventListener('click', share);
        $('#btn-lang').addEventListener('click', () => {
            prefs.lang = I.lang === 'nl' ? 'en' : 'nl';
            I.setLang(prefs.lang);
            savePrefs();
            renderAll();
            configureChart();
        });
        $('#btn-theme').addEventListener('click', () => {
            prefs.theme = themeResolved() === 'dark' ? 'light' : 'dark';
            savePrefs();
            applyTheme();
            renderScenarioPanel();
            configureChart();
            render();
        });
        if (window.matchMedia) {
            matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (prefs.theme !== 'auto') return;
                renderScenarioPanel();
                configureChart();
                render();
            });
        }
        $('#btn-help').addEventListener('click', () => $('#dlg-help').showModal());
        $('#dlg-help').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === e.currentTarget) $('#dlg-help').close(); });
        document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) closeMenus(); });

        // Scenario's
        $('#scn-tabs').addEventListener('click', (e) => { const b = e.target.closest('.scn-tab'); if (b) switchScenario(b.dataset.id); });
        $('#btn-scn-add').addEventListener('click', () => {
            const used = new Set(project.scenarios.map((s) => s.color));
            const color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? project.scenarios.length % 6;
            const cur = activeScn();
            const sc = makeScenario(t('scn.newName', { n: project.scenarios.length + 1 }), color, { pair: 't-rh', a: 20, b: 50 }, clone(cur.flow));
            change((pj) => { pj.scenarios.push(sc); pj.active = sc.id; });
            resetForm();
            renderAll();
        });
        $('#scn-name').addEventListener('input', (e) => change((pj) => { pj.scenarios.find((s) => s.id === pj.active).name = e.target.value.slice(0, 40) || '—'; }, true));
        $('#scn-name').addEventListener('change', commit);
        $('#scn-colors').addEventListener('click', (e) => {
            const b = e.target.closest('.swatch');
            if (b) change((pj) => { pj.scenarios.find((s) => s.id === pj.active).color = +b.dataset.color; });
            renderStartPanel(false);
        });
        $('#btn-scn-visible').addEventListener('click', () => change((pj) => { const s = pj.scenarios.find((x) => x.id === pj.active); s.visible = !s.visible; }));
        $('#btn-scn-dup').addEventListener('click', () => {
            const cur = activeScn();
            const used = new Set(project.scenarios.map((s) => s.color));
            const copy = Object.assign(clone(cur), { id: uid(), name: t('scn.copy', { name: cur.name }).slice(0, 40), color: [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? cur.color });
            copy.steps.forEach((s) => { s.id = uid(); });
            change((pj) => { pj.scenarios.push(copy); pj.active = copy.id; });
            resetForm();
            renderAll();
        });
        $('#btn-scn-del').addEventListener('click', () => {
            const cur = activeScn();
            if (project.scenarios.length < 2) { toast(t('scn.lastOne'), true); return; }
            if (!confirm(t('scn.confirmDelete', { name: cur.name }))) return;
            change((pj) => { pj.scenarios = pj.scenarios.filter((s) => s.id !== cur.id); pj.active = pj.scenarios[0].id; });
            resetForm();
            renderAll();
        });

        // Beginpunt
        $('#start-pair').addEventListener('change', (e) => {
            const pair = e.target.value, r = activeRes();
            const [qa, qb] = pair.split('-');
            let a, b;
            if (!r.error) {
                [a, b] = PR.pairValuesUI(pair, r.states[0]);
                const rr = (q, v) => (q === 'x' ? round(v, 2) : round(v, 1));
                a = rr(qa, a); b = rr(qb, b);
            } else { a = { t: 20, rh: 50, x: 7, h: 38, twb: 14, tdp: 9 }[qa]; b = { t: 20, rh: 50, x: 7, h: 38, twb: 14, tdp: 9 }[qb]; }
            change((pj) => { pj.scenarios.find((s) => s.id === pj.active).start = { pair, a, b }; });
            renderStartPanel(true);
        });
        for (const k of ['a', 'b']) {
            const el = $('#start-' + k);
            el.addEventListener('input', () => {
                const v = parseNum(el.value);
                el.classList.toggle('invalid', !isFinite(v));
                if (isFinite(v)) change((pj) => { pj.scenarios.find((s) => s.id === pj.active).start[k] = v; }, true);
            });
            el.addEventListener('change', () => { commit(); el.classList.remove('invalid'); renderStartPanel(true); });
        }
        $('#flow-value').addEventListener('input', (e) => {
            const v = parseNum(e.target.value);
            e.target.classList.toggle('invalid', !(v >= 0));
            if (v >= 0) change((pj) => { pj.scenarios.find((s) => s.id === pj.active).flow.value = v; }, true);
        });
        $('#flow-value').addEventListener('change', (e) => { commit(); e.target.classList.remove('invalid'); renderStartPanel(true); });
        $('#flow-mode').addEventListener('change', (e) => {
            const mode = e.target.value, r = activeRes(), sc = activeScn();
            let value = sc.flow.value;
            // Omrekenen zodat de massastroom gelijk blijft
            if (!r.error && value > 0) value = mode === 'mass' ? round(value / r.states[0].v, 1) : round(value * r.states[0].v, 0);
            change((pj) => { pj.scenarios.find((s) => s.id === pj.active).flow = { mode, value }; });
            renderStartPanel(true);
        });

        // Systeem
        $('#p-mode').addEventListener('change', (e) => {
            const mode = e.target.value, p = pressure();
            change((pj) => {
                pj.pressure.mode = mode;
                if (mode === 'pressure') pj.pressure.kpa = round(p / 1000, 3);
                else pj.pressure.altitude = Math.max(-500, Math.min(9000, round(P.altitudeFromPressure(p), 0)));
            });
            renderSystem(true);
        });
        $('#p-value').addEventListener('input', (e) => {
            const v = parseNum(e.target.value), alt = project.pressure.mode === 'altitude';
            const ok = alt ? v >= -500 && v <= 9000 : v >= 30 && v <= 120;
            e.target.classList.toggle('invalid', !ok);
            if (ok) change((pj) => { if (alt) pj.pressure.altitude = v; else pj.pressure.kpa = v; }, true);
        });
        $('#p-value').addEventListener('change', (e) => { commit(); e.target.classList.remove('invalid'); renderSystem(true); });

        // Formulier
        $('#cat-grid').addEventListener('click', (e) => {
            const b = e.target.closest('.cat-btn');
            if (!b) return;
            if (ui.form.editingId) { resetForm(b.dataset.cat); renderSteps(); } else resetForm(b.dataset.cat);
            renderForm();
            updateChart();
        });
        $('#step-type').addEventListener('change', (e) => {
            const type = e.target.value, f = ui.form;
            ui.paramsByType[f.type] = clone(f.params);
            ui.lastTypeByCat[f.cat] = type;
            f.type = type;
            f.params = clone(ui.paramsByType[type] || PR.defaultParams(type));
            renderForm();
            updateChart();
        });
        $('#step-fields').addEventListener('input', (e) => {
            const el = e.target, key = el.dataset.key, f = ui.form;
            if (!key || el.dataset.kind === 'select') return;
            if (el.dataset.kind === 'text') { f.label = el.value; return; }
            const v = parseNum(el.value);
            el.classList.toggle('invalid', !isFinite(v));
            f.params[key] = v;
            updatePreview();
            updateChart();
        });
        $('#step-fields').addEventListener('change', (e) => {
            const el = e.target, key = el.dataset.key, f = ui.form;
            if (el.dataset.kind !== 'select') return;
            f.params[key] = el.value;
            // Afhankelijke standaardwaarden (bijv. eenheid wijzigt met de methode)
            for (const fd of PR.TYPES[f.type].fields) {
                if (fd.type === 'num' && typeof fd.def === 'function') f.params[fd.key] = PR.resolve(fd.def, f.params);
            }
            renderForm();
            updateChart();
        });
        $('#step-fields').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submitForm(); } });
        $('#btn-step-submit').addEventListener('click', submitForm);
        $('#btn-step-cancel').addEventListener('click', () => { resetForm(); renderForm(); renderSteps(); updateChart(); });

        // Stappenlijst
        $('#step-list').addEventListener('click', (e) => {
            const li = e.target.closest('.step');
            if (!li) return;
            const act = e.target.closest('[data-act]');
            if (act) { e.stopPropagation(); stepAction(li.dataset.id, act.dataset.act); return; }
            startEdit(li.dataset.id);
            updateChart();
        });
        $('#step-list').addEventListener('keydown', (e) => {
            const li = e.target.closest('.step');
            if (li && e.key === 'Enter' && e.target === li) { startEdit(li.dataset.id); updateChart(); }
        });
        const hoverStep = (e) => {
            const el = e.target.closest('[data-id].step, tr[data-step]');
            const id = el ? (el.dataset.id || el.dataset.step) : null;
            const h = id ? { scnId: project.active, stepId: id } : null;
            if ((h && h.stepId) === (ui.highlight && ui.highlight.stepId)) return;
            chartCallbacks.onHoverStep(h);
        };
        $('#step-list').addEventListener('pointerover', hoverStep);
        $('#step-list').addEventListener('pointerleave', () => chartCallbacks.onHoverStep(null));

        // Diagram-knoppen
        $('#btn-zoom-in').addEventListener('click', () => chart.zoomBy(1.5));
        $('#btn-zoom-out').addEventListener('click', () => chart.zoomBy(1 / 1.5));
        $('#btn-fit').addEventListener('click', () => chart.fitToData());
        $('#btn-reset').addEventListener('click', () => chart.resetView());
        $('#btn-range').addEventListener('click', (e) => { e.stopPropagation(); renderRangePop(); toggleMenu($('#menu-range')); });
        $('#range-pop').addEventListener('click', (e) => {
            e.stopPropagation();
            const pr = e.target.closest('[data-preset]');
            if (pr) applyRange(pr.dataset.preset);
            if (e.target.id === 'rg-apply') applyRange();
        });
        $('#range-pop').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyRange(); });
        $('#layer-chips').addEventListener('click', (e) => {
            const b = e.target.closest('.layer-chip');
            if (!b) return;
            const k = b.dataset.layer;
            prefs.layers[k] = !prefs.layers[k];
            savePrefs();
            b.setAttribute('aria-pressed', String(prefs.layers[k]));
            chart.configure({ layers: prefs.layers });
        });

        // Tabellen
        $$('.results .tab').forEach((b) => b.addEventListener('click', () => { prefs.tab = b.dataset.tab; savePrefs(); renderTables(); }));
        $('#btn-csv').addEventListener('click', exportCSV);
        $('#tbl-states').addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-n]');
            if (!tr) return;
            const n = +tr.dataset.n;
            const same = ui.selected && ui.selected.n === n && ui.selected.scnId === project.active;
            chartCallbacks.onSelect(same ? null : { scnId: project.active, n });
        });
        $('#tbl-steps').addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-step]');
            if (tr) { startEdit(tr.dataset.step); updateChart(); }
        });
        $('#tbl-steps').addEventListener('pointerover', hoverStep);
        $('#tbl-steps').addEventListener('pointerleave', () => chartCallbacks.onHoverStep(null));

        // Sneltoetsen
        document.addEventListener('keydown', (e) => {
            const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
            const mod = e.ctrlKey || e.metaKey;
            if (mod && !e.altKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
            if (mod && !e.altKey && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
            if (e.key === 'Escape') {
                closeMenus();
                if (ui.form.editingId) { resetForm(); renderForm(); renderSteps(); }
                ui.selected = null;
                updateChart();
                return;
            }
            if (typing || mod || e.altKey) return;
            if (e.key === 'm' || e.key === 'M') { prefs.chart = prefs.chart === 'mollier' ? 'psychro' : 'mollier'; savePrefs(); configureChart(); }
            else if (e.key === '+' || e.key === '=') chart.zoomBy(1.5);
            else if (e.key === '-') chart.zoomBy(1 / 1.5);
            else if (e.key === '0') chart.resetView();
            else if (e.key === 'f' || e.key === 'F') chart.fitToData();
            else if (e.key === '?') $('#dlg-help').showModal();
            else if (e.key === 'Delete' && ui.form.editingId) { e.preventDefault(); stepAction(ui.form.editingId, 'del'); }
        });
        window.addEventListener('hashchange', loadShareFromHash);
        window.addEventListener('beforeunload', commit);
    }

    // =====================================================================
    // Start
    // =====================================================================
    function init() {
        I.setLang(prefs.lang);
        applyTheme();
        const { pj, msg } = initialProject();
        project = pj;
        resetForm('heat');
        recompute();
        chart = new window.MollierChart($('#chart'), chartCallbacks);
        bindEvents();
        renderAll();
        configureChart();
        chart.setData(chartData());
        saveLocal();
        if (msg) toast(msg);
        loadShareFromHash();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
