/**
 * view.js — weergave "Earth, Wind & Fire": invoerpanelen, KPI's, meldingen en tabbladen
 *
 * Toestand staat in project.ewf (app.js) en wijzigt alleen via MollierApp.change(), zodat ongedaan
 * maken, automatisch opslaan, deellinks en JSON-export de EWF-invoer meenemen. Herberekenen gebeurt
 * met debounce (150 ms); de rekenkern (EwfModel.simulate) is puur en snel (< 30 ms).
 */
(function (root) {
    'use strict';

    const M = root.EwfModel, W = root.EwfWeather;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const GROUPS = ['building', 'vent', 'cascade', 'ventec', 'chimney', 'exhaust', 'advanced'];
    const TABS = ['profile', 'pressure', 'chimney', 'mollier', 'energy', 'floors', 'all', 'method'];
    const DEBOUNCE_MS = 150;

    let app = null;
    const S = {
        result: null, key: null, timer: 0, visible: false, dirty: true,
        weatherBusy: false, all: null, allKey: null, allJob: 0, sort: null, floorSel: null
    };

    // ---- Hulpjes ----
    const t = (k, v) => app.t(k, v);
    const fmt = (v, d) => app.fmt(v, d);
    const fmtA = (v, d) => app.fmtA(v, d);
    const esc = (s) => app.esc(s);
    const ewf = () => app.getProject().ewf;
    const signed = (v, d) => (isFinite(v) ? (v > 0 ? '+' : '') + fmt(v, d) : '—');
    const kW = (w, d = 1) => fmt(w / 1000, d);
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const fieldsOf = (g) => M.FIELDS.filter((f) => f.group === g);
    const visible = (f, b) => !f.when || f.when(b);

    /** Tooltip: bron, zinvol bereik en standaardwaarde. */
    function tip(f) {
        const u = f.unit && f.unit !== '–' ? ' ' + f.unit : '';
        const v = (x) => fmtA(x * (f.scale || 1), f.dec != null ? f.dec : 3);
        const lines = [t('ewf.f.' + f.key)];
        if (f.src && f.src !== '—') lines.push(`${t('ewf.src')}: Bronsema 2013 ${f.src}`.replace('Bronsema 2013 NEN', 'NEN').replace('Bronsema 2013 KNMI', 'KNMI'));
        if (f.range) lines.push(`${t('ewf.range')}: ${v(f.range[0])}–${v(f.range[1])}${u}`);
        if (f.type === 'num') lines.push(`${t('ewf.def')}: ${v(f.def)}${u}`);
        if (f.assume) lines.push(t('ewf.assume'));
        return lines.join('\n');
    }

    function optLabel(f, o) {
        if (f.key === 'spray' && /^s\d+$/.test(o)) return t('ewf.opt.spray.s', { n: o.slice(1), d30: fmt(M.SPRAY[o].d30 * 1000, 2) });
        return t(`ewf.opt.${f.key}.${o}`);
    }

    function fieldHTML(f, scope) {
        const id = `ewf-${scope}-${f.key}`;
        const badge = f.assume ? ` <span class="badge-assume">${esc(t('ewf.assume'))}</span>` : '';
        const attrs = `data-scope="${scope}" data-key="${f.key}" id="${id}"`;
        const title = esc(tip(f));
        if (f.type === 'select') {
            const opts = f.options.map((o) => `<option value="${o}">${esc(optLabel(f, o))}</option>`).join('');
            return `<label class="fld full" data-fld="${f.key}" title="${title}"><span class="fld-lbl">${esc(t('ewf.f.' + f.key))}${badge}</span>`
                + `<select class="input" data-kind="select" ${attrs}>${opts}</select></label>`;
        }
        if (f.type === 'bool') {
            return `<label class="fld full chk" data-fld="${f.key}" title="${title}"><input type="checkbox" data-kind="bool" ${attrs}>`
                + `<span>${esc(t('ewf.f.' + f.key))}${badge}</span></label>`;
        }
        return `<label class="fld" data-fld="${f.key}" title="${title}"><span class="fld-lbl">${esc(t('ewf.f.' + f.key))}${badge}</span>`
            + `<span class="input-unit"><input class="input" data-kind="num" inputmode="decimal" autocomplete="off" placeholder="—" ${attrs}><em>${esc(f.unit === '–' ? '' : f.unit)}</em></span></label>`;
    }

    // =====================================================================
    // Opbouw
    // =====================================================================
    function buildSidebar() {
        S.builtLang = app.lang;
        const side = $('#ewf-sidebar');
        const open = new Set(app.prefs().ewf.panels || []);
        const panel = (g, body) => `<details class="panel ewf-panel" data-group="${g}" id="ewf-panel-${g}"${open.has(g) ? ' open' : ''}>`
            + `<summary><h2>${esc(t('ewf.panel.' + g))}</h2><span class="ewf-sum" id="ewf-sum-${g}"></span></summary>`
            + `<div class="ewf-panel-body">${body}${g === 'weather' ? '' : `<p class="hint ewf-hint" id="ewf-hint-${g}"></p>`}`
            + `<div class="ewf-panel-foot"><button type="button" class="chip-btn" data-reset="${g}" title="${esc(t('ewf.resetTitle'))}">${esc(t('ewf.reset'))}</button></div></div></details>`;
        const wf = (k) => fieldHTML(M.WFIELD[k], 'w');
        const weather = `<div class="seg ewf-src" id="ewf-src" role="tablist">`
            + ['preset', 'live', 'manual'].map((s) => `<button type="button" role="tab" data-src="${s}">${esc(t('ewf.weather.src' + s[0].toUpperCase() + s.slice(1)))}</button>`).join('')
            + `</div>`
            + `<label class="fld full" id="ewf-preset-fld"><span class="fld-lbl">${esc(t('ewf.weather.preset'))}</span><select class="input" id="ewf-preset">`
            + M.PRESETS.map((p) => `<option value="${p.id}">${esc(t(`ewf.preset.${p.id}.name`))}</option>`).join('') + `</select></label>`
            + `<p class="hint ewf-preset-info" id="ewf-preset-info"></p>`
            + `<div class="ewf-live" id="ewf-live"></div>`
            + `<div class="fields ewf-fields">${wf('t')}${wf('rh')}${wf('p')}${wf('U10')}${wf('dir')}${wf('ghi')}`
            + `<label class="fld full" data-fld="time"><span class="fld-lbl">${esc(t('ewf.f.time'))}</span><input type="datetime-local" class="input" id="ewf-w-time" data-scope="w" data-key="time" data-kind="time" step="60"></label>`
            + `<label class="fld full chk" data-fld="facadeManual"><input type="checkbox" id="ewf-w-facadeManual" data-scope="w" data-key="facadeManual" data-kind="bool"><span>${esc(t('ewf.f.facadeManual'))}</span></label>`
            + `${wf('facade')}</div><p class="hint ewf-hint" id="ewf-hint-weather"></p><p class="hint" id="ewf-sun"></p><p class="hint ewf-stamp" id="ewf-stamp"></p>`;
        side.innerHTML = `<div class="ewf-side-head"><span class="ewf-mode" id="ewf-mode"></span>`
            + `<button type="button" class="chip-btn" id="ewf-reset-all" title="${esc(t('ewf.resetAllTitle'))}">${esc(t('ewf.resetAll'))}</button></div>`
            + panel('weather', weather)
            + GROUPS.map((g) => panel(g, `<div class="fields ewf-fields">${fieldsOf(g).map((f) => fieldHTML(f, 'b')).join('')}</div>`)).join('');
    }

    function buildContent() {
        const tabs = TABS.map((k) => `<button type="button" class="tab" role="tab" data-tab="${k}" id="ewf-tab-${k}">${esc(t('ewf.tab.' + k))}</button>`).join('');
        $('#ewf-content').innerHTML = `
            <div class="kpis ewf-kpis" id="ewf-kpis" aria-live="polite"></div>
            <div class="card ewf-warn-card" id="ewf-warnings"></div>
            <div class="card ewf-schema-card" id="ewf-schema-card"></div>
            <div class="card results ewf-tabs-card">
                <div class="results-head"><div class="tabs ewf-tabs" role="tablist" id="ewf-tabs">${tabs}</div>
                <button type="button" class="tb-btn sm" id="ewf-csv"><svg><use href="#i-download"/></svg><span>${esc(t('ewf.tbl.csv'))}</span></button></div>
                <div class="ewf-pane" id="ewf-pane" role="tabpanel"></div>
            </div>`;
        if (root.EwfSchematic) S.schematic = root.EwfSchematic.create($('#ewf-schema-card'), schematicCallbacks());
    }

    // =====================================================================
    // Synchronisatie met het project
    // =====================================================================
    /** Na elke projectwijziging (app.render): herberekenen met debounce als project.ewf veranderde. */
    function sync() {
        if (!app) return;
        const key = JSON.stringify(ewf());
        updatePanels();
        if (key === S.key) return;
        S.key = key;
        S.dirty = true;
        if (!S.visible) return;
        clearTimeout(S.timer);
        S.timer = setTimeout(compute, S.result ? DEBOUNCE_MS : 0);
    }

    function compute() {
        clearTimeout(S.timer);
        S.dirty = false;
        const st = ewf();
        try {
            S.result = M.simulate(st.building, M.weatherOf(st));
            S.error = null;
        } catch (e) {
            S.error = e;
            if (root.console) console.error(e);
        }
        renderResults();
    }

    function show(on) {
        S.visible = on;
        if (!on) { if (S.schematic) S.schematic.pause(true); return; }
        if (S.dirty || !S.result) compute();
        else renderResults();
        if (S.schematic) S.schematic.pause(false);
    }

    /** Volledig opnieuw opbouwen alleen bij een taalwissel; anders (ongedaan maken, project openen) bijwerken. */
    function renderAll() {
        if (!app) return;
        if (S.builtLang !== app.lang) {
            if (S.schematic) S.schematic.destroy();
            buildSidebar();
            buildContent();
        }
        S.key = null;
        updatePanels();
        sync();
        if (S.visible && S.result) renderResults();
    }

    function restyle() {
        if (S.visible && S.result) renderResults();
    }

    // =====================================================================
    // Invoerpanelen bijwerken
    // =====================================================================
    function setVal(el, v) { if (document.activeElement !== el) el.value = v; }

    /** ISO (UTC) → waarde voor <input type="datetime-local"> in lokale tijd. */
    function toLocalInput(iso) {
        const d = new Date(iso);
        if (!isFinite(d.getTime())) return '';
        const p2 = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }

    function updatePanels() {
        const side = $('#ewf-sidebar');
        if (!side || !side.firstChild) return;
        const st = ewf(), b = st.building, w = M.weatherOf(st);
        // Gebouwvelden
        for (const el of $$('[data-scope="b"]', side)) {
            const f = M.FIELD[el.dataset.key];
            const fld = el.closest('[data-fld]');
            if (fld) fld.hidden = !visible(f, b);
            if (f.type === 'select') setVal(el, String(b[f.key]));
            else if (f.type === 'bool') el.checked = !!b[f.key];
            else if (!el.classList.contains('invalid')) setVal(el, fmtA(b[f.key] * (f.scale || 1), f.dec != null ? f.dec : 3));
            if (f.type === 'num' && f.range && !el.classList.contains('invalid')) {
                const v = b[f.key];
                el.classList.toggle('out', v < f.range[0] - 1e-9 || v > f.range[1] + 1e-9);
            }
        }
        // Weervelden
        $$('#ewf-src button', side).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.src === st.weather.source)));
        $('#ewf-preset-fld').hidden = st.weather.source !== 'preset';
        $('#ewf-preset-info').hidden = st.weather.source !== 'preset';
        setVal($('#ewf-preset'), st.weather.presetId);
        $('#ewf-preset-info').textContent = t(`ewf.preset.${st.weather.presetId}.info`);
        for (const el of $$('[data-scope="w"]', side)) {
            const k = el.dataset.key, f = M.WFIELD[k];
            const fld = el.closest('[data-fld]');
            if (k === 'time') { setVal(el, toLocalInput(w.time)); continue; }
            if (k === 'facadeManual') { el.checked = !!w.facadeManual; continue; }
            if (fld) fld.hidden = (k === 'facade' && !w.facadeManual) || (k === 'ghi' && w.facadeManual);
            if (!el.classList.contains('invalid')) {
                const v = w[k];
                setVal(el, v == null ? '' : fmtA(v * (f.scale || 1), f.dec != null ? f.dec : 2));
            }
        }
        if (root.EwfView.renderLive) root.EwfView.renderLive();
    }

    /** Afgeleide waarden onder de panelen (na een berekening). */
    function renderHints(r) {
        const d = r.derived, b = r.inputs.building, w = r.inputs.weather;
        const set = (id, s) => { const el = $('#' + id); if (el) el.textContent = s; };
        set('ewf-hint-building', t('ewf.hint.building', { H: fmt(d.H, 1), avo: fmt(d.AVO, 0), bvo: fmt(d.BVO, 0), n: fmt(d.nPers, 0) }));
        set('ewf-hint-vent', t('ewf.hint.vent', { q: fmt(d.qV * 3600, 0), qa: fmt(d.qV * 1000 / d.AVO, 2), m: fmt(d.mDa, 2), s: fmt(d.sideC, 2) })
            + ' · ' + t('ewf.hint.bbl', { qp: fmt(d.qV * 1000 / Math.max(d.nPers, 1e-9), 1) }));
        set('ewf-hint-cascade', t('ewf.hint.cascade', { d30: fmt(b.d30 * 1000, 3), d32: fmt(b.d32 * 1000, 3), rwl: fmt(r.cascade.rwl, 2),
            qw: fmt(d.qW * 3600, 1), tres: fmt(r.cascade.tRes, 1) }));
        set('ewf-hint-ventec', t('ewf.hint.ventec', { z: fmt(d.zRoof, 1), u: fmt(r.ventec.Uref, 2), q: fmt(r.ventec.qDyn, 1), a: fmt(d.aEj, 1) }));
        set('ewf-hint-chimney', t('ewf.hint.chimney', { w: fmt(r.chimney.w, 2), dh: fmt(d.DhChimney, 2), phi: fmt(r.rad.total, 0), method: t('ewf.hint.method.' + r.rad.method) }));
        const ex = r.pressure.exhaust[0].parts.lossDetail;
        set('ewf-hint-exhaust', t('ewf.hint.exhaust', { sum: fmt(ex.ext + ex.shunt + ex.ubend + ex.chimney + ex.fiwihex + ex.dyn, 1), sh: fmt(Math.sqrt(d.Ashunt), 2) }));
        set('ewf-hint-advanced', t('ewf.hint.advanced', { h: fmt(d.head, 1), eta: fmt(b.etaFanV * b.etaFanM, 3) }));
        const o = r.outdoor;
        const bft = M.beaufort(w.U10);
        set('ewf-hint-weather', o ? t('ewf.hint.weather', { x: fmt(o.x * 1000, 2), tdp: fmt(o.tdp, 1), h: fmt(o.h, 1), bft, bftName: (t('ewf.bft') || [])[bft] || '' }) : '');
        const sun = r.rad.sun;
        set('ewf-sun', r.rad.method === 'manual'
            ? t('ewf.hint.sunManual', { alt: fmt(sun.alt, 1), az: fmt(sun.az, 0), phi: fmt(r.rad.total, 0) })
            : t('ewf.hint.sun', { alt: fmt(sun.alt, 1), az: fmt(sun.az, 0), beam: fmt(r.rad.beam, 0), diff: fmt(r.rad.diffuse, 0), th: fmt(r.rad.theta, 0) }));
        const ws = ewf().weather;
        set('ewf-stamp', ws.source === 'preset' ? t('ewf.weather.stampPreset', { name: t(`ewf.preset.${ws.presetId}.name`) })
            : ws.source === 'live' ? t('ewf.weather.stamp', { time: new Date(w.time).toLocaleString(app.lang === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
                + ' · ' + t('ewf.weather.attribution')
                : t('ewf.weather.stampManual'));
        // Samenvatting in de paneelkop (ook zichtbaar als het paneel dicht is)
        set('ewf-sum-weather', `${fmt(w.t, 1)} °C · ${fmt(w.rh, 0)} % · ${fmt(w.U10, 1)} m/s`);
        set('ewf-sum-building', `${b.floors} × ${fmt(b.avoFloor, 0)} m²`);
        set('ewf-sum-vent', `${fmt(d.qV * 3600, 0)} m³/h`);
        set('ewf-sum-cascade', `RW/L ${fmt(r.cascade.rwl, 2)}`);
        set('ewf-sum-ventec', `${fmt(r.ventec.pOver, 1)} / ${fmt(r.ventec.pEj, 1)} Pa`);
        set('ewf-sum-chimney', `${fmt(r.chimney.tOut, 1)} °C`);
        set('ewf-sum-exhaust', `${fmt(b.dpSupDesign, 0)} / ${fmt(b.dpExhExt, 0)} Pa`);
        set('ewf-sum-advanced', `N = ${b.nCells}`);
        const mode = $('#ewf-mode');
        mode.className = 'ewf-mode ' + r.mode;
        mode.textContent = t('ewf.modeLong.' + r.mode);
    }

    // =====================================================================
    // Resultaten
    // =====================================================================
    function renderResults() {
        const r = S.result;
        if (!r || !$('#ewf-kpis')) return;
        renderHints(r);
        renderKPIs(r);
        renderWarnings(r);
        if (S.schematic) S.schematic.update(r, ctx());
        renderTab();
    }

    /** Context voor schema en grafieken (thema, opmaak, teksten). */
    function ctx() {
        return { t, fmt, fmtA, esc, skin: app.skin(), theme: app.theme(), lang: app.lang, prefs: app.prefs() };
    }

    const num = (v, d) => {
        const s = fmt(v, d), i = s.search(/[.,]\d+$/);
        return i < 0 ? s : `${s.slice(0, i)}<span class="kpi-dec">${s.slice(i)}</span>`;
    };
    function tile(cls, lbl, color, val, sub, status) {
        return `<div class="kpi ewf-kpi ${cls || ''}"><div class="kpi-lbl"><i class="kpi-icon" style="background:${color}"></i>${esc(lbl)}</div>`
            + `<div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div>${status ? `<div class="ewf-kpi-status ${status[0]}">${esc(status[1])}</div>` : ''}</div>`;
    }
    function pressureTile(lbl, rows, fanW) {
        const av = rows.map((q) => q.available), mn = Math.min(...av), mx = Math.max(...av);
        const ok = mn >= 0;
        const status = ok ? ['ok', t('ewf.kpi.throttle', { min: fmt(mn, 0), max: fmt(mx, 0) })]
            : ['bad', t('ewf.kpi.fan', { pa: fmt(-mn, 1), kw: fmt(fanW / 1000, 2) })];
        return tile(ok ? '' : 'alert', lbl, ok ? 'var(--accent)' : 'var(--danger)', `${num(mn, 1)}<small>Pa</small>`,
            `${esc(fmt(av[0], 1))} … ${esc(fmt(av[av.length - 1], 1))} Pa`, status);
    }

    function renderKPIs(r) {
        const c = r.cascade, out = c.out || r.outdoor, room = r.room;
        const pumps = r.power.Pspray + r.power.Psource;
        const comfortOk = room && room.rh <= r.inputs.building.rhRoomMax && room.x <= r.inputs.building.xRoomMax;
        $('#ewf-kpis').innerHTML = [
            tile('', t('ewf.kpi.supply'), 'var(--cool)', `${num(out.t, 1)}<small>°C</small> ${num(out.rh, 0)}<small>%</small>`,
                esc(t('ewf.kpi.supplySub', { t: fmt(r.supply.t, 1) }))),
            tile('', t('ewf.kpi.cascade'), c.Q < 0 ? 'var(--cool)' : 'var(--heat)', `${num(c.Q / 1000, 0)}<small>kW</small>`,
                esc(t('ewf.kpi.cascadeSub', { rwl: fmt(c.rwl, 2), qw: fmt(r.derived.qW * 3600, 1), dp: fmt(c.dpHydr + c.dpTh, 0) })),
                ['mode ' + r.mode, t('ewf.mode.' + r.mode)]),
            pressureTile(t('ewf.kpi.supplyP'), r.pressure.supply, r.power.PfanSupply),
            pressureTile(t('ewf.kpi.exhaustP'), r.pressure.exhaust, r.power.PfanExhaust),
            tile('', t('ewf.kpi.chimney'), 'var(--heat)', `${num(r.chimney.tOut, 1)}<small>°C</small>`,
                esc(t('ewf.kpi.chimneySub', { q: fmt(r.chimney.Q / 1000, 0), eta: r.chimney.eta == null ? '—' : fmt(r.chimney.eta, 2), dp: fmt(r.chimney.dpThUsed, 1) })),
                r.chimney.open ? ['ok', t('ewf.kpi.open')] : ['info', t('ewf.kpi.closed')]),
            tile('', t('ewf.kpi.power'), '#64748b', `${num((pumps + r.power.Pfan) / 1000, 1)}<small>kW</small>`,
                esc(t('ewf.kpi.powerSub', { pump: fmt(pumps / 1000, 1), fan: fmt(r.power.Pfan / 1000, 2), cop: r.power.COP == null ? '—' : fmt(r.power.COP, 0) }))),
            tile(comfortOk ? '' : 'warn', t('ewf.kpi.room'), comfortOk ? 'var(--accent)' : '#d97706', room ? `${num(room.rh, 0)}<small>%</small>` : '—',
                room ? esc(t('ewf.kpi.roomSub', { x: fmt(room.x * 1000, 1), t: fmt(room.t, 1) })) : '',
                comfortOk ? ['ok', t('ewf.kpi.comfortOk')] : ['warn', t('ewf.kpi.comfortBad')])
        ].join('');
    }

    /** Variabelen van een melding leesbaar maken. */
    function warnVars(w) {
        const v = Object.assign({}, w.vars);
        const out = {};
        for (const [k, x] of Object.entries(v)) {
            if (typeof x !== 'number') { out[k] = x; continue; }
            out[k] = fmt(x, { rh: 0, rhMax: 0, ratio: 2, lim: 1, rwl: 2, err: 3, cp: 2, d: 2, z: 1, q: 1, min: 1 }[k] ?? 1);
        }
        if (w.code === 'inputRange' || w.code === 'inputClamped') {
            const f = M.FIELD[v.field] || M.WFIELD[v.field] || { scale: 1, unit: '' };
            const sc = v.scale || 1, u = v.unit && v.unit !== '–' ? ' ' + v.unit : '';
            const d = f.dec != null ? f.dec : 2;
            out.field = t('ewf.f.' + v.field);
            out.value = fmtA(v.value * sc, d) + u;
            out.min = fmtA(v.min * sc, d);
            out.max = fmtA(v.max * sc, d) + u;
            out.lim = fmtA(Math.min(v.max, Math.max(v.min, v.value)) * sc, d) + u;
        }
        return out;
    }

    function renderWarnings(r) {
        const list = r.warnings;
        const box = $('#ewf-warnings');
        const order = { error: 0, warn: 1, info: 2 };
        const items = list.slice().sort((a, b) => order[a.level] - order[b.level]);
        box.innerHTML = `<div class="ewf-warn-head">${esc(t('ewf.warnHead'))}</div>`
            + (items.length ? `<ul class="ewf-warn">${items.map((w) => `<li class="${w.level}"><span class="ico" aria-hidden="true"></span>`
                + `<span>${esc(t('ewf.warn.' + w.code, warnVars(w)))}</span>`
                + ` <button type="button" class="ewf-why" data-why="${w.code}">${esc(t('ewf.why'))}</button></li>`).join('')}</ul>`
                : `<p class="hint">${esc(t('ewf.noWarn'))}</p>`);
    }

    // =====================================================================
    // Tabbladen
    // =====================================================================
    function renderTab() {
        const tab = TABS.includes(app.prefs().ewf.tab) ? app.prefs().ewf.tab : 'profile';
        $$('#ewf-tabs .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
        const pane = $('#ewf-pane');
        pane.setAttribute('aria-labelledby', 'ewf-tab-' + tab);
        const r = S.result;
        $('#ewf-csv').hidden = !['floors', 'all', 'energy', 'pressure'].includes(tab);
        const C = root.EwfCharts;
        const c = ctx();
        switch (tab) {
            case 'floors': pane.innerHTML = floorsTable(r); break;
            case 'energy': pane.innerHTML = energyTable(r); if (C) C.energy($('#ewf-chart-energy'), r, c); break;
            default:
                if (C && C[tab]) C[tab](pane, r, c, S);
                else if (root.EwfView.tabs && root.EwfView.tabs[tab]) root.EwfView.tabs[tab](pane, r, c, S);
                else pane.innerHTML = '';
        }
    }

    function th(lbl, unit, cls) { return `<th${cls ? ` class="${cls}"` : ''}>${esc(lbl)}${unit ? `<span class="u">${unit}</span>` : ''}</th>`; }

    function floorsTable(r) {
        const sup = r.pressure.supply, exh = r.pressure.exhaust;
        const act = (q) => (q.available >= 0 ? `<span class="ok">${esc(t('ewf.tbl.throttle'))} ${fmt(q.throttle, 1)}</span>` : `<span class="bad">${esc(t('ewf.tbl.deficit'))} ${fmt(q.deficit, 1)}</span>`);
        const rows = sup.map((q, i) => `<tr><td>${q.floor}</td><td>${fmt(q.z, 2)}</td><td>${fmt(r.supply.t, 1)}</td><td>${signed(q.available, 1)}</td><td class="l">${act(q)}</td>`
            + `<td>${signed(exh[i].available, 1)}</td><td class="l">${act(exh[i])}</td></tr>`).reverse().join('');
        return `<div class="table-wrap"><table class="data-table ewf-table"><thead><tr>${th(t('ewf.tbl.floor'), '', 'l')}${th(t('ewf.tbl.z'), 'm')}${th(t('ewf.tbl.tSup'), '°C')}`
            + `${th(t('ewf.tbl.supMargin'), 'Pa')}${th(t('ewf.tbl.supAction'), 'Pa', 'l')}${th(t('ewf.tbl.exhMargin'), 'Pa')}${th(t('ewf.tbl.exhAction'), 'Pa', 'l')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function energyRows(r) {
        const p = r.power;
        return [
            ['cascade', r.cascade.Q, r.cascade.Q < 0 ? 'cool' : 'heat'],
            ['reheat', r.reheat.Q, 'heat'],
            ['chimney', r.chimney.Q, 'solar'],
            ['fiwihex', r.fiwihex.Q, 'solar'],
            ['spray', p.Pspray, 'elec'],
            ['source', p.Psource, 'elec'],
            ['fanSupply', p.PfanSupply, 'elec'],
            ['fanExhaust', p.PfanExhaust, 'elec'],
            ['refFan', p.ref.PfanConv, 'ref'],
            ['refCool', p.ref.PcoolConv, 'ref']
        ];
    }
    function energyTable(r) {
        const rows = energyRows(r).map(([k, v, cls]) => `<tr class="${cls}"><td class="l">${esc(t('ewf.energy.' + k))}</td><td>${signed(v / 1000, 1)}</td></tr>`).join('');
        return `<div class="ewf-energy"><div class="ewf-chart" id="ewf-chart-energy"></div>`
            + `<div class="table-wrap"><table class="data-table ewf-table"><thead><tr>${th(t('ewf.energy.item'), '', 'l')}${th('P / Q', 'kW')}</tr></thead><tbody>${rows}</tbody></table>`
            + `<p class="hint">${esc(t('ewf.energy.note'))}</p></div></div>`;
    }

    // =====================================================================
    // Bewerken
    // =====================================================================
    /** Waarde zetten in project.ewf; weerinvoer schakelt naar "Handmatig". */
    function setField(pj, scope, key, value) {
        const e = pj.ewf;
        if (scope === 'b') {
            const b = e.building, prev = b[key];
            b[key] = value;
            if (key === 'spray' && value === 'custom' && M.SPRAY[prev]) { b.d30 = M.SPRAY[prev].d30; b.d32 = M.SPRAY[prev].d32; }
            if (key === 'glass' && value === 'custom' && M.GLASS[prev]) { b.glassG = M.GLASS[prev].g; b.glassU = M.GLASS[prev].U; }
            if (key === 'chimType') {
                // Zonnefaçade: breedte = gevelbreedte van een vierkante vloer, D = 0,65 m (reiniging, §4.2.8.1)
                b.chimB = value === 'facade' ? Math.round(Math.sqrt(b.avoFloor) * 10) / 10 : M.DEFAULTS.chimB;
                b.chimD = M.DEFAULTS.chimD;
            }
            return;
        }
        if (e.weather.source !== 'manual') {
            e.weather.values = clone(M.weatherOf(e));
            e.weather.source = 'manual';
        }
        const v = e.weather.values;
        if (key === 'facadeManual' && value && !v.facadeManual) {
            // Startwaarde: de nu berekende gevelstraling
            if (S.result) v.facade = Math.round(S.result.rad.total);
        }
        v[key] = value;
        if (key === 'ghi') { v.dni = null; v.dhi = null; v.gti = null; v.gtiAz = null; }
    }

    function bindEvents() {
        const side = $('#ewf-sidebar');
        side.addEventListener('input', (e) => {
            const el = e.target, kind = el.dataset.kind;
            if (kind !== 'num') return;
            const f = el.dataset.scope === 'b' ? M.FIELD[el.dataset.key] : M.WFIELD[el.dataset.key];
            const v = app.parseNum(el.value);
            el.classList.toggle('invalid', !isFinite(v));
            if (!isFinite(v)) return;
            let si = v / (f.scale || 1);
            if (f.int) si = Math.round(si);
            app.change((pj) => setField(pj, el.dataset.scope, el.dataset.key, si), true);
        });
        side.addEventListener('change', (e) => {
            const el = e.target, kind = el.dataset.kind;
            if (el.id === 'ewf-preset') {
                app.change((pj) => { pj.ewf.weather.source = 'preset'; pj.ewf.weather.presetId = el.value; pj.ewf.weather.values = M.presetWeather(el.value); });
                return;
            }
            if (kind === 'num') { el.classList.remove('invalid'); app.commit(); updatePanels(); return; }
            if (kind === 'select') { app.change((pj) => setField(pj, el.dataset.scope, el.dataset.key, el.value)); return; }
            if (kind === 'bool') { app.change((pj) => setField(pj, el.dataset.scope, el.dataset.key, el.checked)); return; }
            if (kind === 'time') {
                const d = new Date(el.value);
                if (isFinite(d.getTime())) app.change((pj) => setField(pj, 'w', 'time', d.toISOString()));
            }
        });
        side.addEventListener('click', (e) => {
            const rs = e.target.closest('[data-reset]');
            if (rs) { resetGroup(rs.dataset.reset); return; }
            if (e.target.closest('#ewf-reset-all')) {
                app.change((pj) => { pj.ewf = M.defaultState(); });
                app.toast(t('ewf.resetDone'));
                return;
            }
            const src = e.target.closest('#ewf-src button');
            if (src) setSource(src.dataset.src);
        });
        side.addEventListener('toggle', (e) => {
            const d = e.target.closest('details.ewf-panel');
            if (!d) return;
            const pr = app.prefs();
            pr.ewf.panels = $$('details.ewf-panel[open]', side).map((x) => x.dataset.group);
            app.savePrefs();
        }, true);

        const content = $('#ewf-content');
        content.addEventListener('click', (e) => {
            const tb = e.target.closest('#ewf-tabs .tab');
            if (tb) { setTab(tb.dataset.tab); return; }
            const why = e.target.closest('[data-why]');
            if (why) { setTab('method', 'ewf-m-' + why.dataset.why); return; }
            if (e.target.closest('#ewf-csv')) exportCSV();
        });
        content.addEventListener('keydown', (e) => {
            const tb = e.target.closest('#ewf-tabs .tab');
            if (!tb || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const i = TABS.indexOf(tb.dataset.tab) + (e.key === 'ArrowRight' ? 1 : -1);
            const k = TABS[(i + TABS.length) % TABS.length];
            setTab(k);
            $('#ewf-tab-' + k).focus();
        });
    }

    function setTab(tab, anchor) {
        const pr = app.prefs();
        pr.ewf.tab = tab;
        app.savePrefs();
        renderTab();
        if (anchor) {
            const el = document.getElementById(anchor) || $('#ewf-pane');
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function setSource(src) {
        const st = ewf();
        if (src === 'live') { if (root.EwfView.fetchLive) root.EwfView.fetchLive(); return; }
        if (src === st.weather.source) return;
        app.change((pj) => {
            if (src === 'manual') { pj.ewf.weather.values = clone(M.weatherOf(pj.ewf)); pj.ewf.weather.source = 'manual'; }
            else { pj.ewf.weather.source = 'preset'; pj.ewf.weather.values = M.presetWeather(pj.ewf.weather.presetId); }
        });
    }

    function resetGroup(g) {
        app.change((pj) => {
            if (g === 'weather') { pj.ewf.weather = M.defaultState().weather; return; }
            for (const f of fieldsOf(g)) pj.ewf.building[f.key] = M.DEFAULTS[f.key];
        });
        app.toast(t('ewf.resetDone'));
    }

    /** Panel openen en in beeld brengen (vanuit het schema). */
    function openPanel(g) {
        const d = $('#ewf-panel-' + g);
        if (!d) return;
        d.open = true;
        d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const first = $('input, select', d);
        if (first) first.focus({ preventScroll: true });
    }

    function schematicCallbacks() {
        return { openPanel };
    }

    // =====================================================================
    // Export
    // =====================================================================
    function exportCSV() {
        const r = S.result;
        if (!r) return;
        const tab = app.prefs().ewf.tab, R = (v, d) => (isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : '');
        const rows = [[app.getProject().name], [t('ewf.title'), t('ewf.modeLong.' + r.mode)], []];
        if (tab === 'energy') {
            rows.push([t('ewf.energy.item'), 'kW']);
            for (const [k, v] of energyRows(r)) rows.push([t('ewf.energy.' + k), R(v / 1000, 3)]);
        } else if (tab === 'all' && S.all) {
            rows.push(...root.EwfView.allCSV(S.all));
        } else {
            rows.push([t('ewf.tbl.floor'), 'z [m]', `${t('ewf.tbl.tSup')} [°C]`, `${t('ewf.tbl.supMargin')} [Pa]`, `${t('ewf.tbl.exhMargin')} [Pa]`,
                'p_over [Pa]', 'dp_hydr [Pa]', 'dp_th,kc [Pa]', 'dp_schacht [Pa]', 'dp_th,zs [Pa]', 'shunt [Pa]', 'p_ej [Pa]', `${t('ewf.energy.losses')} [Pa]`]);
            r.pressure.supply.forEach((q, i) => {
                const x = r.pressure.exhaust[i];
                rows.push([q.floor, R(q.z, 2), R(r.supply.t, 2), R(q.available, 2), R(x.available, 2), R(q.parts.pOver, 2), R(q.parts.dpHydr, 2),
                    R(q.parts.dpThCascade, 2), R(q.parts.dpShaft, 2), R(x.parts.dpThChimney, 2), R(x.parts.dpShunt, 2), R(x.parts.pEj, 2), R(x.parts.losses, 2)]);
            });
        }
        app.csv(rows, `${app.slug()}-ewf-${tab}.csv`);
    }
    function exportSVG() { if (S.schematic) S.schematic.exportSVG(app.getProject().name, app.download, app.slug()); }
    function exportPNG() { if (S.schematic) S.schematic.exportPNG(app.download, app.slug(), () => app.toast(t('toast.exportFail'), true)); }

    // =====================================================================
    // Start
    // =====================================================================
    function init(api) {
        app = api;
        buildSidebar();
        buildContent();
        bindEvents();
    }

    root.EwfView = {
        init, sync, show, renderAll, restyle, exportCSV, exportSVG, exportPNG, openPanel, setTab,
        get state() { return S; },
        get app() { return app; },
        compute, renderResults, updatePanels, th, signed, tabs: {}
    };
})(typeof self !== 'undefined' ? self : this);
