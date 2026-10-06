/**
 * schematic.js — schematische doorsnede van het EWF-concept (eigen tekening naar de opbouw van
 * Bronsema fig. 1.3/1): Ventecdak, klimaatcascade, toevoerschacht, verdiepingen, shunt,
 * zonneschoorsteen, FiWiHEx, technische ruimte en WKO, met de nummering 1–9.
 *
 * Kleur = temperatuur (divergerend blauw – grijs – rood, −10…50 °C); pijlen volgen de luchtweg
 * (dikte ∝ debiet, streepsnelheid ∝ luchtsnelheid); vallende druppels in de cascade.
 * Animaties zijn SMIL (pauzeren via svg.pauseAnimations(), blijven werken in een SVG-export).
 * Het SVG wordt alleen opnieuw opgebouwd als het resultaat verandert, nooit per frame.
 */
(function (root) {
    'use strict';

    const SVGNS = 'http://www.w3.org/2000/svg';
    const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const W = 1000;                     // breedte viewBox
    const T_MIN = -10, T_MAX = 50;      // temperatuurschaal
    const TIME_SCALE = 4;               // animatie loopt 4× sneller dan de werkelijkheid

    // ---- Thema's (concrete kleuren, zodat een export er hetzelfde uitziet) ----
    const PAL = {
        light: {
            bg: '#ffffff', ink: '#0f172a', ink2: '#475569', muted: '#64748b', line: '#94a3b8', slab: '#64748b',
            solid: '#e2e8f0', soil: '#efe9df', soilLine: '#c9bba5', pill: '#ffffff', pillLine: '#cbd5e1',
            water: '#2a78d6', glass: '#5aa0e6', sun: '#eda100', wind: '#475569', ok: '#047857', bad: '#d03b3b',
            cold: '#2a78d6', warm: '#e34948',
            temp: ['#104281', '#3987e5', '#9ec5f4', '#f0efec', '#f4b6ad', '#e34948', '#9c2a2a']
        },
        dark: {
            bg: '#0f172a', ink: '#f1f5f9', ink2: '#cbd5e1', muted: '#94a3b8', line: '#475569', slab: '#94a3b8',
            solid: '#1e293b', soil: '#211d18', soilLine: '#4a4033', pill: '#111827', pillLine: '#334155',
            water: '#5598e7', glass: '#86b6ef', sun: '#fab219', wind: '#94a3b8', ok: '#34d399', bad: '#f87171',
            cold: '#5598e7', warm: '#e66767',
            temp: ['#9ec5f4', '#5598e7', '#256abf', '#383835', '#a33a39', '#e66767', '#f4b0a8']
        }
    };
    PAL.ikeaLight = Object.assign({}, PAL.light, { ink: '#111111', ink2: '#484848', muted: '#767676', line: '#929292', slab: '#767676', solid: '#ebebeb', water: '#0058a3', glass: '#3b82c4', sun: '#ffdb00', ok: '#0a8a00', bad: '#e00751' });
    PAL.ikeaDark = Object.assign({}, PAL.dark, { bg: '#003a70', ink: '#ffffff', ink2: '#dbe7f3', muted: '#a3bfdb', line: '#4a7db4', slab: '#a3bfdb', solid: '#004b8d', pill: '#002d57', pillLine: '#19599a', sun: '#ffdb00', ok: '#7fd47a', bad: '#ff8fa8' });

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const r1 = (v) => Math.round(v * 10) / 10;
    const attr = (o) => Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false)
        .map(([k, v]) => `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`).join(' ');
    const tag = (n, o, inner) => (inner == null ? `<${n} ${attr(o || {})}/>` : `<${n} ${attr(o || {})}>${inner}</${n}>`);
    const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /** Divergerende temperatuurschaal (stuksgewijs lineair in RGB tussen 7 stappen). */
    function tempScale(stops) {
        const rgb = stops.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
        return (t) => {
            if (!isFinite(t)) return stops[3];
            const u = clamp((t - T_MIN) / (T_MAX - T_MIN), 0, 1) * (stops.length - 1);
            const i = Math.min(stops.length - 2, Math.floor(u)), f = u - i;
            const c = rgb[i].map((a, k) => Math.round(a + (rgb[i + 1][k] - a) * f));
            return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
        };
    }
    /** Inkt (licht of donker) die leesbaar is op een vulkleur. */
    function inkOn(hex, P) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? '#0f172a' : '#f8fafc';
    }

    // =====================================================================
    class Schematic {
        constructor(card, cb) {
            this.card = card;
            this.cb = cb || {};
            this.paused = false;
            this.userPlay = null;
            this.uid = 'ewfs' + Math.random().toString(36).slice(2, 7);
            card.innerHTML = `<div class="ewf-schema-head"><div class="ewf-schema-title"></div><div class="ewf-badges" aria-live="polite"></div>`
                + `<div class="ewf-schema-tools"><button type="button" class="icon-btn sm ewf-anim" aria-pressed="true"></button>`
                + `<button type="button" class="tb-btn sm ewf-exp" data-exp="svg">SVG</button><button type="button" class="tb-btn sm ewf-exp" data-exp="png">PNG</button></div></div>`
                + `<div class="ewf-schema-wrap"><svg class="ewf-svg" xmlns="${SVGNS}" role="group"></svg><div class="ewf-tip" role="tooltip" hidden></div></div>`
                + `<div class="ewf-schema-foot"><div class="ewf-legend"></div><p class="hint ewf-note"></p></div>`;
            this.svg = card.querySelector('svg');
            this.tip = card.querySelector('.ewf-tip');
            this.wrap = card.querySelector('.ewf-schema-wrap');
            this.btnAnim = card.querySelector('.ewf-anim');
            this.reduced = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
            this._bind();
        }

        _bind() {
            this.btnAnim.addEventListener('click', () => {
                this.userPlay = this.paused;
                const pr = this.ctx && this.ctx.prefs;
                if (pr) { pr.ewf.anim = this.userPlay; if (root.MollierApp) root.MollierApp.savePrefs(); }
                this._applyAnim();
            });
            this.card.querySelectorAll('.ewf-exp').forEach((b) => b.addEventListener('click', () => {
                const v = root.EwfView;
                if (b.dataset.exp === 'svg') v.exportSVG(); else v.exportPNG();
            }));
            const show = (ev, g) => this._tooltip(ev, g);
            this.svg.addEventListener('pointermove', (ev) => { const g = ev.target.closest('[data-comp]'); if (g) show(ev, g); else this._hideTip(); });
            this.svg.addEventListener('pointerleave', () => this._hideTip());
            this.svg.addEventListener('focusin', (ev) => { const g = ev.target.closest('[data-comp]'); if (g) show(null, g); });
            this.svg.addEventListener('focusout', () => this._hideTip());
            const open = (g) => { if (g && g.dataset.panel && this.cb.openPanel) this.cb.openPanel(g.dataset.panel); };
            this.svg.addEventListener('click', (ev) => {
                const g = ev.target.closest('[data-comp]');
                if (!g) return;
                if (ev.pointerType === 'touch' && this.tipFor !== g) { show(ev, g); return; }   // eerste tik: aflezen
                open(g);
            });
            this.svg.addEventListener('keydown', (ev) => {
                if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-comp]')) { ev.preventDefault(); open(ev.target.closest('[data-comp]')); }
            });
        }

        _animOn() {
            if (this.userPlay !== null) return this.userPlay;
            if (this.reduced && this.reduced.matches) return false;
            return !(this.ctx && this.ctx.prefs && this.ctx.prefs.ewf.anim === false);
        }
        _applyAnim() {
            const on = this._animOn() && !this.hiddenPause;
            this.paused = !on;
            try { if (on) this.svg.unpauseAnimations(); else this.svg.pauseAnimations(); } catch (e) { /* oude browser */ }
            const t = this.ctx ? this.ctx.t : (k) => k;
            this.btnAnim.setAttribute('aria-pressed', String(on));
            this.btnAnim.title = t(on ? 'ewf.sch.pause' : 'ewf.sch.play');
            this.btnAnim.setAttribute('aria-label', this.btnAnim.title);
            this.btnAnim.innerHTML = on
                ? '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>';
        }
        pause(hidden) { this.hiddenPause = hidden; this._applyAnim(); }
        destroy() { this._hideTip(); this.card.innerHTML = ''; }

        // =================================================================
        update(r, ctx) {
            this.r = r;
            this.ctx = ctx;
            const P = PAL[ctx.skin] || PAL.light;
            this.P = P;
            this.tc = tempScale(P.temp);
            const { t } = ctx;
            this.card.querySelector('.ewf-schema-title').textContent = t('ewf.sch.title');
            this._badges(r, ctx);
            const g = this._geometry(r);
            this.g = g;
            this.svg.setAttribute('viewBox', `0 0 ${W} ${g.height}`);
            this.svg.setAttribute('aria-label', t('ewf.sch.title'));
            this.svg.innerHTML = this._draw(r, g, P, ctx);
            this.card.querySelector('.ewf-legend').innerHTML = this._legend(P, ctx);
            this.card.querySelector('.ewf-note').textContent = t('ewf.sch.note');
            this._applyAnim();
            if (this.tipFor) this._hideTip();
        }

        // ---- Statusbadges ----
        _badges(r, { t, fmt, esc }) {
            const out = [];
            const b = (cls, txt) => out.push(`<span class="ewf-badge ${cls}">${esc(txt)}</span>`);
            b('mode ' + r.mode, t('ewf.modeLong.' + r.mode));
            if (r.power.PfanSupply > 0.5) b('bad', t('ewf.sch.bFanSup', { w: fmt(r.power.PfanSupply, 0) }));
            else b('ok', t('ewf.sch.bThrSup', { pa: fmt(Math.min(...r.pressure.supply.map((q) => q.throttle)), 0) }));
            if (r.power.PfanExhaust > 0.5) b('bad', t('ewf.sch.bFanExh', { w: fmt(r.power.PfanExhaust, 0) }));
            else b('ok', t('ewf.sch.bThrExh', { pa: fmt(Math.min(...r.pressure.exhaust.map((q) => q.throttle)), 0) }));
            if (!r.chimney.open) b('info', t('ewf.kpi.closed').replace(/^./, (c) => c.toUpperCase()));
            if (r.warnings.some((w) => w.code === 'freezeTop' || w.code === 'iceLikely')) b('bad', t('ewf.sch.bFreeze'));
            if (r.room && r.room.rh > r.inputs.building.rhRoomMax) b('warn', t('ewf.sch.bRh', { rh: fmt(r.room.rh, 0) }));
            this.card.querySelector('.ewf-badges').innerHTML = out.join('');
        }

        // ---- Geometrie ----
        _geometry(r) {
            const b = r.inputs.building, d = r.derived, n = b.floors;
            const fp = clamp(360 / n, 18, 44);                          // pixels per verdieping (> 12 lagen: gecomprimeerd)
            const pxm = fp / b.hFloor;                                  // pixels per meter (verticaal)
            const roofPx = clamp(b.roofExtra * pxm, 40, 64);
            const yArcTop = 30, yRoofTop = 104;
            const yTop = yRoofTop + roofPx, yGround = yTop + n * fp;
            const xL = 165, xR = 855;
            const sc = 9;                                               // pixels per meter (schachtbreedte)
            const wKC = clamp(d.sideC * sc, 24, 60), wTS = wKC;
            const wSH = clamp(Math.sqrt(d.Ashunt) * sc, 24, 60);
            const wZS = clamp(b.chimD * 30, 16, 44);
            const kc = [xL, xL + wKC], ts = [kc[1] + 5, kc[1] + 5 + wTS];
            const zs = [xR - wZS, xR], sh = [zs[0] - 5 - wSH, zs[0] - 5];
            const fl = [ts[1] + 5, sh[0] - 5];
            const yTech = yGround + 70, yWells = yGround + 150;
            return { n, fp, pxm, roofPx, yArcTop, yRoofTop, yTop, yGround, xL, xR, kc, ts, sh, zs, fl, yTech, yWells, height: yWells + 26 };
        }

        // ---- Tekenen ----
        _draw(r, g, P, ctx) {
            const { t, fmt } = ctx;
            const tc = this.tc, id = this.uid;
            const o = [];
            const b = r.inputs.building, w = r.inputs.weather;
            const mid = (a) => (a[0] + a[1]) / 2;
            const qv = r.derived.qV;
            const sw = clamp(1.5 + 4 * qv / 30, 1.5, 6);                // dikte ∝ debiet
            const swFloor = clamp(sw / Math.sqrt(g.n), 1.2, 3);
            const speed = (v) => Math.max(4, v * g.pxm * TIME_SCALE);   // px/s
            const tOut = r.outdoor ? r.outdoor.t : w.t;

            // defs: gradiënten, pijlpunten, arcering
            const cas = r.cascade.profile, H = r.derived.H;
            const stopsKC = [];
            for (let i = 0; i < cas.length; i += Math.max(1, Math.floor(cas.length / 24))) stopsKC.push(cas[i]);
            stopsKC.push(cas[cas.length - 1]);
            const gradKC = stopsKC.map((q) => `<stop offset="${r1((1 - q.z / H) * 100)}%" stop-color="${tc(q.t)}"/>`).join('');
            const chp = r.chimney.profile;
            const gradZS = chp.filter((q, i) => i % Math.max(1, Math.floor(chp.length / 16)) === 0 || i === chp.length - 1)
                .map((q) => `<stop offset="${r1((1 - q.z / H) * 100)}%" stop-color="${tc(q.t)}"/>`).join('');
            const scaleStops = P.temp.map((c, i) => `<stop offset="${r1(i / (P.temp.length - 1) * 100)}%" stop-color="${c}"/>`).join('');
            o.push(`<defs>
                <linearGradient id="${id}-kc" x1="0" y1="0" x2="0" y2="1">${gradKC}</linearGradient>
                <linearGradient id="${id}-zs" x1="0" y1="0" x2="0" y2="1">${gradZS}</linearGradient>
                <linearGradient id="${id}-scale" x1="0" y1="0" x2="1" y2="0">${scaleStops}</linearGradient>
                <marker id="${id}-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="${P.ink}"/></marker>
                <marker id="${id}-arw" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="${P.wind}"/></marker>
                <marker id="${id}-ars" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="${P.sun}"/></marker>
                <pattern id="${id}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${P.line}" stroke-width="1.2"/></pattern>
                <pattern id="${id}-wires" width="4" height="8" patternUnits="userSpaceOnUse"><line x1="2" y1="0" x2="2" y2="8" stroke="${P.ink2}" stroke-width="0.7"/></pattern>
                <pattern id="${id}-soil" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="0.9" fill="${P.soilLine}"/><circle cx="7" cy="8" r="0.7" fill="${P.soilLine}"/></pattern>
            </defs>`);
            o.push(tag('title', {}, escT(t('ewf.sch.title'))));
            o.push(tag('desc', {}, escT(t('ewf.sch.desc', {
                t: fmt(tOut, 1), tc: fmt(r.cascade.out ? r.cascade.out.t : tOut, 1), ts: fmt(r.supply.t, 1),
                tz: fmt(r.chimney.tOut, 1), sup: fmt(Math.min(...r.pressure.supply.map((q) => q.available)), 1),
                exh: fmt(Math.min(...r.pressure.exhaust.map((q) => q.available)), 1)
            }))));
            o.push(tag('rect', { x: 0, y: 0, width: W, height: g.height, fill: P.bg }));

            // ---- Zon en stralen (rechts) ----
            o.push(this._sun(r, g, P, ctx));

            // ---- Grond, technische ruimte, WKO ----
            o.push(tag('rect', { x: 0, y: g.yGround, width: W, height: g.height - g.yGround, fill: P.soil }));
            o.push(tag('rect', { x: 0, y: g.yGround, width: W, height: g.height - g.yGround, fill: `url(#${id}-soil)` }));
            o.push(tag('line', { x1: 0, y1: g.yGround, x2: W, y2: g.yGround, stroke: P.slab, 'stroke-width': 2 }));
            o.push(this._tech(r, g, P, ctx));

            // ---- Ventecdak: bovendak + dakopbouw ----
            o.push(this._roof(r, g, P, ctx, tOut));

            // ---- Schachten en verdiepingen ----
            const fh = g.yGround - g.yTop;
            // klimaatcascade
            o.push(`<g data-comp="kc" data-panel="cascade" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.kc'))}">`
                + tag('rect', { x: g.kc[0], y: g.yTop, width: g.kc[1] - g.kc[0], height: fh, fill: r.cascade.active ? `url(#${id}-kc)` : tc(tOut), stroke: P.slab, 'stroke-width': 1.5 })
                + this._drops(r, g, P) + '</g>');
            // toevoerschacht
            o.push(`<g data-comp="ts" data-panel="vent" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.ts'))}">`
                + tag('rect', { x: g.ts[0], y: g.yTop, width: g.ts[1] - g.ts[0], height: fh, fill: tc(r.supply.t), stroke: P.slab, 'stroke-width': 1.5 }) + '</g>');
            // shunt
            o.push(`<g data-comp="sh" data-panel="exhaust" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.sh'))}">`
                + tag('rect', { x: g.sh[0], y: g.yTop, width: g.sh[1] - g.sh[0], height: fh, fill: tc(r.room ? r.room.t : 21), stroke: P.slab, 'stroke-width': 1.5 }) + '</g>');
            // zonneschoorsteen (glas aan de buitenzijde)
            o.push(`<g data-comp="zs" data-panel="chimney" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.zs'))}">`
                + tag('rect', { x: g.zs[0], y: g.yRoofTop + 8, width: g.zs[1] - g.zs[0], height: g.yGround - g.yRoofTop - 8, fill: `url(#${id}-zs)`, stroke: P.slab, 'stroke-width': 1.5, opacity: r.chimney.open ? 1 : 0.55 })
                + (r.chimney.open ? '' : tag('rect', { x: g.zs[0], y: g.yTop, width: g.zs[1] - g.zs[0], height: fh, fill: `url(#${id}-hatch)` }))
                + tag('line', { x1: g.zs[1], y1: g.yRoofTop + 8, x2: g.zs[1], y2: g.yGround, stroke: P.glass, 'stroke-width': 3.5 }) + '</g>');
            // verdiepingen
            o.push(this._floors(r, g, P, ctx, swFloor, speed));

            // ---- Luchtweg ----
            o.push(this._flows(r, g, P, ctx, sw, speed, mid));

            // ---- Labels ----
            o.push(this._labels(r, g, P, ctx, tOut, mid));
            return o.join('');
        }

        _pill(x, y, text, P, anchor = 'start', strong = false, color) {
            const w = Math.max(18, text.length * 5.6 + 10), h = 15;
            const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
            return `<g class="pill">${tag('rect', { x: r1(x0), y: r1(y - h / 2), width: r1(w), height: h, rx: 4, fill: P.pill, stroke: color || P.pillLine, 'stroke-width': color ? 1.4 : 1, opacity: 0.94 })}`
                + tag('text', { x: r1(x0 + w / 2), y: r1(y + 3.6), 'text-anchor': 'middle', 'font-size': 10, 'font-weight': strong ? 700 : 500, fill: color || P.ink }, escT(text)) + '</g>';
        }
        _num(x, y, n, P) {
            return `<g class="num">${tag('circle', { cx: x, cy: y, r: 8, fill: P.ink })}${tag('text', { x, y: y + 3.5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: P.bg }, escT(n))}</g>`;
        }

        _sun(r, g, P, ctx) {
            const sun = r.rad.sun, phi = r.rad.total;
            const cx = 950, cy = 46;
            const o = [];
            const up = sun.alt > 0;
            o.push(`<g data-comp="sun" data-panel="weather" tabindex="0" role="button" aria-label="${escT(ctx.t('ewf.sch.sun'))}">`);
            o.push(tag('circle', { cx, cy, r: 16, fill: P.sun, opacity: up ? 1 : 0.3 }));
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                o.push(tag('line', { x1: r1(cx + 20 * Math.cos(a)), y1: r1(cy + 20 * Math.sin(a)), x2: r1(cx + 26 * Math.cos(a)), y2: r1(cy + 26 * Math.sin(a)), stroke: P.sun, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: up ? 1 : 0.3 }));
            }
            o.push('</g>');
            if (phi > 1) {
                // stralen onder de zonnehoogte (visueel begrensd) naar het glas
                const alt = clamp(up ? sun.alt : 30, 8, 65) * Math.PI / 180;
                const wpx = clamp(1 + phi / 220, 1, 5), op = clamp(0.25 + phi / 900, 0.25, 1);
                const ys = [0.15, 0.35, 0.55, 0.75].map((f) => g.yTop + f * (g.yGround - g.yTop));
                for (const y of ys) {
                    const len = 110;
                    const x0 = g.zs[1] + len * Math.cos(alt), y0 = y - len * Math.sin(alt);
                    o.push(tag('line', { x1: r1(x0), y1: r1(y0), x2: g.zs[1] + 6, y2: r1(y - 6 * Math.tan(alt)), stroke: P.sun, 'stroke-width': r1(wpx), opacity: r1(op), 'marker-end': `url(#${this.uid}-ars)` }));
                }
            }
            return o.join('');
        }

        _roof(r, g, P, ctx, tOut) {
            const { t, fmt } = ctx;
            const tc = this.tc, id = this.uid;
            const xa = g.xL - 40, xb = g.xR + 40, xm = (xa + xb) / 2;
            const o = [];
            // bovendak (afgeplatte lens): bovenzijde bol, onderzijde iets omlaag → keel in het midden
            const yE = g.yArcTop + 34, yTopC = g.yArcTop, yBotC = g.yArcTop + 50;
            o.push(`<g data-comp="ventec" data-panel="ventec" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.ventec'))}">`);
            o.push(tag('path', { d: `M${xa},${yE} Q${xm},${yTopC - 30} ${xb},${yE} Q${xm},${yBotC + 4} ${xa},${yE} Z`, fill: P.solid, stroke: P.slab, 'stroke-width': 1.5 }));
            for (const x of [xa + 70, xm, xb - 70]) {
                o.push(tag('line', { x1: x, y1: g.yRoofTop, x2: x, y2: x === xm ? yBotC - 4 : yE + 10, stroke: P.slab, 'stroke-width': 2 }));
            }
            o.push('</g>');
            // dakopbouw met overstekken
            const rx0 = g.xL - 36, rx1 = g.xR + 36;
            const yr0 = g.yRoofTop, yr1 = g.yTop;
            o.push(tag('rect', { x: rx0, y: yr0, width: rx1 - rx0, height: yr1 - yr0, fill: P.solid, stroke: P.slab, 'stroke-width': 1.5 }));
            // 1 overdrukruimte (buitenlucht)
            const x1e = g.ts[1] + 70;
            o.push(`<g data-comp="over" data-panel="ventec" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c1'))}">`
                + tag('rect', { x: rx0 + 3, y: yr0 + 3, width: x1e - rx0 - 3, height: yr1 - yr0 - 6, fill: tc(tOut), stroke: P.line })
                + tag('line', { x1: rx0, y1: yr1, x2: rx0 + 30, y2: yr1 + 10, stroke: P.slab, 'stroke-width': 2 })      // klep overstek
                + '</g>');
            // 7 recirculatieklep (dicht tijdens bedrijfstijd)
            const x7 = (x1e + g.sh[0]) / 2, y7 = (yr0 + yr1) / 2;
            o.push(`<g data-comp="recirc" data-panel="exhaust" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c7'))}">`
                + tag('rect', { x: x7 - 26, y: yr0 + 6, width: 52, height: yr1 - yr0 - 12, fill: 'transparent' })
                + tag('circle', { cx: x7, cy: y7, r: 9, fill: P.pill, stroke: P.slab, 'stroke-width': 1.5 })
                + tag('line', { x1: x7 - 9, y1: y7, x2: x7 + 9, y2: y7, stroke: P.slab, 'stroke-width': 2 }) + '</g>');
            // 4 FiWiHEx boven de schoorsteen en de shunt
            const fx0 = g.sh[0] - 8, fx1 = rx1 - 6;
            const tAfter = r.fiwihex.tAfter;
            o.push(`<g data-comp="fiwi" data-panel="exhaust" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c4'))}">`
                + tag('rect', { x: fx0, y: yr0 + 3, width: fx1 - fx0, height: yr1 - yr0 - 6, fill: tc(tAfter), stroke: P.line })
                + tag('rect', { x: g.zs[0] - 2, y: yr0 + 8, width: g.zs[1] - g.zs[0] + 30, height: (yr1 - yr0) * 0.42, fill: `url(#${id}-wires)`, stroke: P.ink2, 'stroke-width': 1 })
                + '</g>');
            // 5 hulpventilatoren: toevoer (boven in de cascade) en afvoer (bij de FiWiHEx)
            o.push(this._fan(r1((g.kc[0] + g.kc[1]) / 2), yr1 - 13, r.power.PfanSupply > 0.5, P, 'fanSup', t('ewf.sch.c5s')));
            o.push(this._fan(fx0 + 16, yr1 - 13, r.power.PfanExhaust > 0.5, P, 'fanExh', t('ewf.sch.c5e')));
            // 6 venturi-ejector in de keel
            const xe = this._xEj(g);
            o.push(`<g data-comp="ej" data-panel="ventec" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c6'))}">`
                + tag('path', { d: `M${xe - 16},${yr0} L${xe - 7},${yr0 - 16} L${xe + 7},${yr0 - 16} L${xe + 16},${yr0} Z`, fill: tc(tAfter), stroke: P.slab, 'stroke-width': 1.5 }) + '</g>');
            return o.join('');
        }
        _xEj(g) { return g.sh[0] - 60; }

        _fan(cx, cy, on, P, comp, label) {
            const blades = [0, 120, 240].map((a) => `<path d="M0,0 C3,-3 7,-3 8,0 C7,2 3,2 0,0 Z" transform="rotate(${a})" fill="${on ? P.bad : P.muted}"/>`).join('');
            const spin = on ? `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite" additive="sum"/>` : '';
            return `<g data-comp="${comp}" data-panel="exhaust" tabindex="0" role="button" aria-label="${escT(label)}" transform="translate(${cx},${cy})">`
                + tag('circle', { r: 10, fill: P.pill, stroke: on ? P.bad : P.slab, 'stroke-width': 1.5 }) + `<g>${blades}${spin}</g></g>`;
        }

        _drops(r, g, P) {
            if (!r.cascade.active) return '';
            const prof = r.cascade.profile;
            const wd = prof.reduce((a, q) => a + (q.wd || 0), 0) / prof.length;
            const h = g.yGround - g.yTop;
            const dur = clamp(h / Math.max(4, wd * g.pxm * TIME_SCALE), 0.4, 6);
            const n = Math.round(clamp(6 + 18 * r.cascade.rwl, 4, 30));
            const o = [];
            const w = g.kc[1] - g.kc[0];
            // deterministische spreiding (geen Math.random: zelfde beeld bij gelijke invoer)
            for (let i = 0; i < n; i++) {
                const fx = ((i * 0.618034) % 1), fd = ((i * 0.381966 + 0.13) % 1);
                const x = g.kc[0] + 4 + fx * (w - 8);
                o.push(`<circle cx="${r1(x)}" cy="${g.yTop + 4}" r="1.8" fill="${P.water}" opacity="0.85">`
                    + `<animateTransform attributeName="transform" type="translate" from="0 0" to="0 ${r1(h - 8)}" dur="${r1(dur)}s" begin="-${r1(fd * dur)}s" repeatCount="indefinite"/></circle>`);
            }
            // sproeiers
            for (let i = 0; i < 3; i++) {
                const x = g.kc[0] + w * (i + 1) / 4;
                o.push(tag('path', { d: `M${r1(x - 3)},${g.yTop} L${r1(x + 3)},${g.yTop} L${r1(x)},${g.yTop + 5} Z`, fill: P.water }));
            }
            return o.join('');
        }

        _floors(r, g, P, ctx, swFloor, speed) {
            const { t, fmt } = ctx;
            const o = [];
            const tc = this.tc;
            const tRoom = r.room ? r.room.t : 21;
            const sup = r.pressure.supply, exh = r.pressure.exhaust;
            for (let k = 1; k <= g.n; k++) {
                const y1 = g.yGround - (k - 1) * g.fp, y0 = y1 - g.fp, ym = (y0 + y1) / 2;
                const s = sup[k - 1], e = exh[k - 1];
                o.push(`<g data-comp="floor" data-floor="${k}" data-panel="building" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.floorN', { k }))}">`);
                o.push(tag('rect', { x: g.fl[0], y: r1(y0), width: g.fl[1] - g.fl[0], height: r1(g.fp), fill: tc(tRoom), opacity: 0.55 }));
                if (k > 1) o.push(tag('line', { x1: g.fl[0], y1: r1(y1), x2: g.fl[1], y2: r1(y1), stroke: P.slab, 'stroke-width': 2, 'pointer-events': 'none' }));
                // stroming door de verdieping
                const dur = clamp(32 / speed(0.3), 0.6, 20);
                o.push(tag('line', { x1: g.ts[1] + 2, y1: r1(ym + g.fp * 0.18), x2: g.sh[0] - 4, y2: r1(ym + g.fp * 0.18), stroke: P.ink, 'stroke-width': r1(swFloor), 'stroke-dasharray': '4 12', opacity: 0.55, 'marker-end': `url(#${this.uid}-ar)` },
                    `<animate attributeName="stroke-dashoffset" from="0" to="-32" dur="${r1(dur)}s" repeatCount="indefinite"/>`));
                // kleppen + marges
                const big = g.fp >= 24;
                const fs = (v) => (v >= 0 ? '+' : '') + fmt(v, Math.abs(v) < 10 ? 1 : 0);
                o.push(this._damper(g.ts[1] + 1, ym - (big ? 2 : 0), s, P));
                o.push(this._damper(g.sh[0] - 1, ym - (big ? 2 : 0), e, P));
                const yb = big ? ym - 4 : ym;
                o.push(this._pill(g.ts[1] + 12, yb, `${fs(s.available)} Pa`, P, 'start', true, s.available >= 0 ? P.ok : P.bad));
                o.push(this._pill(g.sh[0] - 12, yb, `${fs(e.available)} Pa`, P, 'end', true, e.available >= 0 ? P.ok : P.bad));
                if ((big || k % 2 === 1) && k !== g.n) o.push(tag('text', { x: (g.fl[0] + g.fl[1]) / 2, y: r1(yb + 3.5), 'text-anchor': 'middle', 'font-size': 10, fill: P.ink2 }, escT(t('ewf.sch.floorShort', { k }))));
                o.push('</g>');
            }
            return o.join('');
        }

        /** Klep: open (horizontaal) bij tekort, gedraaid naar rato van het smoren. */
        _damper(x, y, row, P) {
            const ang = row.available > 0 ? clamp(row.throttle / 120, 0.08, 1) * 60 : 0;
            return `<g transform="translate(${r1(x)},${r1(y)}) rotate(${r1(ang)})">${tag('line', { x1: -5, y1: 0, x2: 5, y2: 0, stroke: P.ink, 'stroke-width': 2, 'stroke-linecap': 'round' })}</g>`;
        }

        _flows(r, g, P, ctx, sw, speed, mid) {
            const o = [];
            const ink = P.ink, mk = `url(#${this.uid}-ar)`;
            const seg = (pts, v, width = sw, extra = '') => {
                const d = 'M' + pts.map((p) => p.map(r1).join(',')).join(' L');
                const dur = clamp(32 / speed(v), 0.25, 20);
                return tag('path', { d, fill: 'none', stroke: ink, 'stroke-width': r1(width), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': '10 22', opacity: 0.7, 'marker-end': mk },
                    `<animate attributeName="stroke-dashoffset" from="0" to="-32" dur="${r1(dur)}s" repeatCount="indefinite"/>${extra}`);
            };
            const yIn = (g.yRoofTop + g.yTop) / 2 + 6;
            const xK = mid(g.kc), xT = mid(g.ts), xS = mid(g.sh), xZ = mid(g.zs);
            const yB = g.yGround + 22;                                    // bassin / U-bocht
            const wAir = r.derived.wAir;
            // toevoer: buiten → 1 → cascade omlaag → bassin → toevoerschacht omhoog
            o.push(seg([[g.xL - 90, yIn], [xK, yIn]], 1.5));
            o.push(seg([[xK, yIn + 4], [xK, yB - 4]], wAir));
            o.push(seg([[xK + 2, yB], [xT, yB]], wAir));
            o.push(seg([[xT, yB - 4], [xT, g.yTop + 8]], wAir));
            // afvoer
            const wSh = r.inputs.building.wShunt, wZs = r.chimney.w;
            const yF = g.yRoofTop + (g.yTop - g.yRoofTop) * 0.3, xe = this._xEj(g);
            if (r.chimney.open) {
                o.push(seg([[xS, g.yTop + 8], [xS, yB - 4]], wSh));
                o.push(seg([[xS + 2, yB], [xZ, yB]], wSh));
                o.push(seg([[xZ, yB - 4], [xZ, yF]], wZs));
                o.push(seg([[xZ - 4, yF], [xe, yF]], wZs));
            } else {
                o.push(seg([[xS, g.yGround - 8], [xS, yF], [xe, yF]], wSh));
            }
            // ejector → keel → buiten (met de wind mee)
            const yK = g.yRoofTop - 26;
            o.push(seg([[xe, yF - 4], [xe, yK + 6]], 2));
            o.push(seg([[xe, yK], [g.xR + 120, yK - 4]], Math.max(1, r.ventec.Uref)));
            // wind: profiel links (lengte ∝ U(z)) en in de keel
            const PH = root.EwfPhysics, d = r.derived;
            const zs = [0.25, 0.5, 0.75, 1].map((f) => f * d.H);
            for (const z of zs) {
                const U = PH.windAtHeight(r.inputs.weather.U10, z, { z0: d.z0, d: d.d });
                const y = g.yGround - z * g.pxm;
                const len = clamp(U * 9, 4, 120);
                if (U > 0.05) o.push(tag('line', { x1: 8, y1: r1(y), x2: r1(8 + len), y2: r1(y), stroke: P.wind, 'stroke-width': 1.6, 'marker-end': `url(#${this.uid}-arw)` }));
            }
            const lenR = clamp(r.ventec.Uref * 10, 6, 130);
            for (const y of [g.yRoofTop - 40, g.yRoofTop - 14]) {
                if (r.ventec.Uref > 0.05) o.push(tag('line', { x1: g.xL - 150, y1: y, x2: r1(g.xL - 150 + lenR), y2: y, stroke: P.wind, 'stroke-width': 2, 'marker-end': `url(#${this.uid}-arw)` }));
            }
            return `<g class="flows" pointer-events="none">${o.join('')}</g>`;
        }

        _tech(r, g, P, ctx) {
            const { t, fmt } = ctx;
            const o = [];
            const x0 = g.kc[0] - 10, x1 = g.ts[1] + 120, y0 = g.yGround + 4, y1 = g.yTech;
            o.push(`<g data-comp="tech" data-panel="cascade" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c9'))}">`);
            o.push(tag('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: P.solid, stroke: P.slab, 'stroke-width': 1.5 }));
            // bassin onder de cascade
            const tw = r.cascade.tWOut != null ? r.cascade.tWOut : r.cascade.tWIn;
            o.push(tag('rect', { x: g.kc[0], y: y1 - 18, width: g.kc[1] - g.kc[0] + 30, height: 14, fill: this.tc(tw), stroke: P.water, 'stroke-width': 1.5 }));
            o.push(tag('path', { d: `M${g.kc[0]},${y1 - 14} q6,-3 12,0 t12,0 t12,0`, fill: 'none', stroke: P.water, 'stroke-width': 1 }));
            // sproeipomp + wisselaar
            const px = g.ts[1] + 40, py = y1 - 22;
            o.push(tag('circle', { cx: px, cy: py, r: 8, fill: P.pill, stroke: P.ink2, 'stroke-width': 1.5 }));
            o.push(tag('path', { d: `M${px - 4},${py + 4} L${px + 5},${py} L${px - 4},${py - 4}`, fill: 'none', stroke: P.ink2, 'stroke-width': 1.5 }));
            o.push(tag('rect', { x: px + 22, y: py - 10, width: 26, height: 20, fill: P.pill, stroke: P.ink2, 'stroke-width': 1.5 }));
            o.push(tag('path', { d: `M${px + 26},${py - 6} L${px + 44},${py + 6} M${px + 26},${py + 6} L${px + 44},${py - 6}`, stroke: P.ink2, 'stroke-width': 1 }));
            // leiding naar de sproeiers (langs de cascade)
            o.push(tag('path', { d: `M${px},${py - 8} L${px},${g.yGround - 2}`, stroke: P.water, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', fill: 'none' }));
            o.push('</g>');
            // 8 WKO: koude en warme bron
            const cxC = px + 35, cxW = px + 95;
            o.push(`<g data-comp="wko" data-panel="cascade" tabindex="0" role="button" aria-label="${escT(t('ewf.sch.c8'))}">`);
            o.push(tag('rect', { x: cxC - 30, y: y1 + 2, width: 150, height: g.yWells - y1 + 6, fill: 'transparent' }));
            o.push(tag('line', { x1: cxC, y1: y1, x2: cxC, y2: g.yWells, stroke: P.cold, 'stroke-width': 5, 'stroke-linecap': 'round' }));
            o.push(tag('line', { x1: cxW, y1: y1 - 30, x2: cxW, y2: g.yWells, stroke: P.warm, 'stroke-width': 5, 'stroke-linecap': 'round' }));
            o.push(tag('line', { x1: cxW, y1: y1 - 30, x2: g.zs[0] - 20, y2: y1 - 30, stroke: P.warm, 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
            o.push('</g>');
            this.wko = { cxC, cxW };
            return o.join('');
        }

        _labels(r, g, P, ctx, tOut, mid) {
            const { t, fmt } = ctx;
            const o = [];
            const c = r.cascade, w = r.inputs.weather;
            const pill = (x, y, s, a, strong) => this._pill(x, y, s, P, a, strong);
            // nummering 1–9
            o.push(this._num(g.xL - 22, (g.yRoofTop + g.yTop) / 2, '1', P));
            o.push(this._num((g.fl[0] + g.fl[1]) / 2 - 60, g.yGround - g.fp / 2 + (g.fp >= 24 ? 9 : 0), '2', P));
            o.push(this._num(mid(g.sh), g.yTop + 16, '3', P));
            o.push(this._num(g.zs[0] - 14, g.yRoofTop + 12, '4', P));
            o.push(this._num(g.kc[1] + 14, g.yTop - 13, '5', P));
            o.push(this._num(this._xEj(g) + 26, g.yRoofTop - 10, '6', P));
            o.push(this._num((g.ts[1] + 70 + g.sh[0]) / 2 + 20, (g.yRoofTop + g.yTop) / 2, '7', P));
            o.push(this._num(this.wko.cxC - 16, g.yWells - 4, '8', P));
            o.push(this._num(g.kc[0] + 4, g.yTech - 30, '9', P));
            // afkortingen schachten
            const ab = (x, s) => tag('text', { x, y: g.yGround - 6, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: P.ink }, escT(s));
            o.push(ab(mid(g.kc), t('ewf.sch.abKC')), ab(mid(g.ts), t('ewf.sch.abTS')), ab(mid(g.sh), t('ewf.sch.abSH')), ab(mid(g.zs), t('ewf.sch.abZS')));
            // buitenlucht
            o.push(pill(6, g.yArcTop + 2, t('ewf.sch.lOut', { t: fmt(tOut, 1), rh: fmt(w.rh, 0), u: fmt(w.U10, 1) }), 'start', true));
            o.push(pill(6, g.yArcTop + 20, t('ewf.sch.lUref', { u: fmt(r.ventec.Uref, 1) }), 'start'));
            // overdrukruimte en ejector
            o.push(pill(g.xL - 30, g.yRoofTop + 12, t('ewf.sch.lOver', { p: fmt(r.ventec.pOver, 1) }), 'start', true));
            o.push(pill(this._xEj(g) - 20, g.yRoofTop - 44, t('ewf.sch.lEj', { p: fmt(r.ventec.pEj, 1) }), 'end', true));
            // sproeiers en voet cascade
            if (c.active) o.push(pill(g.xL - 8, g.yTop + 12, t('ewf.sch.lSpray', { tw: fmt(c.tWIn, 1), rwl: fmt(c.rwl, 2) }), 'end'));
            const out = c.out || r.outdoor;
            o.push(pill(g.xL - 8, g.yGround - 30, t('ewf.sch.lFoot', { t: fmt(out.t, 1), rh: fmt(out.rh, 0) }), 'end', true));
            if (c.active) o.push(pill(g.xL - 8, g.yGround - 12, t('ewf.sch.lFoot2', { tw: fmt(c.tWOut, 1), dp: fmt(c.dpHydr + c.dpTh, 0) }), 'end'));
            // ruimte (bovenste verdieping) en toevoer
            if (r.room) o.push(pill(mid(g.fl), g.yTop + g.fp * 0.5 + (g.fp >= 24 ? 9 : 0), t('ewf.sch.lRoom', { t: fmt(r.room.t, 1), rh: fmt(r.room.rh, 0) }), 'middle', true));
            // schoorsteen top + FiWiHEx
            o.push(pill(W - 4, g.yRoofTop + 18, r.chimney.open ? t('ewf.sch.lZs', { t: fmt(r.chimney.tOut, 1), q: fmt(r.chimney.Q / 1000, 0) })
                : t('ewf.sch.lZsClosed', { q: fmt(r.chimney.Q / 1000, 0) }), 'end', true));
            o.push(pill(W - 4, g.yRoofTop + 36, t('ewf.sch.lFiwi', { q: fmt(r.fiwihex.Q / 1000, 0) }), 'end'));
            o.push(pill(W - 4, g.yTop + 20, t('ewf.sch.lPhi', { phi: fmt(r.rad.total, 0) }), 'end'));
            // WKO
            const Qc = Math.abs(c.Q) / 1000;
            o.push(pill(this.wko.cxC + 8, g.yWells - 26, t(c.Q < 0 ? 'ewf.sch.lCold' : 'ewf.sch.lColdHeat', { q: fmt(Qc, 0) }), 'start'));
            o.push(pill(this.wko.cxW + 8, g.yWells - 6, t('ewf.sch.lWarm', { q: fmt(r.fiwihex.Q / 1000, 0) }), 'start'));
            return o.join('');
        }

        _legend(P, { t, esc }) {
            const items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => `<li><b>${n}</b> ${esc(t('ewf.sch.c' + n))}</li>`).join('');
            const ab = ['KC', 'TS', 'SH', 'ZS'].map((k) => `<li><b>${esc(t('ewf.sch.ab' + k))}</b> ${esc(t('ewf.sch.' + k.toLowerCase()))}</li>`).join('');
            const ticks = [-10, 0, 10, 20, 30, 40, 50].map((v) => `<span style="left:${(v - T_MIN) / (T_MAX - T_MIN) * 100}%">${v}</span>`).join('');
            return `<ol class="ewf-leg-list">${items}${ab}</ol>`
                + `<div class="ewf-scale"><div class="ewf-scale-lbl">${esc(t('ewf.sch.scale'))}</div>`
                + `<div class="ewf-scale-bar" style="background:linear-gradient(90deg,${P.temp.join(',')})"></div><div class="ewf-scale-ticks">${ticks}</div></div>`;
        }

        // ---- Tooltip ----
        _tooltip(ev, gEl) {
            const html = this._tipHTML(gEl.dataset.comp, gEl);
            if (!html) { this._hideTip(); return; }
            this.tip.innerHTML = html;
            this.tip.hidden = false;
            this.tipFor = gEl;
            const wr = this.wrap.getBoundingClientRect();
            let x, y;
            if (ev) { x = ev.clientX - wr.left + this.wrap.scrollLeft; y = ev.clientY - wr.top; }
            else { const b = gEl.getBoundingClientRect(); x = b.left - wr.left + b.width / 2; y = b.top - wr.top + 10; }
            const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
            const right = this.wrap.scrollLeft + wr.width;
            const left = x + 14 + tw > right ? Math.max(4, x - tw - 14) : x + 14;
            const top = clamp(y - th / 2, 4, Math.max(4, wr.height - th - 4));
            this.tip.style.left = left + 'px';
            this.tip.style.top = top + 'px';
        }
        _hideTip() { this.tip.hidden = true; this.tipFor = null; }

        _tipHTML(comp, el) {
            const r = this.r, { t, fmt, esc } = this.ctx;
            const row = (k, v) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
            const head = (k, ref) => `<div class="tip-h">${esc(t(k))}</div>` + (ref ? `<div class="tip-ref">${esc(ref)}</div>` : '');
            const c = r.cascade, ch = r.chimney, v = r.ventec;
            switch (comp) {
                case 'kc': return head('ewf.sch.kc', t('ewf.sch.refKC'))
                    + row(t('ewf.sch.tIn'), `${fmt(r.outdoor.t, 1)} °C · ${fmt(r.outdoor.rh, 0)} %`)
                    + (c.out ? row(t('ewf.sch.tOutC'), `${fmt(c.out.t, 1)} °C · ${fmt(c.out.rh, 0)} %`) : '')
                    + row('RW/L', fmt(c.rwl, 2)) + (c.active ? row(t('ewf.sch.water'), `${fmt(c.tWIn, 1)} → ${fmt(c.tWOut, 1)} °C`) : '')
                    + row('Q', `${fmt(c.Q / 1000, 1)} kW`) + row(t('ewf.sch.dpHydr'), `${fmt(c.dpHydr, 1)} Pa`) + row(t('ewf.sch.dpTh'), `${fmt(c.dpTh, 1)} Pa`)
                    + row(t('ewf.sch.dpAero'), `${fmt(c.dpAero, 1)} Pa`) + row(t('ewf.sch.size'), `${fmt(r.derived.sideC, 2)} × ${fmt(r.derived.sideC, 2)} m · ${fmt(r.derived.wAir, 2)} m/s`);
                case 'ts': return head('ewf.sch.ts', '§3.5.5')
                    + row(t('ewf.sch.tSup'), `${fmt(r.supply.t, 1)} °C · ${fmt(r.supply.rh, 0)} %`) + row(t('ewf.sch.reheat'), `${fmt(r.reheat.Q / 1000, 1)} kW`)
                    + row(t('ewf.sch.pFoot'), `${fmt(r.pressure.pBase, 1)} Pa`) + row(t('ewf.sch.fanSup'), `${fmt(r.pressure.fanSupplyPa, 1)} Pa · ${fmt(r.power.PfanSupply, 0)} W`);
                case 'sh': return head('ewf.sch.sh', '§4.1.11, 4.2.7/3')
                    + row(t('ewf.sch.tExh'), `${fmt(r.room ? r.room.t : NaN, 1)} °C`) + row(t('ewf.sch.size'), `${fmt(Math.sqrt(r.derived.Ashunt), 2)} m · ${fmt(r.inputs.building.wShunt, 1)} m/s`)
                    + row(t('ewf.sch.shuntTop'), `${fmt(r.pressure.exhaust[r.pressure.exhaust.length - 1].parts.dpShunt, 1)} Pa`);
                case 'zs': return head('ewf.sch.zs', '4.2.5/13–15, 4.2.6/1, 4.5.6/1')
                    + row(t('ewf.sch.state'), t(ch.open ? 'ewf.kpi.open' : 'ewf.kpi.closed'))
                    + row(t('ewf.sch.tAir'), `${fmt(ch.tIn, 1)} → ${fmt(ch.tOut, 1)} °C`) + row('Q_zs', `${fmt(ch.Q / 1000, 1)} kW`) + row('η', ch.eta == null ? '—' : fmt(ch.eta, 2))
                    + row(t('ewf.sch.draft'), `${fmt(ch.dpTh, 1)} Pa`) + row(t('ewf.sch.glassMax'), `${fmt(ch.tGlassMax, 1)} °C`) + row(t('ewf.sch.wallMax'), `${fmt(ch.tWallMax, 1)} °C`)
                    + row('Φ', `${fmt(r.rad.total, 0)} W/m² (θ ${fmt(r.rad.theta, 0)}°)`) + row('w', `${fmt(ch.w, 2)} m/s`);
                case 'fiwi': return head('ewf.sch.c4', '§4.5.8.2')
                    + row(t('ewf.sch.tAir'), `${fmt(r.fiwihex.tTop, 1)} → ${fmt(r.fiwihex.tAfter, 1)} °C`) + row('Q_hr', `${fmt(r.fiwihex.Q / 1000, 1)} kW`)
                    + row('Δp', `${fmt(r.inputs.building.dpFiwihex, 0)} Pa`) + `<div class="tip-ref">${esc(t('ewf.assume'))}</div>`;
                case 'over': return head('ewf.sch.c1', '2.1.4, §2.4.3')
                    + row('U_ref', `${fmt(v.Uref, 2)} m/s`) + row('q_dyn', `${fmt(v.qDyn, 2)} Pa`) + row('p_over', `${fmt(v.pOver, 2)} Pa`);
                case 'ej': return head('ewf.sch.c6', '2.3.1/2.3.2')
                    + row('U_ej / U_ref', v.ratio == null ? '—' : fmt(v.ratio, 2)) + row('Cp_ej', fmt(v.cpEj, 3)) + row('p_ej', `${fmt(v.pEj, 2)} Pa`);
                case 'ventec': return head('ewf.sch.ventec', '§2.2, §2.5')
                    + row('U10', `${fmt(r.inputs.weather.U10, 1)} m/s`) + row('z_dak', `${fmt(r.derived.zRoof, 1)} m`) + row('U_ref', `${fmt(v.Uref, 2)} m/s`)
                    + row(t('ewf.sch.dirInfo'), r.inputs.weather.dir == null ? '—' : `${fmt(r.inputs.weather.dir, 0)}°`);
                case 'recirc': return head('ewf.sch.c7', '§4.5.9') + `<div class="tip-ref">${esc(t('ewf.sch.recircInfo'))}</div>`;
                case 'fanSup': return head('ewf.sch.c5s', '3.5.5/7') + row('Δp', `${fmt(r.pressure.fanSupplyPa, 1)} Pa`) + row('P', `${fmt(r.power.PfanSupply, 0)} W`);
                case 'fanExh': return head('ewf.sch.c5e', '4.5.11/1') + row('Δp', `${fmt(r.pressure.fanExhaustPa, 1)} Pa`) + row('P', `${fmt(r.power.PfanExhaust, 0)} W`);
                case 'tech': return head('ewf.sch.c9', '§3.5.4')
                    + row(t('ewf.sch.water'), `${fmt(c.tWIn, 1)} °C`) + row('q_w', `${fmt(r.derived.qW * 3600, 1)} m³/h`) + row(t('ewf.sch.head'), `${fmt(r.derived.head, 1)} m`)
                    + row(t('ewf.energy.spray'), `${fmt(r.power.Pspray / 1000, 2)} kW`);
                case 'wko': return head('ewf.sch.c8', '§3.1.7.4')
                    + row(t('ewf.sch.coldWell'), `${fmt(c.Q / 1000, 0)} kW`) + row(t('ewf.sch.warmWell'), `${fmt(r.fiwihex.Q / 1000, 0)} kW`)
                    + row(t('ewf.energy.source'), `${fmt(r.power.Psource / 1000, 2)} kW`);
                case 'sun': return head('ewf.sch.sun', '§6.4')
                    + row(t('ewf.sch.alt'), `${fmt(r.rad.sun.alt, 1)}°`) + row(t('ewf.sch.az'), `${fmt(r.rad.sun.az, 0)}°`)
                    + row('Φ', `${fmt(r.rad.beam, 0)} + ${fmt(r.rad.diffuse, 0)} W/m²`) + row('θ', `${fmt(r.rad.theta, 0)}°`);
                case 'floor': {
                    const k = +el.dataset.floor, s = r.pressure.supply[k - 1], e = r.pressure.exhaust[k - 1];
                    return head('ewf.sch.floorTip', `z = ${fmt(s.z, 1)} m`).replace('{k}', k)
                        + row(t('ewf.sch.room'), r.room ? `${fmt(r.room.t, 1)} °C · ${fmt(r.room.rh, 0)} % · ${fmt(r.room.x * 1000, 1)} g/kg` : '—')
                        + row(t('ewf.tbl.supMargin'), `${(s.available >= 0 ? '+' : '') + fmt(s.available, 1)} Pa (${t(s.available >= 0 ? 'ewf.tbl.throttle' : 'ewf.tbl.deficit')})`)
                        + row(t('ewf.tbl.exhMargin'), `${(e.available >= 0 ? '+' : '') + fmt(e.available, 1)} Pa (${t(e.available >= 0 ? 'ewf.tbl.throttle' : 'ewf.tbl.deficit')})`);
                }
                default: return '';
            }
        }

        // ---- Export ----
        svgString(title) {
            const clone = this.svg.cloneNode(true);
            clone.setAttribute('xmlns', SVGNS);
            clone.setAttribute('width', W);
            clone.setAttribute('height', this.g.height);
            clone.setAttribute('font-family', FONT);
            clone.removeAttribute('class');
            clone.querySelectorAll('[tabindex]').forEach((n) => { n.removeAttribute('tabindex'); n.removeAttribute('role'); });
            if (title) {
                const tt = clone.querySelector('title');
                if (tt) tt.textContent = `${title} · ${tt.textContent}`;
            }
            // legenda onderaan in het SVG zelf
            const P = this.P, t = this.ctx.t;
            const y0 = this.g.height;
            clone.setAttribute('height', y0 + 34);
            clone.setAttribute('viewBox', `0 0 ${W} ${y0 + 34}`);
            const leg = document.createElementNS(SVGNS, 'g');
            leg.innerHTML = tag('rect', { x: 0, y: y0, width: W, height: 34, fill: P.bg })
                + tag('rect', { x: 10, y: y0 + 8, width: 180, height: 10, fill: `url(#${this.uid}-scale)` })
                + [-10, 20, 50].map((v) => tag('text', { x: 10 + (v + 10) / 60 * 180, y: y0 + 30, 'text-anchor': 'middle', 'font-size': 9, fill: P.ink2 }, `${v} °C`)).join('')
                + tag('text', { x: 205, y: y0 + 17, 'font-size': 10, fill: P.ink2 }, escT(['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => `${n} ${t('ewf.sch.c' + n)}`).join(' · ')))
                + tag('text', { x: 205, y: y0 + 30, 'font-size': 9, fill: P.muted }, escT(t('ewf.sch.source')));
            clone.appendChild(leg);
            return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        }
        exportSVG(title, download, slug) {
            download(new Blob([this.svgString(title)], { type: 'image/svg+xml' }), `${slug}-ewf-schema.svg`);
        }
        exportPNG(download, slug, onFail) {
            const str = this.svgString();
            const img = new Image();
            const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
            img.onload = () => {
                const s = 2, c = document.createElement('canvas');
                c.width = W * s; c.height = (this.g.height + 34) * s;
                const g2 = c.getContext('2d');
                g2.scale(s, s);
                g2.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                c.toBlob((b) => (b ? download(b, `${slug}-ewf-schema.png`) : onFail()), 'image/png');
            };
            img.onerror = () => { URL.revokeObjectURL(url); onFail(); };
            img.src = url;
        }
    }

    root.EwfSchematic = {
        create: (card, cb) => new Schematic(card, cb),
        tempScale, PAL, T_MIN, T_MAX, inkOn
    };
})(typeof self !== 'undefined' ? self : this);
