/**
 * view.js — weergave "LBK samenstellen": LBK's beheren, stap voor stap componenten toevoegen,
 * eisen en ontwerpcondities, met schema, Mollier-diagram, adviezen en tabellen.
 *
 * Toestand staat in project.lbk (app.js) en wijzigt alleen via MollierApp.change(), zodat ongedaan
 * maken, automatisch opslaan, deellinks en JSON-export de LBK's meenemen. De zijbalk wordt alleen
 * opnieuw opgebouwd bij een structurele wijziging (andere LBK, component erbij/eraf, uitvoering);
 * bij typen worden alleen waarden en resultaten bijgewerkt, zodat de focus blijft staan.
 */
(function (root) {
    'use strict';

    const E = root.LbkEngine, P = root.Psychro, PR = root.Processes, SCH = root.LbkSchematic;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const G = 1000;
    const ICON = { filter: 'k-filter', hr: 'c-hr', mix: 'c-mix', heater: 'c-heat', cooler: 'c-cool', humid: 'c-humidify', fan: 'k-fan', silencer: 'k-silencer' };
    const SYMBOLS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
        + '<symbol id="k-filter" viewBox="0 0 24 24"><path d="M9 3l6 2.5-6 2.5 6 2.5-6 2.5 6 2.5-6 2.5 6 2.5"/></symbol>'
        + '<symbol id="k-fan" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 12c-.5-3.5.8-5.6 3.8-5.8M12 12c3.2 1.3 4.3 3.5 2.6 6M12 12c-2.7 2.2-5.1 2.2-6.4-.4"/></symbol>'
        + '<symbol id="k-silencer" viewBox="0 0 24 24"><rect x="5" y="4" width="3" height="16" rx="1.5"/><rect x="10.5" y="4" width="3" height="16" rx="1.5"/><rect x="16" y="4" width="3" height="16" rx="1.5"/></symbol>'
        + '<symbol id="k-ahu" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 12h19M8 6v12M14 6v12"/></symbol>'
        + '</defs></svg>';

    let app = null;
    const S = {
        visible: false, built: false, structKey: null, expanded: null, cond: 'win', tab: 'states',
        chart: null, dp: null, plan: null, numbers: {}, hover: null, chartKey: null, rangeKey: null
    };

    // ---- Hulpjes ----
    const t = (k, v) => app.t(k, v);
    const fmt = (v, d) => app.fmt(v, d);
    const fmtA = (v, d) => app.fmtA(v, d);
    const esc = (s) => app.esc(s);
    const signed = (v, d) => (isFinite(v) ? (v > 1e-9 ? '+' : '') + fmt(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v, d) : '—');
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const state = () => app.getProject().lbk;
    const unit = () => { const s = state(); return s.units.find((u) => u.id === s.active) || null; };
    const p = () => app.pressure();
    const full = (s) => { try { return P.state(s.t, s.x, p()); } catch (e) { return null; } };
    const condColor = (k) => { const pal = app.palette(); return k === 'win' ? pal[4] : pal[0]; };

    /** Naam van een component zoals in lijst, schema en tabel. */
    function compName(c, side, u) {
        if (c.label) return c.label;
        switch (c.type) {
            case 'hr': return t('lbk.name.hr.' + c.kind);
            case 'heater': {
                if (c.role === 'pre') return t('lbk.name.heater.pre');
                const i = u ? u.comps.indexOf(c) : -1;
                return t(i > 0 && u.comps.slice(0, i).some((d) => d.type === 'cooler' && d.on !== false) ? 'lbk.name.heater.reheat' : 'lbk.name.heater.main');
            }
            case 'humid': return t('lbk.name.humid.' + c.kind);
            case 'fan': return t('lbk.name.fan.' + side);
            case 'mix': return t('lbk.name.mix.' + c.ctrl);
            case 'cooler': return t('lbk.comp.cooler');
            default: return t(`lbk.name.${c.type}.${side}`);
        }
    }
    /** Korte naam voor het schema. */
    function shortName(c, side, u) {
        if (c.type === 'heater') return compName(c, side, u);
        if (c.type === 'hr') return t('lbk.comp.hr');
        if (c.type === 'fan' && side === 'ret') return t('lbk.name.fan.ret').replace('ventilator', 'vent.');
        return t('lbk.comp.' + c.type);
    }
    function numbering(u) {
        const map = {};
        let n = 1;
        for (const c of u.comps) if (c.on !== false) map[c.id] = ++n;
        return map;
    }

    // =====================================================================
    // Zijbalk
    // =====================================================================
    function structKey() {
        const s = state(), u = unit();
        const comp = (c) => [c.id, c.type, c.on, c.kind, c.role, c.ctrl, c.iec, c.pos, c.label || ''];
        return JSON.stringify({
            lang: app.lang, active: s.active, units: s.units.map((x) => [x.id, x.color]), expanded: S.expanded,
            u: u ? { mode: u.mode, sm: u.sup.mode, mi: u.sup.xMinOn, ma: u.sup.xMaxOn, c: u.comps.map(comp), r: u.retComps.map(comp) } : null
        });
    }

    function tipAttr(key) {
        const k = 'lbk.tip.' + key, v = t(k);
        return v === k ? '' : ` title="${esc(v)}"`;
    }
    function numField(path, label, unitTxt, value, opts = {}) {
        return `<label class="fld${opts.full ? ' full' : ''}"${opts.tip || ''}><span class="fld-lbl">${esc(label)}</span><span class="input-unit">`
            + `<input class="input" data-path="${path}" data-kind="num" inputmode="decimal" autocomplete="off" value="${esc(isFinite(value) ? fmtA(value, opts.dec != null ? opts.dec : 3) : '')}"${opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : ''}>`
            + `<em>${esc(unitTxt === '–' ? '' : unitTxt || '')}</em></span>${opts.hint ? `<span class="fld-hint" ${opts.hintId ? `id="${opts.hintId}"` : ''}>${esc(opts.hint)}</span>` : ''}</label>`;
    }
    function selField(path, label, options, value, labelOf, opts = {}) {
        return `<label class="fld full"${opts.tip || ''}><span class="fld-lbl">${esc(label)}</span><select class="input" data-path="${path}" data-kind="select">`
            + options.map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${esc(labelOf(o))}</option>`).join('') + '</select></label>';
    }
    function boolField(path, label, value, opts = {}) {
        return `<label class="fld full chk"${opts.tip || ''}><input type="checkbox" data-path="${path}" data-kind="bool"${value ? ' checked' : ''}><span>${esc(label)}</span></label>`;
    }
    function seg(path, options, value, labelOf) {
        return `<div class="seg lbk-seg" role="tablist" data-seg="${path}">`
            + options.map((o) => `<button type="button" role="tab" data-val="${o}" aria-selected="${o === value}">${esc(labelOf(o))}</button>`).join('') + '</div>';
    }

    function compFieldsHTML(c, u, side) {
        const pre = side === 'sup' ? 'c' : 'r';
        return E.fieldsOf(c, u, side).map((f) => {
            const path = `${pre}.${c.id}.${f.key}`;
            let label = t('lbk.fc.' + f.key);
            if (f.key === 'share' && c.ctrl === 'econ') label = t('lbk.fc.shareMax');
            if (f.key === 'eta' && c.type === 'humid') label = t('lbk.fc.etaAdia');
            if (f.type === 'select') return selField(path, label, f.options, c[f.key], (o) => t(`lbk.o2.${f.key}.${o}`), { tip: tipAttr(f.key) });
            if (f.type === 'bool') return boolField(path, label, c[f.key], { tip: tipAttr(f.key) });
            const free = f.key === 'qMax' || f.key === 'cap';
            return numField(path, label, f.unit, c[f.key], { tip: tipAttr(f.key), dec: f.dec, placeholder: free ? '0' : '', hint: free ? t('lbk.zeroIsFree') : '' });
        }).join('');
    }

    function compItem(c, i, list, u, side) {
        const open = S.expanded === c.id, on = c.on !== false;
        const nr = side === 'sup' ? (on ? S.numbers[c.id] || '' : '–') : '';
        return `<li class="lbk-comp${open ? ' open' : ''}${on ? '' : ' off'}" data-id="${esc(c.id)}" data-side="${side}" style="--c:var(--lbk-${c.type})">`
            + `<div class="lbk-comp-head" tabindex="0" role="button" aria-expanded="${open}">`
            + (side === 'sup' ? `<span class="lbk-nr" title="${esc(t('lbk.col.point'))}">${nr}</span>` : '')
            + `<svg class="lbk-ico"><use href="#${ICON[c.type]}"/></svg>`
            + `<div class="lbk-comp-main"><div class="lbk-comp-title">${esc(compName(c, side, u))}</div><div class="lbk-comp-sub" id="lbk-sub-${esc(c.id)}"></div></div>`
            + `<div class="step-actions">`
            + `<button type="button" data-act="up" title="${esc(t('lbk.act.up'))}"${i === 0 ? ' disabled' : ''}><svg><use href="#i-up"/></svg></button>`
            + `<button type="button" data-act="down" title="${esc(t('lbk.act.down'))}"${i === list.length - 1 ? ' disabled' : ''}><svg><use href="#i-down"/></svg></button>`
            + `<button type="button" data-act="toggle" title="${esc(t('lbk.act.toggle'))}"><svg><use href="#i-power"/></svg></button>`
            + `<button type="button" data-act="dup" title="${esc(t('lbk.act.dup'))}"><svg><use href="#i-copy"/></svg></button>`
            + `<button type="button" data-act="del" class="del" title="${esc(t('lbk.act.del'))}"><svg><use href="#i-x"/></svg></button>`
            + `</div></div>`
            + (open ? `<div class="lbk-comp-body"><p class="hint">${esc(t('lbk.hint.' + c.type))}</p><div class="fields">${compFieldsHTML(c, u, side)}</div></div>` : '')
            + '</li>';
    }

    function palette(side, u) {
        const types = side === 'sup' ? E.SUP_TYPES : E.RET_TYPES;
        return `<div class="lbk-palette" data-side="${side}">` + types.map((ty) => {
            const taken = E.TYPES[ty].single && u.comps.some((c) => c.type === ty);
            const lbl = side === 'ret' && ty === 'fan' ? t('lbk.name.fan.ret') : t('lbk.comp.' + ty);
            return `<button type="button" class="cat-btn lbk-add-btn" data-add="${ty}" data-side="${side}"${taken ? ' disabled' : ''} title="${esc(lbl)}">`
                + `<svg><use href="#${ICON[ty]}"/></svg>${esc(lbl)}</button>`;
        }).join('') + '</div>';
    }

    function unitsPanel(u) {
        const s = state(), pal = app.palette();
        const chips = s.units.map((x) => `<button type="button" role="tab" class="scn-tab" data-unit="${esc(x.id)}" aria-selected="${x.id === s.active}" style="--c:${pal[x.color % 6]}"><i class="dot"></i><span class="lbk-unit-name">${esc(x.name)}</span></button>`).join('');
        return `<section class="panel lbk-units"><div class="panel-head"><h2>${esc(t('lbk.panel.units'))}</h2>`
            + `<div class="menu lbk-add-menu" id="lbk-add-menu"><button type="button" class="chip-btn" id="lbk-add" aria-haspopup="true" aria-expanded="false"><svg><use href="#i-plus"/></svg><span>${esc(t('lbk.unit.add'))}</span></button>`
            + `<div class="menu-pop" role="menu"><button type="button" data-new="existing">${esc(t('lbk.unit.addExisting'))}</button><button type="button" data-new="design">${esc(t('lbk.unit.addDesign'))}</button></div></div></div>`
            + `<div class="scn-tabs" role="tablist">${chips}</div>`
            + (u ? `<div class="scn-edit"><input class="input" id="lbk-name" data-path="u.name" data-kind="text" maxlength="40" spellcheck="false" aria-label="${esc(t('lbk.unit.name'))}" value="${esc(u.name)}">`
                + `<div class="swatches" aria-label="${esc(t('lbk.unit.color'))}">${pal.map((c, i) => `<button type="button" class="swatch" data-color="${i}" style="--c:${c}" aria-pressed="${i === u.color}" aria-label="${i + 1}"></button>`).join('')}</div>`
                + `<button type="button" class="icon-btn sm" data-unit-act="dup" title="${esc(t('lbk.unit.dup'))}"><svg><use href="#i-copy"/></svg></button>`
                + `<button type="button" class="icon-btn sm danger" data-unit-act="del" title="${esc(t('lbk.unit.del'))}"><svg><use href="#i-x"/></svg></button></div>`
                + seg('u.mode', ['existing', 'design'], u.mode, (o) => t('lbk.mode.' + o))
                + `<p class="hint">${esc(t(u.mode === 'design' ? 'lbk.mode.hintDesign' : 'lbk.mode.hintExisting'))}</p>` : '')
            + '</section>';
    }

    function buildSidebar() {
        const side = $('#lbk-sidebar'), u = unit();
        S.numbers = u ? numbering(u) : {};
        if (!u) {
            side.innerHTML = unitsPanel(null) + `<section class="panel"><p class="hint">${esc(t('lbk.empty.text'))}</p>`
                + `<div class="lbk-start-btns">${startButtons()}</div></section>`;
        } else {
            const s = u.sup;
            const flow = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.panel.flow'))}</h2></div><div class="grid2">`
                + numField('u.flow', t('lbk.f.flow'), 'm³/h', u.flow) + numField('u.retFlow', t('lbk.f.retFlow'), '%', u.retFlow)
                + `</div><p class="hint" id="lbk-flow-hint"></p></section>`;
            const temp = s.mode === 'const'
                ? `<div class="grid2">${numField('u.sup.t', t('lbk.f.t'), '°C', s.t)}</div>`
                : `<div class="grid2">${numField('u.sup.tWin', t('lbk.f.tWin'), '°C', s.tWin)}${numField('u.sup.tSum', t('lbk.f.tSum'), '°C', s.tSum)}`
                    + `${numField('u.sup.tOutWin', t('lbk.f.tOutWin'), '°C', s.tOutWin)}${numField('u.sup.tOutSum', t('lbk.f.tOutSum'), '°C', s.tOutSum)}</div>`
                    + `<p class="hint">${esc(t('lbk.compHint'))}</p>`;
            const hum = (key, onKey, label) => `<div class="lbk-hum">${boolField('u.sup.' + onKey, label, s[onKey])}`
                + (s[onKey] ? `<div class="grid2">${numField('u.sup.' + key, t('lbk.f.' + key), 'g/kg', s[key], { hintId: 'lbk-rh-' + key, hint: ' ' })}</div>` : '') + '</div>';
            const req = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.panel.req'))}</h2></div>`
                + `<div class="fld full"><span class="fld-lbl">${esc(t('lbk.f.supMode'))}</span>${seg('u.sup.mode', ['const', 'comp'], s.mode, (o) => t('lbk.o.supMode.' + o))}</div>`
                + temp + hum('xMin', 'xMinOn', t('lbk.f.xMinOn')) + hum('xMax', 'xMaxOn', t('lbk.f.xMaxOn'))
                + `<div class="lbk-sub-head">${esc(t('lbk.retHead'))}</div><div class="grid2 lbk-grid3">`
                + numField('u.ret.tWin', t('lbk.f.retTWin'), '°C', u.ret.tWin) + numField('u.ret.tSum', t('lbk.f.retTSum'), '°C', u.ret.tSum)
                + numField('u.ret.dx', t('lbk.f.dx'), 'g/kg', u.ret.dx) + `</div><p class="hint">${esc(t('lbk.retHint'))}</p></section>`;
            const comps = `<section class="panel lbk-comps-panel"><div class="panel-head"><h2>${esc(t('lbk.panel.comps'))}</h2><span class="count">${u.comps.length || ''}</span></div>`
                + `<div class="lbk-io"><span class="lbk-nr io">1</span>${esc(t('lbk.schema.out'))}</div>`
                + (u.comps.length ? `<ol class="lbk-comps">${u.comps.map((c, i) => compItem(c, i, u.comps, u, 'sup')).join('')}</ol>` : `<p class="step-empty">${esc(t('lbk.compsEmpty'))}</p>`)
                + `<div class="lbk-io end">${esc(t('lbk.schema.sup'))}</div>`
                + `<div class="lbk-add"><span class="fld-lbl">${esc(t('lbk.add'))}</span>${palette('sup', u)}</div>`
                + (u.mode === 'design' ? `<button type="button" class="btn lbk-propose" id="lbk-propose">${esc(t('lbk.propose'))}</button>` : '')
                + '</section>';
            const ret = `<section class="panel lbk-comps-panel"><div class="panel-head"><h2>${esc(t('lbk.panel.ret'))}</h2></div>`
                + (u.retComps.length ? `<ol class="lbk-comps">${u.retComps.map((c, i) => compItem(c, i, u.retComps, u, 'ret')).join('')}</ol>` : `<p class="step-empty">${esc(t('lbk.retEmpty'))}</p>`)
                + `<div class="lbk-add"><span class="fld-lbl">${esc(t('lbk.addRet'))}</span>${palette('ret', u)}</div></section>`;
            const dc = (k) => `<div class="lbk-sub-head"><i class="lbk-cond-dot" style="background:${condColor(k)}"></i>${esc(t('lbk.cond.' + k))}</div><div class="grid2">`
                + numField(`u.design.${k}.t`, t('lbk.f.dT'), '°C', u.design[k].t) + numField(`u.design.${k}.rh`, t('lbk.f.dRh'), '%', u.design[k].rh) + '</div>';
            const design = `<section class="panel"><div class="panel-head"><h2>${esc(t('lbk.panel.design'))}</h2></div>${dc('win')}${dc('sum')}<p class="hint">${esc(t('lbk.designHint'))}</p></section>`;
            side.innerHTML = unitsPanel(u) + flow + req + comps + ret + design;
        }
        S.structKey = structKey();
        S.built = true;
        updateValues();
    }

    function startButtons() {
        return `<button type="button" class="lbk-start" data-new="existing"><svg><use href="#k-ahu"/></svg><b>${esc(t('lbk.empty.existing'))}</b><span>${esc(t('lbk.empty.existingSub'))}</span></button>`
            + `<button type="button" class="lbk-start" data-new="design"><svg><use href="#c-heat"/></svg><b>${esc(t('lbk.empty.design'))}</b><span>${esc(t('lbk.empty.designSub'))}</span></button>`
            + `<button type="button" class="btn lbk-example" data-new="example">${esc(t('lbk.empty.example'))}</button>`;
    }

    const setVal = (el, v) => { if (document.activeElement !== el) el.value = v; };

    /** Waarden en resultaatregels bijwerken zonder de zijbalk opnieuw op te bouwen. */
    function updateValues() {
        const u = unit();
        if (!u) return;
        $$('.lbk-unit-name', $('#lbk-sidebar')).forEach((el) => {
            const x = state().units.find((q) => q.id === el.parentNode.dataset.unit);
            if (x) el.textContent = x.name;
        });
        $$('#lbk-sidebar [data-path]').forEach((el) => {
            const v = getPath(u, el.dataset.path);
            if (el.dataset.kind === 'num') setVal(el, isFinite(v) ? fmtA(v, 3) : '');
            else if (el.dataset.kind === 'text') setVal(el, v);
            else if (el.dataset.kind === 'bool') el.checked = !!v;
            else if (el.dataset.kind === 'select' && document.activeElement !== el) el.value = v;
        });
        const m = u.flow / 3600 * E.RHO_REF;
        const fh = $('#lbk-flow-hint');
        if (fh) fh.textContent = t('lbk.flowHint', { m: fmt(m, 3), r: fmt(u.flow * u.retFlow / 100, 0) });
        const rhAt = (x, tt) => { try { return P.state(tt, x / G, p()).rh; } catch (e) { return NaN; } };
        const hx = $('#lbk-rh-xMin');
        if (hx) hx.textContent = t('lbk.rhHint', { rh: fmt(rhAt(u.sup.xMin, u.ret.tWin), 0), t: fmt(u.ret.tWin, 0) });
        const hy = $('#lbk-rh-xMax');
        if (hy) hy.textContent = t('lbk.rhHint', { rh: fmt(rhAt(u.sup.xMax, u.ret.tSum), 0), t: fmt(u.ret.tSum, 0) });
        // Resultaatregel per component
        const dp = S.dp;
        for (const [list, side] of [[u.comps, 'sup'], [u.retComps, 'ret']]) {
            for (const c of list) {
                const el = document.getElementById('lbk-sub-' + c.id);
                if (el) el.innerHTML = compSub(c, side, dp);
            }
        }
    }

    /** Korte samenvatting van een component: belangrijkste parameter + vermogen winter/zomer. */
    function compSub(c, side, dp) {
        const parts = [];
        switch (c.type) {
            case 'hr': parts.push(`η ${fmtA(c.eta, 0)} %`); if (c.etaX > 0 && (c.kind === 'wheel' || c.kind === 'sorption')) parts.push(`η_x ${fmtA(c.etaX, 0)} %`); break;
            case 'mix': parts.push(`${fmtA(c.share, 0)} %`); break;
            case 'heater': if (c.role === 'pre') parts.push(`${fmtA(c.tSet, 1)} °C`); if (unit().mode === 'existing' && c.qMax > 0) parts.push(`≤ ${fmtA(c.qMax, 1)} kW`); break;
            case 'cooler': parts.push(`BF ${fmtA(c.bf, 2)}`); if (unit().mode === 'existing' && c.qMax > 0) parts.push(`≤ ${fmtA(c.qMax, 1)} kW`); break;
            case 'humid': if (c.kind === 'adiabatic') parts.push(`η ${fmtA(c.eta, 0)} %`); if (unit().mode === 'existing' && c.cap > 0) parts.push(`≤ ${fmtA(c.cap, 0)} kg/h`); break;
            case 'fan': parts.push(`${fmtA(c.dpExt, 0)} Pa ext. · η ${fmtA(c.eta, 0)} %`); break;
            default: break;
        }
        if (c.type !== 'fan' && c.dp > 0) parts.push(`Δp ${fmtA(c.dp, 0)} Pa`);
        if (dp && c.on !== false && side === 'sup') {
            const v = (k) => compValue(c, dp[k].comps[c.id]);
            const w = v('win'), z = v('sum');
            if (w || z) parts.push(`<b class="lbk-wz"><i style="background:${condColor('win')}"></i>${w || '—'} <i style="background:${condColor('sum')}"></i>${z || '—'}</b>`);
        }
        if (dp && c.on !== false && side === 'ret' && c.type === 'fan') {
            const P0 = dp.plan.fanDes[c.id];
            if (P0) parts.push(`${fmt(P0.P, 2)} kW`);
        }
        return parts.map((x) => (x.startsWith('<b') ? x : esc(x))).join(' · ');
    }

    /** Waarde van een component in een resultaat (kort, met eenheid). */
    function compValue(c, cr) {
        if (!cr) return '';
        switch (c.type) {
            case 'heater': case 'cooler': case 'hr': return Math.abs(cr.q) > 0.005 ? `${signed(cr.q, 1)} kW` : '';
            case 'humid': return cr.water > 0.005 ? `+${fmt(cr.water, 1)} kg/h` : '';
            case 'fan': return `${fmt(cr.elec, 2)} kW`;
            case 'mix': return cr.share > 0 ? `${fmt(cr.share * 100, 0)} %` : '';
            default: return '';
        }
    }

    function getPath(u, path) {
        const parts = path.split('.');
        if (parts[0] === 'u') { let o = u; for (const k of parts.slice(1)) o = o == null ? undefined : o[k]; return o; }
        const list = parts[0] === 'c' ? u.comps : u.retComps;
        const c = list.find((x) => x.id === parts[1]);
        return c ? c[parts[2]] : undefined;
    }
    function setPath(pj, path, value) {
        const u = pj.lbk.units.find((x) => x.id === pj.lbk.active);
        if (!u) return;
        const parts = path.split('.');
        if (parts[0] === 'u') {
            let o = u;
            for (const k of parts.slice(1, -1)) o = o[k];
            o[parts[parts.length - 1]] = value;
            return;
        }
        const list = parts[0] === 'c' ? u.comps : u.retComps;
        const c = list.find((x) => x.id === parts[1]);
        if (!c) return;
        if (parts[2] === 'kind') E.setKind(c, value); else c[parts[2]] = value;
    }
    /** Na een afgeronde invoer: begrenzen en aanvullen (ids blijven gelijk). */
    function normalizeActive(pj) {
        const i = pj.lbk.units.findIndex((x) => x.id === pj.lbk.active);
        if (i >= 0) pj.lbk.units[i] = E.normalizeUnit(pj.lbk.units[i], i);
    }

    // ---- Acties ----
    function newUnit(kind) {
        const s = state();
        if (s.units.length >= E.MAX_UNITS) { app.toast(t('lbk.unit.max', { n: E.MAX_UNITS }), true); return; }
        const used = new Set(s.units.map((u) => u.color));
        const color = [2, 4, 0, 3, 1, 5].find((c) => !used.has(c)) ?? s.units.length % 6;
        let u;
        if (kind === 'example') u = E.exampleUnit(t('example.lbk'), color);
        else u = E.defaultUnit(kind, t('lbk.unit.newName', { n: s.units.length + 1 }), color);
        S.expanded = null;
        app.change((pj) => { pj.lbk.units.push(u); pj.lbk.active = u.id; });
    }
    function unitAction(act) {
        const u = unit();
        if (!u) return;
        if (act === 'dup') {
            const s = state();
            if (s.units.length >= E.MAX_UNITS) { app.toast(t('lbk.unit.max', { n: E.MAX_UNITS }), true); return; }
            const copy = clone(u);
            copy.id = E.uid();
            copy.name = t('lbk.unit.copy', { name: u.name }).slice(0, 40);
            const used = new Set(s.units.map((x) => x.color));
            copy.color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? u.color;
            for (const c of copy.comps.concat(copy.retComps)) c.id = E.uid();
            app.change((pj) => { pj.lbk.units.push(copy); pj.lbk.active = copy.id; });
        } else if (act === 'del') {
            if (!confirm(t('lbk.unit.confirmDel', { name: u.name }))) return;
            app.change((pj) => {
                pj.lbk.units = pj.lbk.units.filter((x) => x.id !== u.id);
                pj.lbk.active = pj.lbk.units[0] ? pj.lbk.units[0].id : null;
            });
        }
    }
    function addComp(type, side) {
        const u = unit();
        if (!u) return;
        const list = side === 'sup' ? u.comps : u.retComps;
        if (list.length >= (side === 'sup' ? E.MAX_COMPS : E.MAX_RET)) { app.toast(t('lbk.maxComps', { n: side === 'sup' ? E.MAX_COMPS : E.MAX_RET }), true); return; }
        if (E.TYPES[type].single && list.some((c) => c.type === type)) { app.toast(t('lbk.single', { name: t('lbk.comp.' + type) }), true); return; }
        const c = E.makeComp(type, {}, side);
        if (type === 'heater' && side === 'sup' && list.some((d) => d.type === 'heater' && d.role === 'main')) c.role = 'pre';
        S.expanded = c.id;
        app.change((pj) => {
            const uu = pj.lbk.units.find((x) => x.id === pj.lbk.active);
            const l = side === 'sup' ? uu.comps : uu.retComps;
            l.splice(insertAt(l, type, side), 0, c);
        });
    }
    /**
     * Logische plek voor een nieuw component (de gebruiker kan daarna verschuiven):
     * filter en WTW vooraan, mengkamer direct na de WTW, batterijen en bevochtiger vóór de ventilator(en)/demper(s)
     * aan het eind, ventilator en demper achteraan.
     */
    function insertAt(l, type, side) {
        if (side !== 'sup' || type === 'fan' || type === 'silencer') return l.length;
        let lead = 0;
        while (lead < l.length && l[lead].type === 'filter') lead++;
        if (type === 'filter' || type === 'hr') return lead;
        if (type === 'mix') { const h = l.findIndex((c) => c.type === 'hr'); return h >= 0 ? h + 1 : lead; }
        let at = l.length;
        while (at > 0 && (l[at - 1].type === 'fan' || l[at - 1].type === 'silencer')) at--;
        return at;
    }

    function compAction(id, side, act) {
        const u = unit();
        const list = side === 'sup' ? u.comps : u.retComps;
        const c = list.find((x) => x.id === id);
        if (!c) return;
        if (act === 'dup' && E.TYPES[c.type].single) { app.toast(t('lbk.single', { name: t('lbk.comp.' + c.type) }), true); return; }
        if (act === 'dup' && list.length >= (side === 'sup' ? E.MAX_COMPS : E.MAX_RET)) return;
        app.change((pj) => {
            const uu = pj.lbk.units.find((x) => x.id === pj.lbk.active);
            const l = side === 'sup' ? uu.comps : uu.retComps;
            const i = l.findIndex((x) => x.id === id);
            if (i < 0) return;
            if (act === 'up' && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
            if (act === 'down' && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
            if (act === 'toggle') l[i].on = !l[i].on;
            if (act === 'dup') l.splice(i + 1, 0, Object.assign(clone(l[i]), { id: E.uid() }));
            if (act === 'del') l.splice(i, 1);
        });
        if (act === 'del' && S.expanded === id) S.expanded = null;
    }
    function propose() {
        const u = unit();
        if (!u) return;
        if (u.comps.length && !confirm(t('lbk.proposeConfirm'))) return;
        const pr = E.propose(u);
        app.change((pj) => {
            const uu = pj.lbk.units.find((x) => x.id === pj.lbk.active);
            uu.comps = pr.comps;
            uu.retComps = pr.retComps;
        });
        app.toast(t('lbk.proposed'));
    }
    /** Benodigde vermogens (+10 %) vastleggen als capaciteit en doorrekenen als bestaande LBK. */
    function fixCapacities() {
        const u = unit(), dp = S.dp;
        if (!u || !dp) return;
        const need = (c) => {
            const a = dp.win.comps[c.id], b = dp.sum.comps[c.id];
            if (c.type === 'humid') return Math.max(a ? a.water : 0, b ? b.water : 0);
            return Math.max(a ? Math.abs(a.q) : 0, b ? Math.abs(b.q) : 0);
        };
        app.change((pj) => {
            const uu = pj.lbk.units.find((x) => x.id === pj.lbk.active);
            for (const c of uu.comps) {
                if (c.type === 'heater' || c.type === 'cooler') c.qMax = Math.max(1, Math.ceil(need(c) * 1.1));
                if (c.type === 'humid') c.cap = Math.max(1, Math.ceil(need(c) * 1.1));
            }
            uu.mode = 'existing';
        });
        app.toast(t('lbk.fixed'));
    }

    // =====================================================================
    // Inhoud
    // =====================================================================
    function buildContent() {
        $('#lbk-content').innerHTML = `
            <div class="lbk-empty card" id="lbk-empty" hidden></div>
            <div id="lbk-main">
                <div class="kpis lbk-kpis" id="lbk-kpis"></div>
                <div class="card lbk-warn" id="lbk-warn"></div>
                <div class="card lbk-schema-card">
                    <div class="chart-head"><div class="chart-title">${esc(t('lbk.schema.title'))}</div>
                        <div class="chart-tools"><div class="seg" id="lbk-cond" role="tablist">
                            <button type="button" role="tab" data-cond="win"><i class="lbk-cond-dot" id="lbk-dot-win"></i>${esc(t('lbk.cond.win'))}</button>
                            <button type="button" role="tab" data-cond="sum"><i class="lbk-cond-dot" id="lbk-dot-sum"></i>${esc(t('lbk.cond.sum'))}</button></div></div></div>
                    <div class="lbk-schema-wrap" id="lbk-schema"></div>
                    <p class="hint lbk-schema-hint">${esc(t('lbk.schema.hint'))}</p>
                </div>
                <div class="card chart-card lbk-chart-card">
                    <div class="chart-head"><div class="chart-title" id="lbk-chart-title"></div>
                        <div class="chart-tools">
                            <button type="button" class="tb-btn sm" id="lbk-to-proc"><svg><use href="#i-share"/></svg><span>${esc(t('lbk.chart.toProc'))}</span></button>
                            <span class="tb-sep"></span>
                            <button type="button" class="icon-btn sm" id="lbk-zoom-out" title="${esc(t('chart.zoomOut'))}"><svg><use href="#i-minus"/></svg></button>
                            <button type="button" class="icon-btn sm" id="lbk-zoom-in" title="${esc(t('chart.zoomIn'))}"><svg><use href="#i-plus"/></svg></button>
                            <button type="button" class="icon-btn sm" id="lbk-fit" title="${esc(t('chart.fit'))}"><svg><use href="#i-fit"/></svg></button>
                            <button type="button" class="icon-btn sm" id="lbk-reset" title="${esc(t('chart.reset'))}"><svg><use href="#i-full"/></svg></button>
                        </div></div>
                    <div class="chart-wrap lbk-chart-wrap"><svg id="lbk-chart"></svg></div>
                    <div class="statusbar" id="lbk-status"></div>
                </div>
                <div class="card results">
                    <div class="results-head"><div class="tabs" role="tablist">
                        <button type="button" class="tab" data-ltab="states">${esc(t('lbk.tab.states'))}</button>
                        <button type="button" class="tab" data-ltab="comps">${esc(t('lbk.tab.comps'))}</button></div>
                        <span class="results-scn" id="lbk-tbl-unit"></span>
                        <button type="button" class="tb-btn sm" id="lbk-csv"><svg><use href="#i-download"/></svg><span>${esc(t('lbk.tab.csv'))}</span></button></div>
                    <div class="table-wrap"><table class="data-table lbk-table" id="lbk-table"></table></div>
                </div>
            </div>`;
        S.chart = null;
        S.builtLang = app.lang;
    }

    function ensureChart() {
        if (S.chart || !root.MollierChart || !S.visible) return;
        S.chart = new root.MollierChart($('#lbk-chart'), {
            onHover: (info) => { S.hover = info; renderStatus(); },
            onHoverStep: (h) => highlight(h ? h.stepId : null),
            onSelect: (sel) => {
                if (sel && sel.scnId && sel.scnId !== S.cond) { S.cond = sel.scnId; renderContent(); }
                if (sel && sel.stepId) openComp(sel.stepId);
            }
        });
        S.chartKey = null;
    }

    function renderContent() {
        const u = unit();
        $('#lbk-empty').hidden = !!u;
        $('#lbk-main').hidden = !u;
        if (!u) {
            $('#lbk-empty').innerHTML = `<div class="lbk-empty-in"><svg class="lbk-empty-ico"><use href="#k-ahu"/></svg><h2>${esc(t('lbk.empty.title'))}</h2>`
                + `<p>${esc(t('lbk.empty.text'))}</p><div class="lbk-start-btns">${startButtons()}</div></div>`;
            S.dp = null;
            return;
        }
        S.numbers = numbering(u);
        S.dp = E.designPoints(u, p());
        S.plan = S.dp.plan;
        $$('#lbk-cond button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cond === S.cond)));
        $('#lbk-dot-win').style.background = condColor('win');
        $('#lbk-dot-sum').style.background = condColor('sum');
        renderKPIs(u);
        renderWarnings(u);
        renderSchema(u);
        renderChart(u);
        renderTable(u);
        updateValues();
    }

    function tile(lbl, color, val, unitTxt, sub, cls = '') {
        return `<div class="kpi ${cls}"><div class="kpi-lbl"><i class="kpi-icon" style="background:${color}"></i>${esc(lbl)}</div>`
            + `<div class="kpi-val">${val}<small>${unitTxt}</small></div><div class="kpi-sub">${sub || '&nbsp;'}</div></div>`;
    }

    function renderKPIs(u) {
        const { win, sum } = S.dp, design = u.mode === 'design';
        const capSum = (type, key) => u.comps.filter((c) => c.on !== false && c.type === type).reduce((a, c) => (a == null || !(c[key] > 0) ? null : a + c[key]), 0);
        const capTxt = (type, key, unitTxt) => {
            if (design) return esc(t('lbk.kpi.need'));
            const v = capSum(type, key);
            return v ? esc(t('lbk.kpi.cap', { v: `${fmtA(v, 1)} ${unitTxt}` })) : esc(t('lbk.zeroIsFree'));
        };
        const sm = E.summary(u, p());
        const hr = u.comps.find((c) => c.type === 'hr' && c.on !== false);
        const hrW = hr && win.comps[hr.id];
        const ok = (r) => !r.unmet.tLow && !r.unmet.tHigh && !r.unmet.xLow && !r.unmet.xHigh;
        const st = (r) => `${fmt(r.supply.t, 1)} °C · ${fmt(r.supply.x * G, 1)} g/kg`;
        const allOk = ok(win) && ok(sum);
        const heatV = Math.max(win.sums.heat, sum.sums.heat);
        $('#lbk-kpis').innerHTML = [
            tile(t('lbk.kpi.heat'), 'var(--heat)', fmt(heatV, 1), 'kW', capTxt('heater', 'qMax', 'kW') + (sum.sums.heat > 0.05 ? ' · ' + esc(t('lbk.kpi.summer', { v: fmt(sum.sums.heat, 1) + ' kW' })) : ''), heatV > 0.05 ? '' : 'zero'),
            tile(t('lbk.kpi.cool'), 'var(--cool)', fmt(sum.sums.cool, 1), 'kW', capTxt('cooler', 'qMax', 'kW') + (sum.sums.coolLat > 0.05 ? ' · ' + esc(t('lbk.kpi.lat', { v: fmt(sum.sums.coolLat, 1) })) : ''), sum.sums.cool > 0.05 ? '' : 'zero'),
            tile(t('lbk.kpi.humid'), 'var(--lbk-humid)', fmt(win.sums.humidKg, 1), 'kg/h', capTxt('humid', 'cap', 'kg/h') + (win.sums.steam > 0.05 ? ' · ' + esc(t('lbk.kpi.steam', { v: fmt(win.sums.steam, 1) })) : ''), win.sums.humidKg > 0.05 ? '' : 'zero'),
            tile(t('lbk.kpi.fans'), 'var(--lbk-fan)', fmt(sm.fanSup + sm.fanRet, 2), 'kW', sm.fanSup > 0 ? esc(t('lbk.kpi.sfp', { v: fmt(sm.sfpSup, 2), c: E.sfpClass(sm.sfpSup) })) : '', sm.fanSup + sm.fanRet > 0 ? '' : 'zero'),
            tile(t('lbk.kpi.hr'), 'var(--accent)', fmt(win.sums.recovered, 1), 'kW', hrW ? esc(t(hrW.frost ? 'lbk.kpi.hrFrost' : 'lbk.kpi.hrWin', { eta: fmt(hrW.eta, 0) })) : '', win.sums.recovered > 0.05 ? '' : 'zero'),
            `<div class="kpi kpi-final lbk-kpi-status ${allOk ? 'ok' : 'nok'}"><div class="kpi-lbl">${esc(t('lbk.kpi.supply'))}</div>`
                + `<div class="kpi-val lbk-status-val">${allOk ? '✓' : '✗'} <small>${esc(t(allOk ? 'lbk.kpi.ok' : 'lbk.kpi.nok'))}</small></div>`
                + `<div class="kpi-sub"><i class="lbk-cond-dot" style="background:${condColor('win')}"></i>${st(win)} <i class="lbk-cond-dot" style="background:${condColor('sum')}"></i>${st(sum)}</div></div>`
        ].join('');
    }

    function renderWarnings(u) {
        const list = E.check(u, S.dp);
        const name = (id) => { const c = u.comps.find((x) => x.id === id); return c ? compName(c, 'sup', u) : id; };
        const items = list.map((w) => {
            let txt;
            const cond = w.cond ? t('lbk.cond.' + w.cond) : '';
            if (w.dT != null) txt = t('lbk.w.' + w.code, { cond, v: fmt(w.dT, 1) });
            else if (w.dx != null) txt = t('lbk.w.' + w.code, { cond, v: fmt(w.dx, 2) });
            else if (w.eta != null) txt = t('lbk.w.' + w.code, { cond, v: fmt(w.eta, 0) });
            else txt = t('lbk.w.' + w.code);
            if (w.capped && w.capped.length) txt += t('lbk.w.capped', { names: w.capped.map(name).join(', ') });
            return `<li class="lbk-w ${w.level}">${esc(txt)}</li>`;
        }).join('');
        const actions = (u.mode === 'design' && u.comps.length ? `<button type="button" class="btn" id="lbk-fix" title="${esc(t('lbk.fixTitle'))}">${esc(t('lbk.fix'))}</button>` : '')
            + (u.comps.length ? `<button type="button" class="btn primary" id="lbk-to-energy">${esc(t('lbk.toEnergy'))}</button>` : '');
        $('#lbk-warn').innerHTML = `<ul class="lbk-w-list">${items}</ul>${actions ? `<div class="lbk-w-actions">${actions}</div>` : ''}`;
    }

    function stateLines(s) {
        const f = full(s);
        return f ? [`${fmt(f.t, 1)} °C`, `${fmt(f.rh, 0)} % · ${fmt(f.x * G, 1)} g/kg`] : [];
    }

    function renderSchema(u) {
        const r = S.dp[S.cond];
        $('#lbk-schema').innerHTML = SCH.render(u, r, {
            title: `${t('lbk.schema.title')} — ${u.name}`,
            names: (c, side) => shortName(c, side, u),
            tip: (c) => compName(c, 'sup', u),
            value: (c, side) => {
                if (side === 'ret') {
                    if (c.type === 'fan') { const P0 = S.plan.fanDes[c.id]; return P0 ? `${fmt(P0.P, 2)} kW` : ''; }
                    return c.dp > 0 ? `${fmtA(c.dp, 0)} Pa` : '';
                }
                const cr = r.comps[c.id];
                if (c.type === 'filter' || c.type === 'silencer') return c.dp > 0 ? `${fmtA(c.dp, 0)} Pa` : '';
                if (c.type === 'mix') return '';
                return compValue(c, cr);
            },
            state: stateLines,
            recirc: (v) => t('lbk.schema.recirc', { v: fmt(v * 100, 0) }),
            numbers: S.numbers,
            labels: { out: t('lbk.schema.out'), sup: t('lbk.schema.sup'), ret: t('lbk.schema.ret'), exh: t('lbk.schema.exh') },
            selected: S.expanded
        });
    }

    /** Resultaat van één ontwerpconditie als scenario voor MollierChart. */
    function chartScenario(u, key) {
        const r = S.dp[key], pr = p();
        const pt0 = full(r.out);
        const states = [], steps = [];
        if (!pt0) return null;
        states.push(Object.assign(pt0, { n: 1, stepId: null }));
        let prev = pt0;
        for (const c of u.comps) {
            if (c.on === false) continue;
            const q = r.points.find((x) => x.id === c.id);
            const s = q && full(q);
            if (!s) continue;
            Object.assign(s, { n: S.numbers[c.id], stepId: c.id });
            const cr = r.comps[c.id];
            const aux = [];
            if (c.type === 'cooler' && cr && cr.adp != null && !cr.dry && Math.abs(cr.q) > 0.01) {
                const a = full({ t: cr.adp, x: P.satHumRatio(cr.adp, pr) });
                if (a) aux.push({ role: 'adp', state: a, from: s });
            }
            if ((c.type === 'hr' && cr && cr.phi > 0) || (c.type === 'mix' && cr && cr.share > 0)) {
                const ra = full(c.type === 'mix' ? r.retFan : r.retFan);
                if (ra) aux.push({ role: 'return', state: ra, from: c.type === 'mix' ? s : null });
            }
            const moved = Math.abs(s.h - prev.h) > 1e-6 || Math.abs(s.x - prev.x) > 1e-9;
            steps.push({ ok: true, step: { id: c.id }, kind: c.type, path: moved ? PR.line(prev, s, pr, 6) : [prev, s], aux });
            states.push(s);
            prev = s;
        }
        const d = u.design[key];
        return {
            id: key, name: t('lbk.cond.label', { name: t('lbk.cond.' + key), t: fmtA(d.t, 1), rh: fmtA(d.rh, 0) }), index: key === 'win' ? 0 : 1,
            color: condColor(key), active: key === S.cond, visible: true, states, steps, stepTypeOf: () => 'lbk'
        };
    }

    function renderChart(u) {
        ensureChart();
        $('#lbk-chart-title').textContent = `${t('lbk.chart.title')} · ${t('chartType.' + app.chartType())} · p = ${fmt(p() / 1000, 3)} kPa`;
        if (!S.chart) return;
        const scns = ['win', 'sum'].map((k) => chartScenario(u, k)).filter(Boolean);
        let tMin = -20, tMax = 40, xMax = 20;
        for (const sc of scns) for (const s of sc.states) { tMin = Math.min(tMin, Math.floor(s.t / 5) * 5 - 5); tMax = Math.max(tMax, Math.ceil(s.t / 5) * 5 + 5); xMax = Math.max(xMax, Math.ceil(s.x * G) + 4); }
        const range = { tMin, tMax, xMax };
        const key = JSON.stringify([app.chartType(), app.skin(), app.lang, p(), range]);
        if (key !== S.chartKey) {
            S.chartKey = key;
            S.chart.configure({
                type: app.chartType(), p: p(), theme: app.skin(), range, fmt,
                layers: Object.assign({}, app.layers(), { comfort: false, values: false }), comfort: app.comfort(), labels: app.chartLabels()
            });
        }
        S.chart.setData({ scenarios: scns, selected: null, highlight: null, preview: null });
        renderStatus();
    }

    function renderStatus() {
        const sb = $('#lbk-status');
        if (!sb) return;
        const info = S.hover;
        if (!info || !info.state) { sb.innerHTML = `<span class="idle">${esc(t('lbk.chart.hover'))}</span>`; return; }
        const s = info.state;
        const item = (k, v, u) => `<span class="sb-item"><span>${k}</span><b>${v}</b> ${u}</span>`;
        const head = info.point && info.point.n ? `<span class="sb-head" style="--c:${info.point.color}"><i></i>${esc(t('chart.point', { n: info.point.n }))}</span>`
            : info.point && info.point.aux ? `<span class="sb-head" style="--c:${info.point.color}"><i></i>${esc(info.point.label || '')}</span>` : '';
        sb.innerHTML = head + item('t', fmt(s.t, 1), '°C') + item('x', fmt(s.x * G, 2), 'g/kg') + item('φ', fmt(s.rh, 1), '%')
            + item('h', fmt(s.h, 1), 'kJ/kg') + item(esc(t('qs.twb')), fmt(s.twb, 1), '°C') + item(esc(t('qs.tdp')), fmt(s.tdp, 1), '°C');
    }

    function th(lbl, unitTxt, cls, extra = '') { return `<th${cls ? ` class="${cls}"` : ''}${extra}>${esc(lbl)}${unitTxt ? `<span class="u">${unitTxt}</span>` : ''}</th>`; }

    function renderTable(u) {
        $$('#lbk-content [data-ltab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ltab === S.tab)));
        $('#lbk-tbl-unit').innerHTML = `<i style="--c:${app.palette()[u.color % 6]}"></i>${esc(u.name)}`;
        const rows = S.tab === 'states' ? statesRows(u) : compRows(u);
        $('#lbk-table').innerHTML = rows.html;
    }

    function statesRows(u) {
        const { win, sum } = S.dp;
        const cell = (s) => {
            const f = s && full(s);
            return f ? `<td>${fmt(f.t, 1)}</td><td>${fmt(f.x * G, 2)}</td><td>${fmt(f.rh, 0)}</td><td>${fmt(f.h, 1)}</td>` : '<td colspan="4">—</td>';
        };
        const grp = (k) => `<th colspan="4" class="lbk-grp"><i class="lbk-cond-dot" style="background:${condColor(k)}"></i>${esc(t('lbk.cond.' + k))}</th>`;
        const sub = ['t', 'x', 'φ', 'h'].map((q, i) => th(q, ['°C', 'g/kg', '%', 'kJ/kg'][i])).join('');
        let head = `<thead><tr><th class="l" rowspan="2">${esc(t('lbk.col.point'))}</th><th class="l" rowspan="2">${esc(t('lbk.col.where'))}</th>${grp('win')}${grp('sum')}</tr><tr>${sub}${sub}</tr></thead>`;
        const nr = (n, c) => `<span class="nr" style="--c:${c || 'var(--muted)'}">${n}</span>`;
        const body = [`<tr><td>${nr(1, 'var(--text-2)')}</td><td class="l">${esc(t('lbk.row.out'))}</td>${cell(win.out)}${cell(sum.out)}</tr>`];
        for (const c of u.comps) {
            if (c.on === false) continue;
            const a = win.points.find((q) => q.id === c.id), b = sum.points.find((q) => q.id === c.id);
            body.push(`<tr data-comp="${esc(c.id)}"><td>${nr(S.numbers[c.id], 'var(--text-2)')}</td><td class="l">${esc(t('lbk.row.after', { name: compName(c, 'sup', u) }))}</td>${cell(a)}${cell(b)}</tr>`);
        }
        body.push(`<tr class="lbk-extra"><td>RL</td><td class="l">${esc(t('lbk.row.ret'))}</td>${cell(win.ret)}${cell(sum.ret)}</tr>`);
        body.push(`<tr class="lbk-extra"><td>AL</td><td class="l">${esc(t('lbk.row.exh'))}</td>${cell(win.exhaust)}${cell(sum.exhaust)}</tr>`);
        return { html: head + '<tbody>' + body.join('') + '</tbody>' };
    }

    function compRows(u) {
        const { win, sum } = S.dp, design = u.mode === 'design';
        const grp = (k) => `<th colspan="2" class="lbk-grp"><i class="lbk-cond-dot" style="background:${condColor(k)}"></i>${esc(t('lbk.cond.' + k))}</th>`;
        const sub = th(t('lbk.col.q'), 'kW') + th(t('lbk.col.water'), 'kg/h');
        const head = `<thead><tr><th class="l" rowspan="2">${esc(t('lbk.col.comp'))}</th>${grp('win')}${grp('sum')}`
            + `${th(t(design ? 'lbk.col.need' : 'lbk.col.cap'), '', '', ' rowspan="2"')}${th(t('lbk.col.dp'), 'Pa', '', ' rowspan="2"')}${th(t('lbk.col.status'), '', 'l', ' rowspan="2"')}</tr><tr>${sub}${sub}</tr></thead>`;
        const qcell = (c, cr) => {
            if (!cr) return '<td>—</td><td>—</td>';
            const q = c.type === 'fan' ? cr.elec : cr.q;
            const cls = q > 0.005 ? 'pos' : q < -0.005 ? 'neg' : '';
            const w = Math.abs(cr.water) > 0.005 ? signed(cr.water, 1) : '—';
            return `<td><span class="${cls}">${Math.abs(q) > 0.005 ? signed(q, 2) : '—'}</span></td><td>${w}</td>`;
        };
        const body = [];
        const tot = { win: 0, sum: 0 };
        for (const c of u.comps) {
            const a = win.comps[c.id], b = sum.comps[c.id], on = c.on !== false;
            let capTxt = '—';
            if (c.type === 'heater' || c.type === 'cooler') {
                const need = Math.max(a ? Math.abs(a.q) : 0, b ? Math.abs(b.q) : 0);
                capTxt = design ? `${fmt(need, 1)} kW` : c.qMax > 0 ? `${fmtA(c.qMax, 1)} kW` : esc(t('lbk.zeroIsFree'));
            } else if (c.type === 'humid') {
                const need = Math.max(a ? a.water : 0, b ? b.water : 0);
                capTxt = design ? `${fmt(need, 1)} kg/h` : c.cap > 0 ? `${fmtA(c.cap, 0)} kg/h` : esc(t('lbk.zeroIsFree'));
            } else if (c.type === 'fan' && S.plan.fanDes[c.id]) capTxt = `${fmt(S.plan.fanDes[c.id].P, 2)} kW`;
            const flags = [];
            if (!on) flags.push(t('lbk.st.off'));
            for (const [k, cr] of [['win', a], ['sum', b]]) {
                if (cr && cr.capped) flags.push(`${t('lbk.st.capped')} (${t('lbk.cond.' + k).charAt(0)})`);
                if (cr && cr.frost) flags.push(`${t('lbk.st.frost')} (${t('lbk.cond.' + k).charAt(0)})`);
            }
            const bad = flags.some((f) => f.startsWith(t('lbk.st.capped')));
            const dpTxt = c.type === 'fan' ? fmtA(S.plan.fanDes[c.id] ? S.plan.fanDes[c.id].dp : c.dpExt, 0) : fmtA(c.dp, 0);
            body.push(`<tr data-comp="${esc(c.id)}" class="${on ? '' : 'off'}"><td class="l"><span class="nr" style="--c:var(--text-2)">${on ? S.numbers[c.id] : '–'}</span> ${esc(compName(c, 'sup', u))}</td>`
                + `${on ? qcell(c, a) + qcell(c, b) : '<td>—</td><td>—</td><td>—</td><td>—</td>'}<td>${capTxt}</td><td>${dpTxt}</td>`
                + `<td class="l"><span class="lbk-flag ${bad ? 'bad' : flags.length ? 'info' : 'ok'}">${esc(flags.length ? flags.join(' · ') : t('lbk.st.ok'))}</span></td></tr>`);
            if (on && c.type === 'fan') { tot.win += a.elec; tot.sum += b.elec; }
        }
        for (const c of u.retComps) {
            const on = c.on !== false;
            const P0 = c.type === 'fan' && on ? S.plan.fanDes[c.id] : null;
            body.push(`<tr class="lbk-extra${on ? '' : ' off'}"><td class="l">${esc(compName(c, 'ret', u))}</td>`
                + `<td>${P0 ? fmt(P0.P, 2) : '—'}</td><td>—</td><td>${P0 ? fmt(P0.P, 2) : '—'}</td><td>—</td><td>${P0 ? fmt(P0.P, 2) + ' kW' : '—'}</td>`
                + `<td>${fmtA(c.type === 'fan' ? (P0 ? P0.dp : c.dpExt) : c.dp, 0)}</td><td class="l">${esc(on ? t('lbk.st.ok') : t('lbk.st.off'))}</td></tr>`);
        }
        return { html: head + '<tbody>' + body.join('') + '</tbody>' };
    }

    /** Markeer een component in lijst, schema, tabel en diagram. */
    function highlight(id) {
        $$('#lbk-sidebar .lbk-comp').forEach((el) => el.classList.toggle('hl', el.dataset.id === id));
        $$('#lbk-schema .blk').forEach((el) => el.classList.toggle('hl', el.dataset.comp === id));
        $$('#lbk-table tr[data-comp]').forEach((el) => el.classList.toggle('hl', el.dataset.comp === id));
        if (S.chart) S.chart.setHighlight(id ? { scnId: S.cond, stepId: id } : null);
    }

    function openComp(id) {
        const u = unit();
        if (!u || !u.comps.concat(u.retComps).some((c) => c.id === id)) return;
        S.expanded = id;
        buildSidebar();
        renderSchema(u);
        const el = $(`#lbk-sidebar .lbk-comp[data-id="${CSS.escape(id)}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /** Procesketen als twee scenario's in de weergave Processen. */
    function openInProcesses() {
        const u = unit();
        if (!u || !S.dp) return;
        const rd = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
        const names = [];
        for (const key of ['win', 'sum']) {
            const r = S.dp[key];
            const steps = [];
            for (const c of u.comps) {
                if (c.on === false) continue;
                const q = r.points.find((x) => x.id === c.id);
                if (q) steps.push({ type: 'point', label: compName(c, 'sup', u), params: { pair: 't-x', a: rd(q.t, 2), b: rd(q.x * G, 3) } });
            }
            const name = `${u.name} – ${t('lbk.cond.' + key)}`.slice(0, 40);
            names.push(name);
            app.upsertScenario(name, { pair: 't-x', a: rd(r.out.t, 2), b: rd(r.out.x * G, 3) }, { mode: 'mass', value: rd(r.m * 3600, 1) }, steps);
        }
        app.setView('mollier');
        app.toast(t('lbk.chart.toProcDone', { a: names[0], b: names[1] }));
    }

    // =====================================================================
    // Export
    // =====================================================================
    function exportCSV() {
        const u = unit();
        if (!u || !S.dp) return;
        const rows = [[app.getProject().name], [u.name, t('lbk.mode.' + u.mode), `${u.flow} m³/h`], []];
        rows.push([t('lbk.col.point'), t('lbk.col.where'), ...['win', 'sum'].flatMap((k) => ['t [°C]', 'x [g/kg]', 'RH [%]', 'h [kJ/kg]'].map((q) => `${t('lbk.cond.' + k)} ${q}`))]);
        const vals = (s) => { const f = s && full(s); return f ? [+f.t.toFixed(2), +(f.x * G).toFixed(3), +f.rh.toFixed(1), +f.h.toFixed(2)] : ['', '', '', '']; };
        rows.push([1, t('lbk.row.out'), ...vals(S.dp.win.out), ...vals(S.dp.sum.out)]);
        for (const c of u.comps) {
            if (c.on === false) continue;
            rows.push([S.numbers[c.id], t('lbk.row.after', { name: compName(c, 'sup', u) }),
                ...vals(S.dp.win.points.find((q) => q.id === c.id)), ...vals(S.dp.sum.points.find((q) => q.id === c.id))]);
        }
        rows.push(['RL', t('lbk.row.ret'), ...vals(S.dp.win.ret), ...vals(S.dp.sum.ret)]);
        rows.push(['AL', t('lbk.row.exh'), ...vals(S.dp.win.exhaust), ...vals(S.dp.sum.exhaust)]);
        rows.push([]);
        rows.push([t('lbk.col.comp'), `${t('lbk.cond.win')} Q [kW]`, `${t('lbk.cond.win')} ${t('lbk.col.water')} [kg/h]`, `${t('lbk.cond.sum')} Q [kW]`, `${t('lbk.cond.sum')} ${t('lbk.col.water')} [kg/h]`, 'Δp [Pa]']);
        for (const c of u.comps) {
            if (c.on === false) continue;
            const a = S.dp.win.comps[c.id], b = S.dp.sum.comps[c.id];
            const q = (cr) => +(c.type === 'fan' ? cr.elec : cr.q).toFixed(3);
            rows.push([compName(c, 'sup', u), q(a), +a.water.toFixed(2), q(b), +b.water.toFixed(2), c.type === 'fan' ? Math.round(S.plan.fanDes[c.id].dp) : c.dp]);
        }
        app.csv(rows, `${app.slug()}-lbk.csv`);
    }
    async function exportPNG() {
        if (!S.chart) return;
        try { app.download(await S.chart.toPNGBlob(2), `${app.slug()}-lbk-${app.chartType()}.png`); } catch (e) { app.toast(t('toast.exportFail'), true); }
    }
    function exportSVG() {
        if (!S.chart) return;
        app.download(new Blob([S.chart.toSVGString(unit() ? unit().name : '')], { type: 'image/svg+xml' }), `${app.slug()}-lbk-${app.chartType()}.svg`);
    }

    // =====================================================================
    // Gebeurtenissen
    // =====================================================================
    function bindEvents() {
        const side = $('#lbk-sidebar'), content = $('#lbk-content');
        const onNew = (e) => {
            const b = e.target.closest('[data-new]');
            if (!b) return false;
            const m = b.closest('.menu');
            if (m) m.classList.remove('open');
            newUnit(b.dataset.new);
            return true;
        };
        side.addEventListener('click', (e) => {
            if (onNew(e)) return;
            const add = e.target.closest('#lbk-add');
            if (add) {
                e.stopPropagation();
                const m = $('#lbk-add-menu');
                const open = !m.classList.contains('open');
                $$('.menu.open').forEach((x) => x.classList.remove('open'));
                m.classList.toggle('open', open);
                add.setAttribute('aria-expanded', String(open));
                return;
            }
            const chip = e.target.closest('[data-unit]');
            if (chip) {
                if (chip.dataset.unit !== state().active) { S.expanded = null; app.change((pj) => { pj.lbk.active = chip.dataset.unit; }); }
                return;
            }
            const sw = e.target.closest('.swatch[data-color]');
            if (sw) { app.change((pj) => { const u = pj.lbk.units.find((x) => x.id === pj.lbk.active); u.color = +sw.dataset.color; }); return; }
            const ua = e.target.closest('[data-unit-act]');
            if (ua) { unitAction(ua.dataset.unitAct); return; }
            const sg = e.target.closest('[data-seg] button[data-val]');
            if (sg) {
                const path = sg.parentNode.dataset.seg, v = sg.dataset.val;
                if (getPath(unit(), path) !== v) app.change((pj) => { setPath(pj, path, v); });
                return;
            }
            const ad = e.target.closest('[data-add]');
            if (ad) { addComp(ad.dataset.add, ad.dataset.side); return; }
            if (e.target.closest('#lbk-propose')) { propose(); return; }
            const item = e.target.closest('.lbk-comp');
            if (!item) return;
            const act = e.target.closest('[data-act]');
            if (act) { e.stopPropagation(); compAction(item.dataset.id, item.dataset.side, act.dataset.act); return; }
            if (e.target.closest('.lbk-comp-head')) {
                S.expanded = S.expanded === item.dataset.id ? null : item.dataset.id;
                sync();
            }
        });
        side.addEventListener('keydown', (e) => {
            const head = e.target.closest('.lbk-comp-head');
            if (head && (e.key === 'Enter' || e.key === ' ') && e.target === head) {
                e.preventDefault();
                const id = head.parentNode.dataset.id;
                S.expanded = S.expanded === id ? null : id;
                sync();
            }
        });
        side.addEventListener('input', (e) => {
            const el = e.target, path = el.dataset.path;
            if (!path) return;
            if (el.dataset.kind === 'text') { app.change((pj) => { setPath(pj, path, el.value.slice(0, 40) || '—'); }, true); return; }
            if (el.dataset.kind !== 'num') return;
            const v = app.parseNum(el.value);
            el.classList.toggle('invalid', !isFinite(v));
            if (isFinite(v)) app.change((pj) => { setPath(pj, path, v); }, true);
        });
        side.addEventListener('change', (e) => {
            const el = e.target, path = el.dataset.path;
            if (!path) return;
            if (el.dataset.kind === 'select') app.change((pj) => { setPath(pj, path, el.value); normalizeActive(pj); });
            else if (el.dataset.kind === 'bool') app.change((pj) => { setPath(pj, path, el.checked); normalizeActive(pj); });
            else {
                el.classList.remove('invalid');
                app.change((pj) => normalizeActive(pj));
            }
        });
        side.addEventListener('pointerover', (e) => {
            const item = e.target.closest('.lbk-comp');
            highlight(item ? item.dataset.id : null);
        });
        side.addEventListener('pointerleave', () => highlight(null));

        content.addEventListener('click', (e) => {
            if (onNew(e)) return;
            const cb = e.target.closest('[data-cond]');
            if (cb) { S.cond = cb.dataset.cond; renderContent(); return; }
            const blk = e.target.closest('.blk[data-comp]');
            if (blk) { openComp(blk.dataset.comp); return; }
            const tb = e.target.closest('[data-ltab]');
            if (tb) { S.tab = tb.dataset.ltab; renderTable(unit()); return; }
            const row = e.target.closest('#lbk-table tr[data-comp]');
            if (row) { openComp(row.dataset.comp); return; }
            if (e.target.closest('#lbk-csv')) exportCSV();
            else if (e.target.closest('#lbk-fix')) fixCapacities();
            else if (e.target.closest('#lbk-to-energy')) app.setView('energy');
            else if (e.target.closest('#lbk-to-proc')) openInProcesses();
            else if (e.target.closest('#lbk-zoom-in') && S.chart) S.chart.zoomBy(1.5);
            else if (e.target.closest('#lbk-zoom-out') && S.chart) S.chart.zoomBy(1 / 1.5);
            else if (e.target.closest('#lbk-fit') && S.chart) S.chart.fitToData();
            else if (e.target.closest('#lbk-reset') && S.chart) S.chart.resetView();
        });
        content.addEventListener('keydown', (e) => {
            const blk = e.target.closest('.blk[data-comp]');
            if (blk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openComp(blk.dataset.comp); }
        });
        content.addEventListener('pointerover', (e) => {
            const el = e.target.closest('.blk[data-comp], #lbk-table tr[data-comp]');
            if (el) highlight(el.dataset.comp);
        });
        content.addEventListener('pointerout', (e) => {
            const el = e.target.closest('.blk[data-comp], #lbk-table tr[data-comp]');
            if (el && !el.contains(e.relatedTarget)) highlight(null);
        });
    }

    // =====================================================================
    // Koppeling met app.js
    // =====================================================================
    /** Na elke projectwijziging (app.render). */
    function sync() {
        if (!app) return;
        if (!S.visible) { S.built = false; return; }
        if (S.builtLang !== app.lang) buildContent();
        if (!S.built || structKey() !== S.structKey) buildSidebar();
        renderContent();
    }
    function show(on) {
        S.visible = on;
        if (on) { S.built = false; sync(); }
    }
    function renderAll() { if (S.visible) { buildContent(); S.built = false; sync(); } else S.built = false; }
    function restyle() { S.chartKey = null; if (S.visible) { S.built = false; sync(); } }

    function init(api) {
        app = api;
        document.body.insertAdjacentHTML('afterbegin', SYMBOLS);
        buildContent();
        bindEvents();
    }

    root.LbkView = { init, sync, show, renderAll, restyle, exportCSV, exportPNG, exportSVG, compName, get state() { return S; } };
})(typeof self !== 'undefined' ? self : this);
