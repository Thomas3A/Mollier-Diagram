/**
 * energy.js — weergave "Energieverbruik": jaarberekening van de geselecteerde LBK
 *
 * Invoer: weekpatroon (7 × 24 uurblokken met bezetting, project.lbk.energy.schedule), bedrijfsvoering
 * en opwekking per LBK (unit.ops, unit.gen), klimaatjaar en tarieven (project.lbk.energy).
 * Uitvoer: kerngetallen, energie per maand (gestapelde kolommen), tabellen per maand en per component,
 * belastingduurkromme en een vergelijking van alle LBK's. Alleen bruikbaar met een LBK.
 */
(function (root) {
    'use strict';

    const E = root.LbkEngine, C = root.LbkClimate;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const SERIES = ['heat', 'cool', 'humid', 'fans'];
    const BRUSH = [0, 20, 40, 60, 80, 100];

    let app = null;
    const S = {
        visible: false, built: false, structKey: null, result: null, resultKey: null, clim: null, timer: 0,
        climate: 'idle', brush: 80, tab: 'months', chartMode: 'thermal', painting: false, compare: null, compareKey: null, comparing: false
    };

    // ---- Hulpjes ----
    const t = (k, v) => app.t(k, v);
    const fmt = (v, d) => app.fmt(v, d);
    const fmtA = (v, d) => app.fmtA(v, d);
    const esc = (s) => app.esc(s);
    const lbk = () => app.getProject().lbk;
    const en = () => lbk().energy;
    const unit = () => lbk().units.find((u) => u.id === lbk().active) || null;
    const p = () => app.pressure();
    const nf = {};
    /** Getal met duizendtalscheiding (NL: punt), voor jaarcijfers. */
    const num = (v, d = 0) => {
        if (!isFinite(v)) return '—';
        const k = app.lang + d;
        if (!nf[k]) nf[k] = new Intl.NumberFormat(app.lang === 'nl' ? 'nl-NL' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
        return nf[k].format(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).replace('-', '−');
    };
    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const seriesColor = (k) => css('--series-' + k);
    const has = (u, type, kind) => u.comps.some((c) => c.on !== false && c.type === type && (!kind || c.kind === kind));

    // =====================================================================
    // Zijbalk
    // =====================================================================
    function structKey() {
        const u = unit();
        return JSON.stringify({
            lang: app.lang, active: lbk().active, units: lbk().units.map((x) => [x.id, x.color]),
            u: u ? { o: [u.ops.control, u.ops.off], g: [u.gen.heat, u.gen.steam], c: u.comps.map((c) => [c.type, c.kind, c.on]) } : null,
            climate: en().climate, knmi: C.loaded('y2000')
        });
    }

    const tipOf = (key) => { const k = 'lbk.en.tip.' + key, v = t(k); return v === k ? '' : ` title="${esc(v)}"`; };
    function numField(path, label, unitTxt, value, opts = {}) {
        return `<label class="fld${opts.full ? ' full' : ''}"${tipOf(path)}><span class="fld-lbl">${esc(label)}</span><span class="input-unit">`
            + `<input class="input" data-path="${path}" data-kind="num" inputmode="decimal" autocomplete="off" value="${esc(isFinite(value) ? fmtA(value, opts.dec != null ? opts.dec : 3) : '')}">`
            + `<em>${esc(unitTxt || '')}</em></span></label>`;
    }
    function selField(path, label, options, value, labelOf) {
        return `<label class="fld full"><span class="fld-lbl">${esc(label)}</span><select class="input" data-path="${path}" data-kind="select">`
            + options.map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${esc(labelOf(o))}</option>`).join('') + '</select></label>';
    }

    function climateOptions(value) {
        const ref = C.REF.map((id) => `<option value="${id}"${id === value ? ' selected' : ''}>${esc(t('lbk.en.climate.' + id))}</option>`).join('');
        const rec = C.recommended();
        const yrs = C.years().slice().reverse().map((y) => {
            const id = 'y' + y;
            return `<option value="${id}"${id === value ? ' selected' : ''}>${esc(t(rec.includes(y) ? 'lbk.en.climate.yearRec' : 'lbk.en.climate.year', { y }))}</option>`;
        }).join('');
        return `<optgroup label="${esc(t('lbk.en.climate.groupRef'))}">${ref}</optgroup><optgroup label="${esc(t('lbk.en.climate.groupKnmi'))}">${yrs}</optgroup>`;
    }

    function buildSidebar() {
        const side = $('#energy-sidebar'), u = unit();
        S.structKey = structKey();
        S.built = true;
        if (!u) {
            side.innerHTML = `<section class="panel"><p class="hint">${esc(t('lbk.en.locked'))}</p><button type="button" class="btn primary" data-goto="lbk">${esc(t('lbk.en.lockedBtn'))}</button></section>`;
            return;
        }
        const pal = app.palette(), o = u.ops, g = u.gen, e = en();
        const chips = lbk().units.map((x) => `<button type="button" role="tab" class="scn-tab" data-unit="${esc(x.id)}" aria-selected="${x.id === u.id}" style="--c:${pal[x.color % 6]}"><i class="dot"></i>${esc(x.name)}</button>`).join('');
        const unitPanel = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.en.panel.unit'))}</h2><button type="button" class="chip-btn" data-goto="lbk"><svg><use href="#i-sliders"/></svg><span>${esc(t('lbk.en.edit'))}</span></button></div>`
            + `<div class="scn-tabs" role="tablist">${chips}</div><p class="en-unit-sum">${esc(t('lbk.en.unitSum', { mode: t('lbk.mode.' + u.mode), flow: num(u.flow), n: u.comps.filter((c) => c.on !== false).length }))}</p></section>`;
        let offFields = '';
        if (o.off === 'vent') offFields = `<div class="grid2">${numField('o.offFlow', t('lbk.en.f.offFlow'), '%', o.offFlow)}</div>`;
        if (o.off === 'eco') offFields = `<div class="grid2">${numField('o.offFlow', t('lbk.en.f.offFlow'), '%', o.offFlow)}${numField('o.ecoT', t('lbk.en.f.ecoT'), '°C', o.ecoT)}</div>`;
        if (o.off === 'night') offFields = `<div class="grid2">${numField('o.nightFlow', t('lbk.en.f.nightFlow'), '%', o.nightFlow)}${numField('o.nightTMin', t('lbk.en.f.nightTMin'), '°C', o.nightTMin)}${numField('o.nightTrig', t('lbk.en.f.nightTrig'), '°C', o.nightTrig)}</div>`;
        const ops = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.en.panel.ops'))}</h2></div>`
            + `<div class="fld full"><span class="fld-lbl">${esc(t('lbk.en.f.control'))}</span><div class="seg lbk-seg" data-seg="o.control">`
            + ['vav', 'cav'].map((k) => `<button type="button" data-val="${k}" aria-selected="${o.control === k}">${esc(t('lbk.en.o.control.' + k))}</button>`).join('') + '</div></div>'
            + (o.control === 'vav' ? `<div class="grid2">${numField('o.minFlow', t('lbk.en.f.minFlow'), '%', o.minFlow)}</div>` : '')
            + `<p class="hint">${esc(t('lbk.en.controlHint.' + o.control))}</p>`
            + selField('o.off', t('lbk.en.f.off'), ['off', 'vent', 'eco', 'night'], o.off, (k) => t('lbk.en.o.off.' + k))
            + offFields + `<p class="hint">${esc(t('lbk.en.offHint.' + o.off))}</p></section>`;
        const climate = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.en.panel.climate'))}</h2></div>`
            + `<label class="fld full"><span class="fld-lbl">${esc(t('lbk.en.f.climate'))}</span><select class="input" data-path="e.climate" data-kind="select" id="en-climate">${climateOptions(e.climate)}</select></label>`
            + `<div class="en-climate-meta" id="en-climate-meta"></div></section>`;
        const heatEff = g.heat === 'hp' ? numField('g.scop', t('lbk.en.f.scop'), '–', g.scop)
            : numField('g.etaHeat', t(g.heat === 'district' ? 'lbk.en.f.etaDistrict' : g.heat === 'elec' ? 'lbk.en.f.etaElec' : 'lbk.en.f.etaHeat'), '%', g.etaHeat);
        const gen = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.en.panel.gen'))}</h2></div>`
            + selField('g.heat', t('lbk.en.f.heat'), ['boiler', 'hp', 'district', 'elec'], g.heat, (k) => t('lbk.en.o.heat.' + k))
            + `<div class="grid2">${heatEff}${has(u, 'cooler') ? numField('g.seer', t('lbk.en.f.seer'), '–', g.seer) : ''}</div>`
            + (has(u, 'humid', 'steam') ? selField('g.steam', t('lbk.en.f.steam'), ['elec', 'gas'], g.steam, (k) => t('lbk.en.o.steam.' + k))
                + `<div class="grid2">${numField('g.etaSteam', t('lbk.en.f.etaSteam'), '%', g.etaSteam)}</div>` : '')
            + '</section>';
        const tf = e.tariffs;
        const tariffs = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.en.panel.tariffs'))}</h2></div><div class="grid2">`
            + numField('t.elec', t('lbk.en.f.elec'), '€/kWh', tf.elec) + numField('t.gas', t('lbk.en.f.gas'), '€/m³', tf.gas)
            + numField('t.heat', t('lbk.en.f.heatT'), '€/GJ', tf.heat) + numField('t.water', t('lbk.en.f.water'), '€/m³', tf.water) + '</div></section>';
        side.innerHTML = unitPanel + ops + climate + gen + tariffs;
        updateValues();
    }

    const setVal = (el, v) => { if (document.activeElement !== el) el.value = v; };
    function getPath(path) {
        const [scope, key] = path.split('.'), u = unit();
        if (scope === 'o') return u.ops[key];
        if (scope === 'g') return u.gen[key];
        if (scope === 't') return en().tariffs[key];
        if (scope === 'e') return en()[key];
        return undefined;
    }
    function setPath(pj, path, value) {
        const [scope, key] = path.split('.');
        const u = pj.lbk.units.find((x) => x.id === pj.lbk.active);
        if (scope === 'o') u.ops[key] = value;
        else if (scope === 'g') u.gen[key] = value;
        else if (scope === 't') pj.lbk.energy.tariffs[key] = value;
        else if (scope === 'e') pj.lbk.energy[key] = value;
    }
    function normalizeAll(pj) {
        const i = pj.lbk.units.findIndex((x) => x.id === pj.lbk.active);
        if (i >= 0) pj.lbk.units[i] = E.normalizeUnit(pj.lbk.units[i], i);
        pj.lbk.energy = E.normalizeState({ units: [], energy: pj.lbk.energy }).energy;
    }

    function updateValues() {
        if (!unit()) return;
        $$('#energy-sidebar [data-path]').forEach((el) => {
            const v = getPath(el.dataset.path);
            if (el.dataset.kind === 'num') setVal(el, isFinite(v) ? fmtA(v, 3) : '');
            else if (el.dataset.kind === 'select' && document.activeElement !== el) el.value = v;
        });
        renderClimateMeta();
    }

    function renderClimateMeta() {
        const box = $('#en-climate-meta');
        if (!box) return;
        const id = en().climate, m = C.meta(id);
        const parts = [];
        if (C.REF.includes(id) && m) parts.push(`<p class="hint">${esc(m.omschrijving)}</p>`);
        if (m && m.statistiek) {
            const s = m.statistiek;
            parts.push(`<p class="hint">${esc(t('lbk.en.climate.stats', { tg: fmt(s.Tgem, 1), tmin: fmt(s.Tmin, 1), kw: fmt(s.koudste_168u, 1), gd: num(s.graaddagen_18) }))}</p>`);
        }
        if (S.climate === 'loading') parts.push(`<p class="hint">${esc(t(C.isYear(id) ? 'lbk.en.climate.loadKnmi' : 'lbk.en.climate.loading'))}</p>`);
        if (S.climate === 'error') parts.push(`<p class="en-approx">${esc(t('lbk.en.climate.loadFail'))}</p>`);
        if (C.isYear(id)) parts.push(`<p class="en-approx">${esc(t('lbk.en.climate.approx'))}</p>`);
        parts.push(`<p class="hint">${esc(t('lbk.en.climate.advice'))}</p><p class="en-note">${esc(t('lbk.en.climate.note'))}</p>`);
        box.innerHTML = parts.join('');
    }

    // =====================================================================
    // Inhoud
    // =====================================================================
    function buildContent() {
        S.builtLang = app.lang;
        const days = t('lbk.en.sched.days');
        let grid = '<span></span>';
        for (let h = 0; h < 24; h++) grid += `<button type="button" class="hd" data-hour="${h}" title="${esc(t('lbk.en.sched.fillHour', { h, h2: h + 1 }))}">${h}</button>`;
        for (let d = 0; d < 7; d++) {
            grid += `<button type="button" class="hd dh" data-day="${d}" title="${esc(t('lbk.en.sched.fillDay', { day: t('lbk.en.sched.daysLong')[d] }))}">${esc(days[d])}</button>`;
            for (let h = 0; h < 24; h++) grid += `<button type="button" class="cell" data-d="${d}" data-h="${h}"></button>`;
        }
        $('#energy-content').innerHTML = `
            <div class="card lbk-empty" id="en-locked" hidden></div>
            <div id="energy-main">
                <div class="card en-sched-card">
                    <div class="en-sched-head"><h3>${esc(t('lbk.en.sched.title'))}</h3><span class="en-sum" id="en-sched-sum"></span></div>
                    <div class="en-tools">
                        <div class="en-brush" id="en-brush"><span class="lbl">${esc(t('lbk.en.sched.brush'))}</span>
                            ${BRUSH.map((v) => `<button type="button" data-brush="${v}" style="--v:${v}">${v} %</button>`).join('')}
                            <input class="input" id="en-brush-custom" inputmode="decimal" placeholder="${esc(t('lbk.en.sched.custom'))}" aria-label="${esc(t('lbk.en.sched.custom'))}"></div>
                        <div class="en-presets"><span class="lbl">${esc(t('lbk.en.sched.presets'))}</span>
                            ${['office', 'long', 'always', 'clear'].map((k) => `<button type="button" data-preset="${k}">${esc(t('lbk.en.sched.preset.' + k))}</button>`).join('')}</div>
                    </div>
                    <div class="en-grid-wrap"><div class="en-grid" id="en-grid" role="grid">${grid}</div></div>
                    <p class="hint">${esc(t('lbk.en.sched.hint'))}</p>
                </div>
                <div class="kpis lbk-kpis" id="en-kpis"></div>
                <div class="card lbk-warn" id="en-warn"></div>
                <div class="card en-chart-card">
                    <div class="chart-head"><div class="chart-title" id="en-chart-title"></div>
                        <div class="chart-tools"><div class="seg" id="en-chart-mode" role="tablist">
                            <button type="button" data-cmode="thermal">${esc(t('lbk.en.chart.thermal'))}</button>
                            <button type="button" data-cmode="cost">${esc(t('lbk.en.chart.cost'))}</button></div></div></div>
                    <div class="en-chart" id="en-chart"></div>
                    <div class="en-legend" id="en-legend"></div>
                </div>
                <div class="card results">
                    <div class="results-head"><div class="tabs" role="tablist">
                        ${['months', 'comps', 'duration', 'compare', 'method'].map((k) => `<button type="button" class="tab" data-etab="${k}">${esc(t('lbk.en.tab.' + k))}</button>`).join('')}</div>
                        <button type="button" class="tb-btn sm" id="en-csv" style="margin-left:auto"><svg><use href="#i-download"/></svg><span>CSV</span></button></div>
                    <div class="en-pane" id="en-pane"></div>
                </div>
            </div>`;
        if (root.ResizeObserver) {
            let lastW = 0, timer = 0;
            new ResizeObserver((ent) => {
                const w = Math.round(ent[0].contentRect.width);
                if (Math.abs(w - lastW) < 8) return;
                lastW = w;
                clearTimeout(timer);
                timer = setTimeout(() => { if (S.visible && S.result) { renderChart(); if (S.tab === 'duration') renderPane(); } }, 120);
            }).observe($('#en-chart'));
        }
    }

    function renderGrid() {
        const sch = en().schedule;
        $$('#en-grid .cell').forEach((el) => {
            const v = sch[+el.dataset.d][+el.dataset.h];
            el.style.setProperty('--v', v);
            el.textContent = v > 0 ? v : '';
            el.className = 'cell' + (v >= 50 ? ' on' : v > 0 ? ' lo' : '');
            el.setAttribute('aria-label', t('lbk.en.sched.cell', { day: t('lbk.en.sched.daysLong')[+el.dataset.d], h: el.dataset.h, h2: +el.dataset.h + 1, v }));
        });
        $$('#en-brush [data-brush]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.brush === S.brush)));
        const custom = $('#en-brush-custom');
        if (custom && document.activeElement !== custom) custom.value = BRUSH.includes(S.brush) ? '' : String(S.brush);
        const sw = S.clim ? S.clim.startWeekday : (C.meta(en().climate) || {}).startWeekday || 1;
        const st = E.scheduleStats(sch, sw);
        $('#en-sched-sum').textContent = t('lbk.en.sched.summary', { h: st.hours, m: fmt(st.mean, 0), y: num(st.year) });
    }

    function paint(cells, value, live) {
        const sch = en().schedule;
        const todo = cells.filter(([d, h]) => sch[d][h] !== value);
        if (!todo.length) return;
        app.change((pj) => { for (const [d, h] of todo) pj.lbk.energy.schedule[d][h] = value; }, live);
    }
    function preset(k) {
        const fill = (fn) => app.change((pj) => { pj.lbk.energy.schedule = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => fn(d, h))); });
        if (k === 'office') fill((d, h) => (d < 5 && h >= 8 && h < 17 ? 80 : 0));
        if (k === 'long') fill((d, h) => (d < 5 && h >= 7 && h < 19 ? 100 : 0));
        if (k === 'always') fill(() => 100);
        if (k === 'clear') fill(() => 0);
    }

    // ---- Berekening ----
    function resultKey() {
        const u = unit();
        return JSON.stringify([u, en().climate, en().schedule, Math.round(p())]);
    }
    function schedule() {
        clearTimeout(S.timer);
        S.timer = setTimeout(compute, S.result ? 120 : 0);
    }
    async function compute() {
        const u = unit();
        if (!u || !S.visible) return;
        const key = resultKey();
        if (key === S.resultKey && S.result) { renderResults(); return; }
        const id = en().climate;
        if (!C.loaded(id)) {
            S.climate = 'loading';
            renderClimateMeta();
            $('#en-kpis').innerHTML = `<div class="en-busy">${esc(t('lbk.en.climate.loading'))}</div>`;
            try { await C.get(id, p()); } catch (e) {
                S.climate = 'error';
                renderClimateMeta();
                $('#en-kpis').innerHTML = `<div class="en-busy">${esc(t('lbk.en.climate.loadFail'))}</div>`;
                return;
            }
            S.structKey = null;           // klimaatlijst opnieuw opbouwen (tooltips/stresstestjaren)
        }
        S.climate = 'ready';
        if (resultKey() !== key) { schedule(); return; }      // intussen gewijzigd
        const clim = C.getSync(id, p());
        S.clim = clim;
        S.result = E.simulateYear(u, clim, { p: p(), schedule: en().schedule });
        S.resultKey = key;
        if (!S.built || structKey() !== S.structKey) buildSidebar();
        renderGrid();
        renderResults();
    }

    function finalOf(totals, u) { return E.finalEnergy(totals, u.gen, en().tariffs); }

    function renderResults() {
        const u = unit(), r = S.result;
        if (!u || !r) return;
        const tt = r.total, f = finalOf(tt, u);
        renderKPIs(u, r, tt, f);
        renderWarnings(u, r);
        renderChart();
        renderPane();
    }

    function tile(lbl, color, val, unitTxt, sub, zero) {
        return `<div class="kpi${zero ? ' zero' : ''}"><div class="kpi-lbl"><i class="kpi-icon" style="background:${color}"></i>${esc(lbl)}</div>`
            + `<div class="kpi-val">${val}<small>${unitTxt}</small></div><div class="kpi-sub">${sub || '&nbsp;'}</div></div>`;
    }
    function renderKPIs(u, r, tt, f) {
        const mwh = (v) => num(v / 1000, v >= 100000 ? 0 : 1);
        const hp = f.parts.heat;
        const heatSub = (u.gen.heat === 'boiler' ? t('lbk.en.kpi.gas', { v: num(hp.gas) }) : u.gen.heat === 'district' ? t('lbk.en.kpi.gj', { v: num(hp.gj, 1) }) : t('lbk.en.kpi.elec', { v: num(hp.elec) }))
            + ' · ' + t('lbk.en.kpi.peak', { v: fmt(r.peaks.heat, 1) });
        const fans = tt.fanSup + tt.fanRet;
        const steam = has(u, 'humid', 'steam');
        $('#en-kpis').innerHTML = [
            tile(t('lbk.en.kpi.heat'), seriesColor('heat'), mwh(tt.heat), 'MWh', esc(heatSub), tt.heat < 1),
            tile(t('lbk.en.kpi.cool'), seriesColor('cool'), mwh(tt.cool), 'MWh', esc(t('lbk.en.kpi.elec', { v: num(f.parts.cool.elec) }) + ' · ' + t('lbk.en.kpi.peak', { v: fmt(r.peaks.cool, 1) })), tt.cool < 1),
            tile(t('lbk.en.kpi.humid'), seriesColor('humid'), steam ? mwh(tt.steam) : num(tt.humidKg / 1000, 1), steam ? 'MWh' : 'm³', esc(t('lbk.en.kpi.water', { v: num(f.parts.humid.water, 1) })), tt.humidKg < 1),
            tile(t('lbk.en.kpi.fans'), seriesColor('fans'), mwh(fans), 'MWh', esc(t('lbk.en.kpi.fansSub', { v: fmt(tt.hoursOn ? fans / tt.hoursOn : 0, 2) })), fans < 1),
            tile(t('lbk.en.kpi.cost'), 'var(--text-2)', '€ ' + num(f.sum.cost), '', esc(t('lbk.en.kpi.costSub')), f.sum.cost < 1),
            tile(t('lbk.en.kpi.hours'), 'var(--muted)', num(tt.hoursOn), 'h', esc(t('lbk.en.kpi.hoursSub', { v: num(tt.hoursOcc) })), !tt.hoursOn)
        ].join('');
    }

    function renderWarnings(u, r) {
        const tt = r.total, out = [];
        const w = (level, txt) => out.push(`<li class="lbk-w ${level}">${esc(txt)}</li>`);
        if (tt.unmetTLow) w('warn', t('lbk.en.warn.unmetTLow', { n: num(tt.unmetTLow) }));
        if (tt.unmetTHigh) w(has(u, 'cooler') ? 'warn' : 'info', t('lbk.en.warn.unmetTHigh', { n: num(tt.unmetTHigh) }));
        if (tt.unmetXLow) w('warn', t('lbk.en.warn.unmetXLow', { n: num(tt.unmetXLow) }));
        if (tt.unmetXHigh) w('warn', t('lbk.en.warn.unmetXHigh', { n: num(tt.unmetXHigh) }));
        for (const c of u.comps) {
            const a = r.comps[c.id];
            if (!a) continue;
            if (a.cappedHours) w('info', t('lbk.en.warn.capped', { name: root.LbkView.compName(c, 'sup', u), n: num(a.cappedHours) }));
            if (a.frostHours) w('info', t('lbk.en.warn.frost', { n: num(a.frostHours) }));
        }
        if (S.clim && S.clim.approxX) w('info', t('lbk.en.climate.approx'));
        if (!tt.unmetTLow && !tt.unmetTHigh && !tt.unmetXLow && !tt.unmetXHigh) w('ok', t('lbk.en.warn.none'));
        $('#en-warn').innerHTML = `<ul class="lbk-w-list">${out.join('')}</ul>`;
    }

    /** Maandwaarden per reeks in de gekozen eenheid. */
    function monthSeries(u) {
        const r = S.result;
        if (S.chartMode === 'cost') {
            return r.months.map((m) => {
                const f = finalOf(m, u).parts;
                return { heat: f.heat.cost, cool: f.cool.cost, humid: f.humid.cost, fans: f.fan.cost };
            });
        }
        return r.months.map((m) => ({ heat: m.heat, cool: m.cool, humid: m.steam, fans: m.fanSup + m.fanRet }));
    }

    function renderChart() {
        const u = unit(), box = $('#en-chart');
        if (!u || !S.result || !box || !root.d3) return;
        const d3 = root.d3;
        $$('#en-chart-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cmode === S.chartMode)));
        const cost = S.chartMode === 'cost';
        const data = monthSeries(u);
        const maxTot = d3.max(data, (d) => SERIES.reduce((a, k) => a + d[k], 0)) || 1;
        const mw = !cost && maxTot > 20000;
        const scale = mw ? 1 / 1000 : 1;
        const unitTxt = cost ? '€' : mw ? 'MWh' : 'kWh';
        $('#en-chart-title').textContent = `${t('lbk.en.chart.title')} · ${u.name} · ${unitTxt}`;
        const W = Math.max(320, box.clientWidth - 24), H = 300;
        const m = { top: 22, right: 8, bottom: 26, left: 52 };
        const months = t('lbk.en.chart.months');
        const x = d3.scaleBand().domain(d3.range(12)).range([m.left, W - m.right]).paddingInner(0.3);
        const y = d3.scaleLinear().domain([0, maxTot * scale * 1.12]).nice().range([H - m.bottom, m.top]);
        const colors = Object.fromEntries(SERIES.map((k) => [k, seriesColor(k)]));
        const muted = css('--muted'), border = css('--border'), text2 = css('--text-2'), surface = css('--surface');
        const bw = Math.min(26, x.bandwidth());
        const svg = [];
        svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('lbk.en.chart.title'))}" font-family="${esc(css('--font'))}">`);
        svg.push(`<rect width="${W}" height="${H}" fill="${surface}"/>`);
        for (const v of y.ticks(5)) {
            svg.push(`<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}" stroke="${border}" stroke-width="1"/>`);
            svg.push(`<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${esc(num(v, v < 10 && v % 1 ? 1 : 0))}</text>`);
        }
        svg.push(`<text x="${m.left - 8}" y="${m.top - 8}" text-anchor="end" font-size="11" font-weight="600" fill="${text2}">${unitTxt}</text>`);
        data.forEach((d, i) => {
            const cx = x(i) + x.bandwidth() / 2, x0 = cx - bw / 2;
            let acc = 0;
            const segs = SERIES.filter((k) => d[k] * scale > 0);
            segs.forEach((k, j) => {
                const v0 = acc, v1 = acc + d[k] * scale;
                acc = v1;
                const yTop = y(v1), yBot = y(v0);
                const top = j === segs.length - 1;
                const gapB = j > 0 ? 1 : 0, gapT = top ? 0 : 1;           // 2 px oppervlak tussen segmenten
                const y1 = yTop + gapT, y2 = yBot - gapB;
                if (y2 - y1 < 0.5) return;
                if (top) {
                    const r = Math.min(4, (y2 - y1), bw / 2);
                    svg.push(`<path d="M${x0} ${y2}V${y1 + r}Q${x0} ${y1} ${x0 + r} ${y1}H${x0 + bw - r}Q${x0 + bw} ${y1} ${x0 + bw} ${y1 + r}V${y2}Z" fill="${colors[k]}"/>`);
                } else svg.push(`<rect x="${x0}" y="${y1}" width="${bw}" height="${y2 - y1}" fill="${colors[k]}"/>`);
            });
            const tot = SERIES.reduce((a, k) => a + d[k], 0) * scale;
            if (x.bandwidth() > 40 && tot > 0) svg.push(`<text x="${cx}" y="${y(tot) - 6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${text2}">${esc(num(tot, tot < 10 ? 1 : 0))}</text>`);
            svg.push(`<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${muted}">${esc(months[i])}</text>`);
            svg.push(`<rect class="bar-hit" data-m="${i}" x="${x(i) - x.step() * x.paddingInner() / 2}" y="${m.top}" width="${x.step()}" height="${H - m.top - m.bottom}"/>`);
        });
        svg.push(`<line x1="${m.left}" x2="${W - m.right}" y1="${y(0)}" y2="${y(0)}" stroke="${muted}" stroke-width="1"/>`);
        svg.push('</svg>');
        box.innerHTML = svg.join('') + '<div class="en-tip" id="en-tip" hidden></div>';
        $('#en-legend').innerHTML = SERIES.map((k) => `<span><i style="background:${colors[k]}"></i>${esc(t('lbk.en.series.' + k))}</span>`).join('');
        S.chartData = { data, scale, unitTxt, cost };
    }

    function showTip(i, ev) {
        const tip = $('#en-tip'), cd = S.chartData;
        if (!tip || !cd) return;
        const d = cd.data[i];
        const val = (v) => (cd.cost ? '€ ' + num(v) : `${num(v * cd.scale, cd.scale < 1 ? 1 : 0)} ${cd.unitTxt}`);
        const tot = SERIES.reduce((a, k) => a + d[k], 0);
        tip.innerHTML = `<b>${esc(t('lbk.en.chart.monthsLong')[i])}</b>`
            + SERIES.slice().reverse().map((k) => `<div><span><i style="background:${seriesColor(k)}"></i>${esc(t('lbk.en.series.' + k))}</span>${val(d[k])}</div>`).join('')
            + `<div class="tot"><span>${esc(t('lbk.en.chart.total'))}</span>${val(tot)}</div>`;
        tip.hidden = false;
        const box = $('#en-chart').getBoundingClientRect();
        const xPos = ev.clientX - box.left, w = tip.offsetWidth;
        tip.style.left = `${Math.min(box.width - w - 4, Math.max(4, xPos + 14))}px`;
        tip.style.top = `${Math.max(4, ev.clientY - box.top - tip.offsetHeight - 10)}px`;
    }

    // ---- Tabbladen ----
    function th(lbl, unitTxt, cls) { return `<th${cls ? ` class="${cls}"` : ''}>${esc(lbl)}${unitTxt ? `<span class="u">${unitTxt}</span>` : ''}</th>`; }

    function renderPane() {
        const pane = $('#en-pane'), u = unit();
        $$('#energy-content [data-etab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.etab === S.tab)));
        if (!pane || !u || !S.result) return;
        if (S.tab === 'months') pane.innerHTML = monthsTable(u);
        else if (S.tab === 'comps') pane.innerHTML = compsTable(u);
        else if (S.tab === 'duration') durationChart(pane);
        else if (S.tab === 'compare') compareTab(pane);
        else {
            const m = (k) => esc(t('lbk.en.method.' + k));
            pane.innerHTML = `<div class="en-method"><h4>${m('h1')}</h4><p>${m('p1')}</p><h4>${m('h2')}</h4><p>${m('p2')}</p><h4>${m('h3')}</h4><p>${m('p3')}</p><h4>${m('h4')}</h4><p>${m('p4')}</p><p class="en-note">${esc(t('lbk.en.climate.note'))}</p></div>`;
        }
    }

    function monthsTable(u) {
        const r = S.result, steam = has(u, 'humid', 'steam');
        const cols = [
            ['heat', 'kWh', (m) => num(m.heat)], ['cool', 'kWh', (m) => num(m.cool)], ['coolLat', 'kWh', (m) => num(m.coolLat)],
            ['steam', 'kWh', (m) => num(m.steam), steam], ['humidKg', 'kg', (m) => num(m.humidKg)], ['fans', 'kWh', (m) => num(m.fanSup + m.fanRet)],
            ['rec', 'kWh', (m) => num(m.recHeat)], ['recCool', 'kWh', (m) => num(m.recCool)], ['hours', 'h', (m) => num(m.hoursOn)],
            ['unmet', 'h', (m) => num(m.unmetTLow + m.unmetTHigh + m.unmetXLow + m.unmetXHigh)], ['cost', '€', (m) => num(finalOf(m, u).sum.cost)]
        ].filter((c) => c[3] !== false);
        const months = t('lbk.en.chart.monthsLong');
        const head = `<thead><tr>${th(t('lbk.en.col.month'), '', 'l')}${cols.map((c) => th(t('lbk.en.col.' + c[0]), c[1])).join('')}</tr></thead>`;
        const body = r.months.map((m, i) => `<tr><td class="l">${esc(months[i])}</td>${cols.map((c) => `<td>${c[2](m)}</td>`).join('')}</tr>`).join('');
        const foot = `<tfoot><tr><td class="l">${esc(t('lbk.en.chart.total'))}</td>${cols.map((c) => `<td>${c[2](r.total)}</td>`).join('')}</tr></tfoot>`;
        return `<div class="table-wrap"><table class="data-table">${head}<tbody>${body}</tbody>${foot}</table></div>`;
    }

    function compsTable(u) {
        const r = S.result;
        const head = `<thead><tr>${th(t('lbk.en.col.comp'), '', 'l')}${th(t('lbk.en.col.pos'), 'kWh')}${th(t('lbk.en.col.neg'), 'kWh')}${th(t('lbk.en.col.water'), 'kg')}${th(t('lbk.en.col.elec'), 'kWh')}${th(t('lbk.en.col.peak'), 'kW · kg/h')}${th(t('lbk.en.col.capped'), 'h')}</tr></thead>`;
        const rows = u.comps.filter((c) => c.on !== false).map((c) => {
            const a = r.comps[c.id];
            if (!a) return '';
            const isFan = c.type === 'fan';
            return `<tr><td class="l">${esc(root.LbkView.compName(c, 'sup', u))}</td><td>${isFan ? '—' : num(a.pos)}</td><td>${num(a.neg)}</td>`
                + `<td>${Math.abs(a.water) > 0.5 ? num(a.water) : '—'}</td><td>${isFan ? num(a.elec) : '—'}</td><td>${fmt(a.peak, 1)}</td><td>${a.cappedHours ? num(a.cappedHours) : '—'}</td></tr>`;
        }).join('');
        const ret = r.total.fanRet > 0 ? `<tr class="lbk-extra"><td class="l">${esc(t('lbk.name.fan.ret'))}</td><td>—</td><td>—</td><td>—</td><td>${num(r.total.fanRet)}</td><td>—</td><td>—</td></tr>` : '';
        return `<div class="table-wrap"><table class="data-table">${head}<tbody>${rows}${ret}</tbody></table></div>`;
    }

    function durationChart(pane) {
        const d3 = root.d3, r = S.result;
        const heat = Array.from(r.hourly.heat).filter((v) => v > 0.01).sort((a, b) => b - a);
        const cool = Array.from(r.hourly.cool).filter((v) => v > 0.01).sort((a, b) => b - a);
        const W = Math.max(320, pane.clientWidth - 24), H = 280, m = { top: 18, right: 14, bottom: 34, left: 52 };
        const n = Math.max(heat.length, cool.length, 10);
        const x = d3.scaleLinear().domain([0, n]).range([m.left, W - m.right]);
        const y = d3.scaleLinear().domain([0, (d3.max(heat.concat(cool)) || 1) * 1.08]).nice().range([H - m.bottom, m.top]);
        const muted = css('--muted'), border = css('--border'), text2 = css('--text-2'), surface = css('--surface');
        /** Lijn (2 px) en vlak (10 %) van een gesorteerde reeks; uitgedund tot ±600 punten. */
        const line = (arr) => {
            if (!arr.length) return null;
            const step = Math.max(1, Math.floor(arr.length / 600));
            let d = `M${x(0)} ${y(arr[0])}`;
            for (let i = step; i < arr.length; i += step) d += `L${x(i)} ${y(arr[i])}`;
            d += `L${x(arr.length)} ${y(arr[arr.length - 1])}`;
            return { stroke: d, area: `${d}L${x(arr.length)} ${y(0)}L${x(0)} ${y(0)}Z` };
        };
        const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="${esc(css('--font'))}" role="img" aria-label="${esc(t('lbk.en.duration.title'))}"><rect width="${W}" height="${H}" fill="${surface}"/>`];
        for (const v of y.ticks(5)) svg.push(`<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}" stroke="${border}"/><text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${num(v)}</text>`);
        for (const v of x.ticks(6)) svg.push(`<text x="${x(v)}" y="${H - m.bottom + 16}" text-anchor="middle" font-size="11" fill="${muted}">${num(v)}</text>`);
        svg.push(`<text x="${(m.left + W - m.right) / 2}" y="${H - 4}" text-anchor="middle" font-size="11" font-weight="600" fill="${text2}">${esc(t('lbk.en.duration.x'))}</text>`);
        svg.push(`<text x="${m.left - 8}" y="${m.top - 6}" text-anchor="end" font-size="11" font-weight="600" fill="${text2}">kW</text>`);
        for (const [arr, k] of [[heat, 'heat'], [cool, 'cool']]) {
            const c = seriesColor(k), d = line(arr);
            if (!d) continue;
            svg.push(`<path d="${d.area}" fill="${c}" fill-opacity=".1"/><path d="${d.stroke}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
        }
        svg.push(`<line x1="${m.left}" x2="${W - m.right}" y1="${y(0)}" y2="${y(0)}" stroke="${muted}"/>`);
        svg.push(`<line class="en-cross" x1="0" x2="0" y1="${m.top}" y2="${H - m.bottom}" stroke="${text2}" stroke-dasharray="3 3" visibility="hidden"/>`);
        svg.push('</svg>');
        pane.innerHTML = `<p class="hint">${esc(t('lbk.en.duration.title'))}</p><div class="en-chart en-dur" id="en-dur">${svg.join('')}<div class="en-tip" id="en-dur-tip" hidden></div></div>`
            + `<div class="en-legend">${['heat', 'cool'].map((k) => `<span><i style="background:${seriesColor(k)}"></i>${esc(t('lbk.en.duration.' + k))}</span>`).join('')}</div>`;
        const box = $('#en-dur'), svgEl = box.querySelector('svg'), tip = $('#en-dur-tip'), cross = box.querySelector('.en-cross');
        svgEl.addEventListener('pointermove', (ev) => {
            const rc = svgEl.getBoundingClientRect(), sx = (ev.clientX - rc.left) * W / rc.width;
            const i = Math.round(x.invert(sx));
            if (i < 0 || i > n) { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); return; }
            cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
            tip.innerHTML = `<b>${num(i)} h</b>` + [['heat', heat], ['cool', cool]].map(([k, arr]) => `<div><span><i style="background:${seriesColor(k)}"></i>${esc(t('lbk.en.duration.' + k))}</span>${fmt(arr[i] || 0, 1)} kW</div>`).join('');
            tip.hidden = false;
            tip.style.left = `${Math.min(rc.width - tip.offsetWidth - 4, Math.max(4, ev.clientX - rc.left + 14))}px`;
            tip.style.top = '8px';
        });
        svgEl.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
    }

    function compareKey() { return JSON.stringify([lbk().units, en().climate, en().schedule, en().tariffs, Math.round(p())]); }
    function compareTab(pane) {
        const ready = S.compare && S.compareKey === compareKey();
        let html = `<div class="en-compare-head"><button type="button" class="btn${ready ? '' : ' primary'}" id="en-compare-run"${S.comparing ? ' disabled' : ''}>${esc(t(S.comparing ? 'lbk.en.compare.busy' : 'lbk.en.compare.run'))}</button><span class="hint">${esc(t('lbk.en.compare.note'))}</span></div>`;
        if (ready) {
            const pal = app.palette();
            const head = `<thead><tr>${th(t('lbk.en.col.unit'), '', 'l')}${th(t('lbk.en.col.heat'), 'MWh')}${th(t('lbk.en.col.cool'), 'MWh')}${th(t('lbk.en.col.steam'), 'MWh')}${th(t('lbk.en.col.fans'), 'MWh')}${th(t('lbk.en.col.hours'), 'h')}${th(t('lbk.en.col.unmet'), 'h')}${th(t('lbk.en.col.cost'), '€')}</tr></thead>`;
            const rows = S.compare.map((c) => {
                const tt = c.total;
                return `<tr class="${c.id === lbk().active ? 'selected' : ''}"><td class="l"><span class="nr" style="--c:${pal[c.color % 6]}">&nbsp;</span> ${esc(c.name)}</td>`
                    + `<td>${num(tt.heat / 1000, 1)}</td><td>${num(tt.cool / 1000, 1)}</td><td>${num(tt.steam / 1000, 1)}</td><td>${num((tt.fanSup + tt.fanRet) / 1000, 1)}</td>`
                    + `<td>${num(tt.hoursOn)}</td><td>${num(tt.unmetTLow + tt.unmetTHigh + tt.unmetXLow + tt.unmetXHigh)}</td><td><b>${num(c.cost)}</b></td></tr>`;
            }).join('');
            html += `<div class="table-wrap"><table class="data-table">${head}<tbody>${rows}</tbody></table></div>`;
        }
        pane.innerHTML = html;
    }
    async function runCompare() {
        if (S.comparing) return;
        S.comparing = true;
        renderPane();
        const id = en().climate;
        try { await C.get(id, p()); } catch (e) { S.comparing = false; renderPane(); return; }
        const clim = C.getSync(id, p());
        const out = [];
        for (const u of lbk().units) {
            await new Promise((res) => setTimeout(res, 0));
            const r = E.simulateYear(u, clim, { p: p(), schedule: en().schedule });
            out.push({ id: u.id, name: u.name, color: u.color, total: r.total, cost: finalOf(r.total, u).sum.cost });
        }
        S.compare = out;
        S.compareKey = compareKey();
        S.comparing = false;
        if (S.tab === 'compare') renderPane();
    }

    // ---- Export ----
    function exportCSV() {
        const u = unit(), r = S.result;
        if (!u || !r) return;
        const months = t('lbk.en.chart.monthsLong'), f = finalOf(r.total, u);
        const climLabel = C.REF.includes(en().climate) ? t('lbk.en.climate.' + en().climate) : en().climate.slice(1);
        const rows = [[app.getProject().name], [u.name, t('lbk.en.f.climate'), climLabel], []];
        const hdr = [['month', ''], ['heat', 'kWh'], ['cool', 'kWh'], ['coolLat', 'kWh'], ['steam', 'kWh'], ['humidKg', 'kg'], ['fans', 'kWh'],
            ['rec', 'kWh'], ['recCool', 'kWh'], ['hours', 'h'], ['unmet', 'h'], ['cost', '€']];
        rows.push(hdr.map(([k, un]) => t('lbk.en.col.' + k) + (un ? ` [${un}]` : '')));
        const line = (lbl, m) => [lbl, +m.heat.toFixed(1), +m.cool.toFixed(1), +m.coolLat.toFixed(1), +m.steam.toFixed(1), +m.humidKg.toFixed(1),
            +(m.fanSup + m.fanRet).toFixed(1), +m.recHeat.toFixed(1), +m.recCool.toFixed(1), m.hoursOn, m.unmetTLow + m.unmetTHigh + m.unmetXLow + m.unmetXHigh, +finalOf(m, u).sum.cost.toFixed(2)];
        r.months.forEach((m, i) => rows.push(line(months[i], m)));
        rows.push(line(t('lbk.en.chart.total'), r.total));
        rows.push([]);
        rows.push([t('lbk.en.f.elec') + ' [kWh]', +f.sum.elec.toFixed(1)], [t('lbk.en.f.gas') + ' [m³]', +f.sum.gas.toFixed(1)], [t('lbk.en.f.heatT') + ' [GJ]', +f.sum.gj.toFixed(2)],
            [t('lbk.en.f.water') + ' [m³]', +f.sum.water.toFixed(2)], [t('lbk.en.kpi.cost') + ' [€]', +f.sum.cost.toFixed(2)]);
        app.csv(rows, `${app.slug()}-${t('lbk.en.csvName')}.csv`);
    }
    function chartSVG() {
        const el = $('#en-chart svg');
        return el ? '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(el) : null;
    }
    function exportSVG() {
        const s = chartSVG();
        if (s) app.download(new Blob([s], { type: 'image/svg+xml' }), `${app.slug()}-${t('lbk.en.csvName')}.svg`);
    }
    function exportPNG() {
        const s = chartSVG(), el = $('#en-chart svg');
        if (!s) return;
        const vb = el.viewBox.baseVal, img = new Image();
        const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = vb.width * 2; c.height = vb.height * 2;
            const ctx = c.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            c.toBlob((b) => (b ? app.download(b, `${app.slug()}-${t('lbk.en.csvName')}.png`) : app.toast(t('toast.exportFail'), true)), 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); app.toast(t('toast.exportFail'), true); };
        img.src = url;
    }

    // =====================================================================
    // Gebeurtenissen
    // =====================================================================
    function bindEvents() {
        const side = $('#energy-sidebar'), content = $('#energy-content');
        const goto = (e) => { const g = e.target.closest('[data-goto]'); if (g) { app.setView(g.dataset.goto); return true; } return false; };
        side.addEventListener('click', (e) => {
            if (goto(e)) return;
            const chip = e.target.closest('[data-unit]');
            if (chip && chip.dataset.unit !== lbk().active) { app.change((pj) => { pj.lbk.active = chip.dataset.unit; }); return; }
            const sg = e.target.closest('[data-seg] button[data-val]');
            if (sg) {
                const path = sg.parentNode.dataset.seg;
                if (getPath(path) !== sg.dataset.val) app.change((pj) => setPath(pj, path, sg.dataset.val));
            }
        });
        side.addEventListener('input', (e) => {
            const el = e.target, path = el.dataset.path;
            if (!path || el.dataset.kind !== 'num') return;
            const v = app.parseNum(el.value);
            el.classList.toggle('invalid', !isFinite(v));
            if (isFinite(v)) app.change((pj) => setPath(pj, path, v), true);
        });
        side.addEventListener('change', (e) => {
            const el = e.target, path = el.dataset.path;
            if (!path) return;
            if (el.dataset.kind === 'select') app.change((pj) => { setPath(pj, path, el.value); normalizeAll(pj); });
            else { el.classList.remove('invalid'); app.change((pj) => normalizeAll(pj)); }
        });

        content.addEventListener('click', (e) => {
            if (goto(e)) return;
            const b = e.target.closest('[data-brush]');
            if (b) { S.brush = +b.dataset.brush; renderGrid(); return; }
            const pr = e.target.closest('[data-preset]');
            if (pr) { preset(pr.dataset.preset); return; }
            const dh = e.target.closest('[data-day]');
            if (dh) { paint(Array.from({ length: 24 }, (_, h) => [+dh.dataset.day, h]), S.brush, false); return; }
            const hh = e.target.closest('[data-hour]');
            if (hh) { paint(Array.from({ length: 7 }, (_, d) => [d, +hh.dataset.hour]), S.brush, false); return; }
            const cm = e.target.closest('[data-cmode]');
            if (cm) { S.chartMode = cm.dataset.cmode; renderChart(); return; }
            const tb = e.target.closest('[data-etab]');
            if (tb) { S.tab = tb.dataset.etab; renderPane(); return; }
            if (e.target.closest('#en-compare-run')) { runCompare(); return; }
            if (e.target.closest('#en-csv')) exportCSV();
        });
        content.addEventListener('input', (e) => {
            if (e.target.id !== 'en-brush-custom') return;
            const v = app.parseNum(e.target.value);
            const ok = v >= 0 && v <= 100;
            e.target.classList.toggle('invalid', !ok && e.target.value.trim() !== '');
            if (ok) { S.brush = Math.round(v); $$('#en-brush [data-brush]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.brush === S.brush))); }
        });
        content.addEventListener('keydown', (e) => {
            const cell = e.target.closest('#en-grid .cell');
            if (cell && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); paint([[+cell.dataset.d, +cell.dataset.h]], S.brush, false); }
        });
        // Schilderen: klikken of slepen over de uurblokken
        const grid = () => $('#en-grid');
        content.addEventListener('pointerdown', (e) => {
            const cell = e.target.closest('#en-grid .cell');
            if (!cell || e.button > 0) return;
            e.preventDefault();
            S.painting = true;
            grid().setPointerCapture(e.pointerId);
            paint([[+cell.dataset.d, +cell.dataset.h]], S.brush, true);
        });
        content.addEventListener('pointermove', (e) => {
            if (S.painting) {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const cell = el && el.closest && el.closest('#en-grid .cell');
                if (cell) paint([[+cell.dataset.d, +cell.dataset.h]], S.brush, true);
                return;
            }
            const hit = e.target.closest && e.target.closest('.bar-hit');
            if (hit) showTip(+hit.dataset.m, e);
            else if ($('#en-tip')) $('#en-tip').hidden = true;
        });
        const stop = () => { if (!S.painting) return; S.painting = false; app.commit(); };
        content.addEventListener('pointerup', stop);
        content.addEventListener('pointercancel', stop);
        content.addEventListener('pointerleave', () => { if ($('#en-tip')) $('#en-tip').hidden = true; });
    }

    // =====================================================================
    // Koppeling met app.js
    // =====================================================================
    function sync() {
        if (!app) return;
        if (!S.visible) { S.built = false; return; }
        if (S.builtLang !== app.lang) buildContent();
        const u = unit();
        $('#en-locked').hidden = !!u;
        $('#energy-main').hidden = !u;
        if (!u) {
            $('#en-locked').innerHTML = `<div class="lbk-empty-in"><svg class="lbk-empty-ico"><use href="#k-ahu"/></svg><h2>${esc(t('view.energy'))}</h2><p>${esc(t('lbk.en.locked'))}</p>`
                + `<button type="button" class="btn primary" data-goto="lbk">${esc(t('lbk.en.lockedBtn'))}</button></div>`;
        }
        if (!S.built || structKey() !== S.structKey) buildSidebar(); else updateValues();
        if (!u) return;
        renderGrid();
        if (S.result && S.resultKey === resultKey()) renderResults();
        else schedule();
    }
    function show(on) {
        S.visible = on;
        if (on) { S.built = false; sync(); }
    }
    function renderAll() { if (S.visible) { buildContent(); S.built = false; S.resultKey = null; sync(); } else S.built = false; }
    function restyle() { if (S.visible && S.result) { renderGrid(); renderResults(); } }

    function init(api) {
        app = api;
        buildContent();
        bindEvents();
    }

    root.LbkEnergy = { init, sync, show, renderAll, restyle, exportCSV, exportPNG, exportSVG, get state() { return S; } };
})(typeof self !== 'undefined' ? self : this);
