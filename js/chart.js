/**
 * chart.js — Mollier h,x-diagram en psychrometrisch diagram (SVG, D3)
 *
 * Mollier: scheefhoekig assenstelsel volgens Mollier (1923). Horizontaal x [g/kg],
 * verticaal y = (h − r₀·x)/c_p,L, zodat de isotherm van 0 °C horizontaal ligt,
 * isothermen licht waaieren en isenthalpen rechte, schuine lijnen zijn.
 * Psychrometrisch (Carrier/ASHRAE): horizontaal t [°C], verticaal x [g/kg].
 */
(function (root) {
    'use strict';

    const P = root.Psychro;
    const PR = root.Processes;
    const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const SVGNS = 'http://www.w3.org/2000/svg';

    // ---- Kleuren per thema (referentielijnen terughoudend, processen krachtig) ----
    const THEMES = {
        light: {
            page: '#ffffff', plot: '#ffffff', fog: '#eef2f6', grid: '#eef1f5', gridMajor: '#dfe5ec',
            iso: '#dce2e9', isoMajor: '#a9b4c1', rh: '#3b82f6', sat: '#1e3a8a', rhText: '#1d4ed8',
            h: '#10b981', hText: '#047857', wb: '#a855f7', wbText: '#7e22ce', rho: '#d97706', rhoText: '#b45309',
            comfort: '#059669', comfortText: '#065f46', axisText: '#475569', axisLine: '#94a3b8', axisTitle: '#1e293b',
            frame: '#94a3b8', text: '#0f172a', muted: '#64748b', hover: '#334155', legendBg: '#ffffff'
        },
        dark: {
            page: '#111827', plot: '#0f172a', fog: '#162033', grid: '#172236', gridMajor: '#223047',
            iso: '#243247', isoMajor: '#46566e', rh: '#60a5fa', sat: '#bfdbfe', rhText: '#93c5fd',
            h: '#34d399', hText: '#6ee7b7', wb: '#c084fc', wbText: '#d8b4fe', rho: '#fbbf24', rhoText: '#fcd34d',
            comfort: '#34d399', comfortText: '#a7f3d0', axisText: '#94a3b8', axisLine: '#475569', axisTitle: '#e2e8f0',
            frame: '#475569', text: '#f1f5f9', muted: '#94a3b8', hover: '#cbd5e1', legendBg: '#0f172a'
        }
    };

    function chartCSS(c) {
        return `
.plot-bg{fill:${c.plot}}
.fog{fill:${c.fog}}
.grid{stroke:${c.grid};stroke-width:1}
.grid.major{stroke:${c.gridMajor}}
.iso{stroke:${c.iso};stroke-width:1;fill:none}
.iso.major{stroke:${c.isoMajor};stroke-width:1.1}
.iso.fogline{stroke-opacity:.75}
.rh{stroke:${c.rh};stroke-width:1.1;fill:none;stroke-opacity:.7}
.rh.minor{stroke-width:.8;stroke-opacity:.4;stroke-dasharray:4 3}
.rh.sat{stroke:${c.sat};stroke-width:2.2;stroke-opacity:1}
.hline{stroke:${c.h};stroke-width:.8;fill:none;stroke-opacity:.55}
.hline.major{stroke-width:1.1;stroke-opacity:.85}
.wb{stroke:${c.wb};stroke-width:1;fill:none;stroke-dasharray:6 3;stroke-opacity:.8}
.rho{stroke:${c.rho};stroke-width:1;fill:none;stroke-dasharray:2 3}
.comfort{fill:${c.comfort};fill-opacity:.1;stroke:${c.comfort};stroke-width:1.4;stroke-dasharray:6 4}
.lbl{font:500 10px ${FONT};paint-order:stroke;stroke:${c.plot};stroke-width:3px;stroke-linejoin:round}
.lbl-rh{fill:${c.rhText}}
.lbl-h{fill:${c.hText}}
.lbl-wb{fill:${c.wbText}}
.lbl-rho{fill:${c.rhoText}}
.lbl-comfort{fill:${c.comfortText};font-weight:600;font-size:11px}
.lbl-fogtxt{fill:${c.muted};font-style:italic;font-size:11px}
.lbl-edge{fill:${c.muted};font-size:9px}
.edge-tick{stroke:${c.muted};stroke-width:1}
.axis text,.tick-lbl{fill:${c.axisText};font:500 11px ${FONT}}
.axis line,.axis path,.tick-line{stroke:${c.axisLine}}
.axis-title{fill:${c.axisTitle};font:600 11.5px ${FONT}}
.axis-title.h{fill:${c.hText}}
.frame{fill:none;stroke:${c.frame};stroke-width:1}
.proc{fill:none;stroke-width:2.75;stroke-linecap:round;stroke-linejoin:round}
.proc.hl{stroke-width:4.5}
.inactive .proc,.inactive .aux,.inactive .auxpt{opacity:.4}
.hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer;pointer-events:stroke}
.aux{fill:none;stroke-width:1.3;stroke-dasharray:4 3}
.auxpt{fill:${c.plot};stroke-width:2}
.pt-lbl.aux-lbl{font:600 10px ${FONT};fill:${c.muted};paint-order:stroke;stroke:${c.plot};stroke-width:3px}
.pt{stroke:${c.plot};stroke-width:2.5;cursor:pointer}
.ptg.drag .pt{cursor:grab}
.ptg.inactive{opacity:.45}
.pt-ring{fill:none;stroke-width:2}
.pt-lbl{font:700 11.5px ${FONT};fill:${c.text};paint-order:stroke;stroke:${c.plot};stroke-width:3.5px;stroke-linejoin:round;pointer-events:none}
.pt-val{font:500 10px ${FONT};fill:${c.muted};paint-order:stroke;stroke:${c.plot};stroke-width:3px;stroke-linejoin:round;pointer-events:none}
.preview{fill:none;stroke-width:2.5;stroke-dasharray:7 5;stroke-linecap:round}
.preview-pt{fill:${c.plot};stroke-width:2.5}
.hover-line{stroke:${c.hover};stroke-width:1;stroke-dasharray:3 3;fill:none;stroke-opacity:.7;pointer-events:none}
.hover-dot{fill:${c.hover};pointer-events:none}
.legend-box{fill:${c.legendBg};fill-opacity:.92;stroke:${c.frame};stroke-width:1}
.legend-txt{font:500 11px ${FONT};fill:${c.text}}
`;
    }

    // ---- Kleine helpers ----
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function niceStep(span, px, minPx, steps) {
        const raw = Math.abs(span) * minPx / Math.max(px, 1);
        return steps.find((s) => s >= raw) || steps[steps.length - 1];
    }
    function seq(a, b, step) {
        const out = [];
        const start = Math.ceil(a / step - 1e-9) * step;
        for (let v = start; v <= b + 1e-9 && out.length < 2000; v += step) out.push(+v.toFixed(6));
        return out;
    }
    const isMult = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
    /** Grote stap: veelvoud van de kleine stap. */
    const majorStep = (span, px, minPx, steps, minor) => niceStep(span, px, minPx, steps.filter((s) => s >= minor && isMult(s, minor)));
    const finite = (q) => isFinite(q[0]) && isFinite(q[1]);
    const lineGen = d3.line().defined(finite);

    class MollierChart {
        constructor(svgEl, callbacks) {
            this.el = svgEl;
            this.svg = d3.select(svgEl);
            this.cb = callbacks || {};
            this.opt = {
                type: 'mollier', p: P.P_STD, theme: 'light',
                range: { tMin: -20, tMax: 50, xMax: 30 },
                layers: { iso: true, rh: true, h: true, wb: false, rho: false, fog: true, comfort: true, edge: false, pw: true, values: false },
                comfort: { tMin: 20, tMax: 26, rhMin: 30, rhMax: 70, xMax: 11.5 },
                fmt: (v, d) => v.toFixed(d),
                labels: {}
            };
            this.data = { scenarios: [], selected: null, highlight: null, preview: null };
            this.transform = d3.zoomIdentity;
            this._raf = 0;
            this._build();
        }

        // ---- Opbouw ----
        _build() {
            const svg = this.svg.attr('xmlns', SVGNS).attr('role', 'img');
            this.styleEl = svg.append('style');
            const defs = svg.append('defs');
            this.clipId = 'plot-clip-' + Math.random().toString(36).slice(2, 8);
            this.clipRect = defs.append('clipPath').attr('id', this.clipId).append('rect');
            this.defs = defs;
            this.gRoot = svg.append('g').attr('class', 'root');
            this.plotBg = this.gRoot.append('rect').attr('class', 'plot-bg');
            const clip = this.gRoot.append('g').attr('clip-path', `url(#${this.clipId})`);
            this.gBg = clip.append('g').attr('class', 'bg');
            this.gData = clip.append('g').attr('class', 'data');
            this.gPreview = clip.append('g').attr('class', 'preview-layer');
            this.gHover = clip.append('g').attr('class', 'hover-layer');
            this.gPoints = clip.append('g').attr('class', 'points');
            this.gAxes = this.gRoot.append('g').attr('class', 'axes');
            this.frame = this.gRoot.append('rect').attr('class', 'frame');
            this.gLegend = this.gRoot.append('g').attr('class', 'legend');

            // Zoomen: Ctrl/⌘ + scroll of knijpen; slepen = pannen
            this.zoom = d3.zoom()
                .scaleExtent([1, 60])
                .filter((ev) => {
                    if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
                    if (ev.type.startsWith('touch')) return ev.touches.length >= 2;   // één vinger scrolt de pagina
                    return !ev.button && !ev.ctrlKey;
                })
                .wheelDelta((ev) => {
                    const d = -ev.deltaY * (ev.deltaMode === 1 ? 0.05 : ev.deltaMode ? 1 : 0.002);
                    return Math.abs(ev.deltaY) < 40 ? d * 4 : d;
                })
                .on('zoom', (ev) => {
                    this.transform = ev.transform;
                    this._schedule();
                    if (this.cb.onZoom) this.cb.onZoom(ev.transform.k);
                });
            svg.call(this.zoom).on('dblclick.zoom', null);
            svg.on('wheel.hint', (ev) => { if (!ev.ctrlKey && !ev.metaKey && this.cb.onWheelHint) this.cb.onWheelHint(); });

            svg.on('pointermove', (ev) => this._onMove(ev));
            svg.on('pointerdown.tap', (ev) => { if (ev.pointerType !== 'mouse') this._onMove(ev); });   // tikken = aflezen
            svg.on('pointerleave', () => this._clearHover());
            svg.on('dblclick', (ev) => {
                const [mx, my] = d3.pointer(ev, this.gRoot.node());
                if (!this._inPlot(mx, my)) return;
                const s = this.unproject(mx, my);
                if (s && this.cb.onDblClick) this.cb.onDblClick(s);
            });
            svg.on('click', (ev) => {
                if (ev.defaultPrevented) return;
                if (ev.target.closest && (ev.target.closest('.ptg') || ev.target.classList.contains('hit'))) return;
                if (this.cb.onSelect) this.cb.onSelect(null);
            });

            this.dragBehavior = d3.drag()
                .container(() => this.gRoot.node())
                .on('start', (ev, d) => { this.dragging = d; this._clearHover(); })
                .on('drag', (ev, d) => this._onDrag(ev, d, 'drag'))
                .on('end', (ev, d) => { this._onDrag(ev, d, 'end'); this.dragging = null; });

            this.ro = new ResizeObserver(() => this._resize());
            this.ro.observe(this.el.parentNode);
        }

        // ---- Configuratie ----
        configure(o) {
            const prev = this.opt;
            this.opt = Object.assign({}, prev, o);
            if (o.layers) this.opt.layers = Object.assign({}, prev.layers, o.layers);
            const resetView = (o.type && o.type !== prev.type) || (o.range && JSON.stringify(o.range) !== JSON.stringify(prev.range));
            this.styleEl.text(chartCSS(THEMES[this.opt.theme] || THEMES.light));
            this._layout();
            if (resetView) this.resetView(false);
            this.render();
        }

        setData(d) {
            Object.assign(this.data, d);
            this.renderData();
        }

        get colors() { return THEMES[this.opt.theme] || THEMES.light; }
        get isMollier() { return this.opt.type === 'mollier'; }

        _layout() {
            const box = this.el.parentNode.getBoundingClientRect();
            this.W = Math.max(320, Math.floor(box.width));
            this.H = Math.max(300, Math.floor(box.height));
            const narrow = this.W < 560;
            this.m = this.isMollier
                ? { top: this.opt.layers.pw ? 34 : 16, right: narrow ? 14 : 22, bottom: 42, left: 56 }
                : { top: 16, right: 48, bottom: 42, left: narrow ? 14 : 22 };
            this.w = this.W - this.m.left - this.m.right;
            this.h = this.H - this.m.top - this.m.bottom;
            this.svg.attr('width', this.W).attr('height', this.H).attr('viewBox', `0 0 ${this.W} ${this.H}`);
            this.gRoot.attr('transform', `translate(${this.m.left},${this.m.top})`);
            for (const r of [this.clipRect, this.plotBg, this.frame]) r.attr('width', this.w).attr('height', this.h);

            const R = this.opt.range;
            if (this.isMollier) {
                this.bx = d3.scaleLinear().domain([0, R.xMax]).range([0, this.w]);
                this.by = d3.scaleLinear().domain([R.tMin, R.tMax]).range([this.h, 0]);
            } else {
                this.bx = d3.scaleLinear().domain([R.tMin, R.tMax]).range([0, this.w]);
                this.by = d3.scaleLinear().domain([0, R.xMax]).range([this.h, 0]);
            }
            this.zoom.extent([[0, 0], [this.w, this.h]]).translateExtent([[0, 0], [this.w, this.h]]);
            this._scales();
        }

        _scales() {
            this.x = this.transform.rescaleX(this.bx);
            this.y = this.transform.rescaleY(this.by);
        }

        _resize() {
            if (!this.bx) return;
            const box = this.el.parentNode.getBoundingClientRect();
            if (Math.floor(box.width) === this.W && Math.floor(box.height) === this.H) return;
            // Houd het zichtbare midden en de zoomfactor vast
            const cx = this.x.invert(this.w / 2), cy = this.y.invert(this.h / 2), k = this.transform.k;
            this._layout();
            const t = d3.zoomIdentity.translate(this.w / 2, this.h / 2).scale(k).translate(-this.bx(cx), -this.by(cy));
            this.svg.call(this.zoom.transform, t);
            this.render();
        }

        _schedule() {
            if (this._raf) return;
            this._raf = requestAnimationFrame(() => { this._raf = 0; this._scales(); this.render(); });
        }

        // ---- Projectie ----
        /** Pixelpositie van (t, x, h). */
        project(t, x, h) {
            if (this.isMollier) return [this.x(x * 1000), this.y((h - P.R0 * x) / P.CP_DA)];
            return [this.x(t), this.y(x * 1000)];
        }
        projectS(s) { return this.project(s.t, s.x, s.h); }
        /** Pixel van (t, x) inclusief mistgebied. */
        projectTX(t, x) { return this.project(t, x, P.hFog(t, x, this.opt.p)); }

        /** Luchttoestand onder een pixel (plotcoördinaten). */
        unproject(px, py) {
            const X = this.x.invert(px), Y = this.y.invert(py), p = this.opt.p;
            try {
                if (this.isMollier) {
                    const x = Math.max(0, X / 1000);
                    return P.fromHx(P.CP_DA * Y + P.R0 * x, x, p);
                }
                return P.state(X, Math.max(0, Y / 1000), p);
            } catch (e) { return null; }
        }

        _inPlot(px, py) { return px >= 0 && px <= this.w && py >= 0 && py <= this.h; }

        view() {
            const [X0, X1] = this.x.domain(), [Y0, Y1] = this.y.domain();
            return { X0, X1, Y0, Y1 };
        }

        /** Temperatuurbereik dat in beeld kan komen (Mollier: incl. mist-isothermen). */
        _tRange() {
            const v = this.view(), p = this.opt.p;
            if (!this.isMollier) return [v.X0, v.X1];
            let tSat = v.Y1;
            try { tSat = P.tFromSatPres(Math.min(P.pwFromX(v.X1 / 1000, p), 0.98 * p)); } catch (e) { /* buiten bereik */ }
            return [clamp(v.Y0 - 1, -99, 199), clamp(Math.max(v.Y1, tSat) + 2, -99, 199)];
        }

        // ---- Tekenen ----
        render() {
            this._scales();
            this.renderBackground();
            this.renderData();
        }

        renderBackground() {
            const g = this.gBg;
            g.selectAll('*').remove();
            this.gAxes.selectAll('*').remove();
            const L = this.opt.layers;
            const layer = (name) => g.append('g').attr('class', 'layer-' + name);
            const lbl = layer('labels');   // labels bovenaan (later naar voren gehaald)

            if (L.fog) this._drawFog(layer('fog'), lbl);
            this._drawXGrid(layer('xgrid'));
            if (L.comfort) this._drawComfort(layer('comfort'), lbl);
            if (L.iso) this._drawIsotherms(layer('iso'));
            if (L.h) this._drawIsenthalps(layer('h'), lbl);
            if (L.wb) this._drawWetBulb(layer('wb'), lbl);
            if (L.rho) this._drawDensity(layer('rho'), lbl);
            if (L.rh) this._drawRH(layer('rh'), lbl);
            if (L.edge && this.isMollier) this._drawEdgeScale(layer('edge'), lbl);
            lbl.raise();
            this._drawAxes();
        }

        _path(g, pts, cls) {
            if (pts.length < 2) return null;
            return g.append('path').attr('class', cls).attr('d', lineGen(pts));
        }

        /** Tekst langs een lijn: positie en hoek op fractie f van de zichtbare punten. */
        _labelOnLine(g, pts, f, text, cls, dy = -3) {
            const vis = pts.filter((q) => q[0] >= 4 && q[0] <= this.w - 4 && q[1] >= 10 && q[1] <= this.h - 4);
            if (vis.length < 2) return;
            const i = clamp(Math.round((vis.length - 1) * f), 1, vis.length - 1);
            const a = vis[i - 1], b = vis[i];
            let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
            if (ang > 90) ang -= 180;
            if (ang < -90) ang += 180;
            g.append('text').attr('class', 'lbl lbl-' + cls)
                .attr('transform', `translate(${b[0]},${b[1]}) rotate(${ang})`)
                .attr('dy', dy).attr('text-anchor', 'middle').text(text);
        }

        _drawFog(g, lbl) {
            const p = this.opt.p, v = this.view(), pts = [];
            if (this.isMollier) {
                const [tLo, tHi] = this._tRange();
                const t0 = Math.max(-99, tLo - 40);
                for (let i = 0; i <= 240; i++) {
                    const t = t0 + (tHi + 5 - t0) * i / 240;
                    const xs = P.satHumRatio(t, p);
                    if (!isFinite(xs)) break;
                    pts.push(this.project(t, xs, P.enthalpy(t, xs)));
                    if (xs * 1000 > v.X1) break;
                }
                if (pts.length < 2) return;
                const last = pts[pts.length - 1];
                pts.push([this.w + 50, last[1]], [this.w + 50, this.h + 50], [pts[0][0], this.h + 50]);
            } else {
                for (let i = 0; i <= 240; i++) {
                    const t = (v.X0 - 10) + (v.X1 - v.X0 + 12) * i / 240;
                    const xs = P.satHumRatio(t, p);
                    if (!isFinite(xs)) { pts.push([this.x(t), -50]); break; }
                    pts.push(this.project(t, xs, 0));
                    if (xs * 1000 > v.Y1) break;
                }
                if (pts.length < 2) return;
                pts.push([pts[pts.length - 1][0], -50], [pts[0][0] - 50, -50]);
            }
            g.append('path').attr('class', 'fog').attr('d', lineGen(pts) + 'Z');
            // Label "mistgebied" in de lege hoek
            const txt = this.opt.labels.fog || 'fog';
            const [lx, ly, anchor] = this.isMollier ? [this.w - 10, this.h - 10, 'end'] : [10, this.h * 0.55, 'start'];
            const s = this.unproject(lx, ly);
            if (s && s.fog) lbl.append('text').attr('class', 'lbl lbl-fogtxt').attr('x', lx).attr('y', ly).attr('text-anchor', anchor).text(txt);
        }

        _drawXGrid(g) {
            const v = this.view(), p = this.opt.p;
            if (this.isMollier) {
                const step = niceStep(v.X1 - v.X0, this.w, 14, [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
                const major = niceStep(v.X1 - v.X0, this.w, 60, [0.5, 1, 2, 5, 10, 20, 50]);
                for (const X of seq(Math.max(0, v.X0), v.X1, step)) {
                    const px = this.x(X);
                    g.append('line').attr('class', 'grid' + (isMult(X, major) ? ' major' : ''))
                        .attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', this.h);
                }
            } else {
                const step = niceStep(v.Y1 - v.Y0, this.h, 14, [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
                const major = niceStep(v.Y1 - v.Y0, this.h, 50, [0.5, 1, 2, 5, 10, 20, 50]);
                for (const Y of seq(Math.max(0, v.Y0), v.Y1, step)) {
                    const x = Y / 1000;
                    let tdp;
                    try { tdp = x > 0 ? P.tFromSatPres(P.pwFromX(x, p)) : -200; } catch (e) { continue; }
                    const py = this.y(Y);
                    g.append('line').attr('class', 'grid' + (isMult(Y, major) ? ' major' : ''))
                        .attr('x1', Math.max(0, this.x(tdp))).attr('x2', this.w).attr('y1', py).attr('y2', py);
                }
            }
        }

        _isoSteps() {
            const v = this.view();
            const span = this.isMollier ? v.Y1 - v.Y0 : v.X1 - v.X0;
            const px = this.isMollier ? this.h : this.w;
            const minor = niceStep(span, px, 9, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
            const major = majorStep(span, px, 34, [0.5, 1, 2, 4, 5, 10, 20, 40, 50, 100], minor);
            return { minor, major };
        }

        _drawIsotherms(g) {
            const p = this.opt.p, v = this.view();
            const { minor, major } = this._isoSteps();
            const [tLo, tHi] = this._tRange();
            for (const t of seq(tLo, tHi, minor)) {
                const cls = 'iso' + (isMult(t, major) ? ' major' : '');
                const xs = P.satHumRatio(t, p);
                if (this.isMollier) {
                    const xEnd = Math.min(xs, (v.X1 + 1) / 1000);
                    this._path(g, [this.project(t, 0, P.enthalpy(t, 0)), this.project(t, xEnd, P.enthalpy(t, xEnd))], cls);
                    if (xs * 1000 < v.X1) {
                        const x2 = (v.X1 + 1) / 1000;
                        this._path(g, [this.project(t, xs, P.enthalpy(t, xs)), this.project(t, x2, P.hFog(t, x2, p))], cls + ' fogline');
                    }
                } else {
                    const xTop = Math.min(xs, (v.Y1 + 1) / 1000);
                    this._path(g, [this.project(t, 0, 0), this.project(t, xTop, 0)], cls);
                }
            }
        }

        _drawRH(g, lbl) {
            const p = this.opt.p, v = this.view(), fmt = this.opt.fmt;
            const k = this.transform.k;
            const list = [];
            for (let rh = 10; rh <= 100; rh += 10) list.push({ rh, minor: false });
            list.push({ rh: 5, minor: true });
            if (k >= 1.8) for (let rh = 15; rh < 100; rh += 10) list.push({ rh, minor: true });
            if (k >= 5) for (let rh = 92; rh < 100; rh += 2) if (rh % 5) list.push({ rh, minor: true });
            const [tLo, tHi] = this.isMollier ? this._tRange() : [v.X0 - 1, v.X1 + 1];
            const N = 260;
            for (const { rh, minor } of list) {
                const pts = [];
                for (let i = 0; i <= N; i++) {
                    const t = tLo + (tHi - tLo) * i / N;
                    const x = P.xFromTRh(t, rh, p);
                    if (!isFinite(x)) break;
                    pts.push(this.project(t, x, P.enthalpy(t, x)));
                    if (this.isMollier ? x * 1000 > v.X1 : x * 1000 > v.Y1) break;
                }
                const cls = 'rh' + (rh === 100 ? ' sat' : minor ? ' minor' : '');
                this._path(g, pts, cls);
                if (!minor || k >= 3) {
                    const f = this.isMollier ? (rh === 100 ? 0.93 : 0.86) : (rh === 100 ? 0.55 : 0.9);
                    this._labelOnLine(lbl, pts, f, `${fmt(rh, 0)}%`, 'rh');
                }
            }
        }

        _drawIsenthalps(g, lbl) {
            const p = this.opt.p, v = this.view(), fmt = this.opt.fmt;
            const tBoil = P.tFromSatPres(0.9 * p);
            const satAt = (h) => {
                const ts = P.solve((t) => P.hSat(t, p), -99, tBoil, h, 60, 1e-6);
                return isFinite(ts) ? { t: ts, x: P.satHumRatio(ts, p) } : null;
            };
            if (this.isMollier) {
                const hA = P.CP_DA * v.Y0 + 2.501 * Math.max(0, v.X0);
                const hB = P.CP_DA * v.Y1 + 2.501 * v.X1;
                const pxPerH = this.h / ((v.Y1 - v.Y0) * P.CP_DA);
                const step = niceStep(1, pxPerH, 22, [0.5, 1, 2, 5, 10, 20, 50]);
                const major = majorStep(1, pxPerH, 48, [1, 2, 5, 10, 20, 50, 100], step);
                const Yof = (h, X) => (h - 2.501 * X) / P.CP_DA;
                for (const h of seq(hA, hB, step)) {
                    const sat = satAt(h);
                    if (!sat || sat.x * 1000 < v.X0) continue;
                    const Xs = sat.x * 1000, X0 = Math.max(0, v.X0 - 1);
                    const pts = [[this.x(X0), this.y(Yof(h, X0))], [this.x(Xs), this.y(Yof(h, Xs))]];
                    const isMajor = isMult(h, major);
                    this._path(g, pts, 'hline' + (isMajor ? ' major' : ''));
                    if (!isMajor) continue;
                    // Label waar de lijn het beeld binnenkomt (boven- of linkerrand)
                    let Xe = (h - P.CP_DA * v.Y1) / 2.501, Ye = v.Y1;
                    if (Xe < v.X0) { Xe = v.X0; Ye = Yof(h, Xe); }
                    if (Xe > Xs || Ye < v.Y0) continue;
                    const d = 26 / Math.hypot(this.x(Xe + 1) - this.x(Xe), this.y(Yof(h, Xe + 1)) - this.y(Yof(h, Xe)));
                    const Xl = Math.min(Xe + d, Xs);
                    const a = [this.x(Xe), this.y(Yof(h, Xe))], b = [this.x(Xl), this.y(Yof(h, Xl))];
                    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
                    if (b[0] < 84 && b[1] < 30) continue;          // vrijhouden voor de titel h [kJ/kg]
                    lbl.append('text').attr('class', 'lbl lbl-h').attr('text-anchor', 'middle').attr('dy', -3)
                        .attr('transform', `translate(${b[0]},${b[1]}) rotate(${ang})`).text(fmt(h, 0));
                }
                lbl.append('text').attr('class', 'axis-title h').attr('x', 8).attr('y', 16).text(this.opt.labels.axisH || 'h [kJ/kg]');
            } else {
                const hA = P.enthalpy(v.X0, 0);
                const hB = P.enthalpy(v.X1, Math.min(v.Y1 / 1000, P.satHumRatio(v.X1, p)));
                const pxPerH = this.w / ((v.X1 - v.X0) * P.CP_DA);
                const step = niceStep(1, pxPerH, 40, [0.5, 1, 2, 5, 10, 20, 50]);
                const major = majorStep(1, pxPerH, 70, [1, 2, 5, 10, 20, 50, 100], step);
                for (const h of seq(hA, hB, step)) {
                    const sat = satAt(h);
                    if (!sat) continue;
                    const pts = [];
                    for (let i = 0; i <= 6; i++) {
                        const x = sat.x * (1 - i / 6);
                        pts.push(this.project(P.tFromHx(h, x), x, h));
                    }
                    const isMajor = isMult(h, major);
                    this._path(g, pts, 'hline' + (isMajor ? ' major' : ''));
                    if (!isMajor) continue;
                    const a = pts[0], b = pts[1];
                    if (!this._inPlot(a[0], a[1])) continue;
                    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
                    lbl.append('text').attr('class', 'lbl lbl-h').attr('text-anchor', 'end').attr('dy', 3)
                        .attr('transform', `translate(${a[0] - 5},${a[1] - 4}) rotate(${ang})`).text(fmt(h, 0));
                }
                lbl.append('text').attr('class', 'axis-title h').attr('x', 8).attr('y', 16).text(this.opt.labels.axisH || 'h [kJ/kg]');
            }
        }

        _drawWetBulb(g, lbl) {
            const p = this.opt.p, fmt = this.opt.fmt;
            const { major } = this._isoSteps();
            const step = Math.max(major, 1);
            const [tLo, tHi] = this._tRange();
            for (const twb of seq(tLo - 20, tHi, step)) {
                const ws = P.satHumRatio(twb, p);
                if (!isFinite(ws)) break;
                const t0 = twb >= 0 ? twb + (2501 - 2.326 * twb) * ws / 1.006 : twb + (2830 - 0.24 * twb) * ws / 1.006;
                const pts = [];
                for (let i = 0; i <= 6; i++) {
                    const t = twb + (t0 - twb) * i / 6;
                    const x = Math.max(0, P.xFromTwb(t, twb, p));
                    pts.push(this.project(t, x, P.enthalpy(t, x)));
                }
                this._path(g, pts, 'wb');
                this._labelOnLine(lbl, pts, 0.2, fmt(twb, 0) + '°', 'wb', 10);
            }
        }

        _drawDensity(g, lbl) {
            const p = this.opt.p, v = this.view(), fmt = this.opt.fmt;
            const K = 273.15;
            if (this.isMollier) {
                // Lijnen van constante dichtheid ρ [kg/m³]
                const rhoOf = (t) => p / (P.R_DA * (t + K));
                const rA = rhoOf(v.Y1), rB = rhoOf(v.Y0);
                const step = niceStep(rB - rA, this.h, 42, [0.005, 0.01, 0.02, 0.05, 0.1, 0.2]);
                for (const rho of seq(rA, rB, step)) {
                    const pts = [];
                    for (let i = 0; i <= 16; i++) {
                        const x = (v.X1 / 1000) * 1.05 * i / 16;
                        const t = (1 + x) * p / (P.R_DA * rho * (1 + 1.607858 * x)) - K;
                        if (x > P.satHumRatio(t, p)) break;
                        pts.push(this.project(t, x, P.enthalpy(t, x)));
                    }
                    this._path(g, pts, 'rho');
                    this._labelOnLine(lbl, pts, 0.12, fmt(rho, step < 0.01 ? 3 : 2), 'rho');
                }
            } else {
                // Lijnen van constant specifiek volume v [m³/kg]
                const vOf = (t, x) => P.specificVolume(t, x, p);
                const vA = vOf(v.X0, 0), vB = vOf(v.X1, Math.min(v.Y1 / 1000, P.satHumRatio(v.X1, p)));
                const step = niceStep(vB - vA, this.w, 48, [0.005, 0.01, 0.02, 0.05, 0.1]);
                for (const vv of seq(vA, vB, step)) {
                    const pts = [];
                    for (let i = 0; i <= 16; i++) {
                        const x = (v.Y1 / 1000) * 1.05 * i / 16;
                        const t = vv * p / (P.R_DA * (1 + 1.607858 * x)) - K;
                        if (x > P.satHumRatio(t, p)) break;
                        pts.push(this.project(t, x, 0));
                    }
                    this._path(g, pts, 'rho');
                    this._labelOnLine(lbl, pts, 0.1, fmt(vv, step < 0.01 ? 3 : 2), 'rho', 10);
                }
            }
        }

        _drawComfort(g, lbl) {
            const c = this.opt.comfort, p = this.opt.p;
            if (!(c.tMax > c.tMin && c.rhMax > c.rhMin)) return;
            const xCap = c.xMax > 0 ? c.xMax / 1000 : Infinity;
            const at = (t, rh) => { const x = Math.min(P.xFromTRh(t, rh, p), xCap); return this.project(t, x, P.enthalpy(t, x)); };
            const n = 16, pts = [];
            for (let i = 0; i <= n; i++) pts.push(at(c.tMin + (c.tMax - c.tMin) * i / n, c.rhMin));
            for (let i = 1; i <= n; i++) pts.push(at(c.tMax, c.rhMin + (c.rhMax - c.rhMin) * i / n));
            for (let i = 1; i <= n; i++) pts.push(at(c.tMax - (c.tMax - c.tMin) * i / n, c.rhMax));
            for (let i = 1; i < n; i++) pts.push(at(c.tMin, c.rhMax - (c.rhMax - c.rhMin) * i / n));
            g.append('path').attr('class', 'comfort').attr('d', lineGen(pts) + 'Z');
            const cx = d3.mean(pts, (q) => q[0]), cy = d3.mean(pts, (q) => q[1]);
            if (this._inPlot(cx, cy)) {
                lbl.append('text').attr('class', 'lbl lbl-comfort').attr('x', cx).attr('y', cy + 3)
                    .attr('text-anchor', 'middle').text(this.opt.labels.comfort || 'Comfort');
            }
        }

        /** Randmaatstaf Δh/Δx met pool in (x = 0, t = 0 °C). */
        _drawEdgeScale(g, lbl) {
            const ox = this.x(0), oy = this.y(0);
            if (!this._inPlot(ox, oy)) return;
            const fmt = this.opt.fmt;
            const gammas = [-4000, -2000, -1000, 0, 1000, 2000, 2500, 3000, 4000, 6000, 10000, 20000];
            for (const gm of gammas) {
                const dx = this.x(1) - this.x(0);
                const dy = this.y((gm - P.R0) * 0.001 / P.CP_DA) - this.y(0);
                const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
                // Snijpunt van de straal met de plotrand
                const ts = [];
                if (ux > 0) ts.push((this.w - ox) / ux);
                if (uy > 0) ts.push((this.h - oy) / uy);
                if (uy < 0) ts.push(-oy / uy);
                const tEnd = Math.min(...ts);
                const ex = ox + ux * tEnd, ey = oy + uy * tEnd;
                g.append('line').attr('class', 'edge-tick')
                    .attr('x1', ex - ux * 12).attr('y1', ey - uy * 12).attr('x2', ex).attr('y2', ey);
                const lx = ex - ux * 20, ly = ey - uy * 20;
                lbl.append('text').attr('class', 'lbl lbl-edge').attr('x', lx).attr('y', ly + 3)
                    .attr('text-anchor', ex >= this.w - 1 ? 'end' : 'middle').text(fmt(gm, 0));
            }
            lbl.append('text').attr('class', 'lbl lbl-edge').attr('x', this.w - 6).attr('y', 12)
                .attr('text-anchor', 'end').text(this.opt.labels.edge || 'Δh/Δx [kJ/kg]');
        }

        _drawAxes() {
            const g = this.gAxes, fmt = this.opt.fmt, lab = this.opt.labels, v = this.view(), p = this.opt.p;
            const decimals = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
            if (this.isMollier) {
                // Onder: x [g/kg]
                const xStep = niceStep(v.X1 - v.X0, this.w, 55, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
                const ax = d3.axisBottom(this.x).tickValues(seq(Math.max(0, v.X0), v.X1, xStep)).tickFormat((d) => fmt(d, decimals(xStep))).tickSizeOuter(0);
                g.append('g').attr('class', 'axis').attr('transform', `translate(0,${this.h})`).call(ax);
                g.append('text').attr('class', 'axis-title').attr('x', this.w / 2).attr('y', this.h + 36).attr('text-anchor', 'middle').text(lab.axisX || 'x [g/kg]');
                // Links: isothermen op de linkerrand (exact, want isothermen waaieren)
                const { major } = this._isoSteps();
                const X0 = Math.max(0, v.X0) / 1000;
                const [tLo, tHi] = this._tRange();
                for (const t of seq(tLo, tHi, major)) {
                    const [, py] = this.projectTX(t, X0);
                    if (py < -1 || py > this.h + 1) continue;
                    g.append('line').attr('class', 'tick-line').attr('x1', -5).attr('x2', 0).attr('y1', py).attr('y2', py);
                    g.append('text').attr('class', 'tick-lbl').attr('x', -8).attr('y', py + 4).attr('text-anchor', 'end').text(fmt(t, decimals(major)));
                }
                g.append('text').attr('class', 'axis-title').attr('transform', `translate(-42,${this.h / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(lab.axisT || 't [°C]');
                // Boven: dampspanning p_w [hPa]
                if (this.opt.layers.pw) {
                    const pwA = P.pwFromX(Math.max(0, v.X0) / 1000, p) / 100, pwB = P.pwFromX(v.X1 / 1000, p) / 100;
                    const step = niceStep(pwB - pwA, this.w, 42, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]);
                    for (const pw of seq(pwA, pwB, step)) {
                        if (pw === 0) continue;
                        const X = P.xFromPw(pw * 100, p) * 1000;
                        const px = this.x(X);
                        if (px < -1 || px > this.w + 1) continue;
                        g.append('line').attr('class', 'tick-line').attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', -4);
                        g.append('text').attr('class', 'tick-lbl').attr('x', px).attr('y', -8).attr('text-anchor', 'middle').text(fmt(pw, decimals(step)));
                    }
                    g.append('text').attr('class', 'tick-lbl').attr('x', -this.m.left + 4).attr('y', -8).attr('font-size', 10).text(lab.axisPw || 'p_w [hPa]');
                }
            } else {
                const tStep = niceStep(v.X1 - v.X0, this.w, 45, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
                const ax = d3.axisBottom(this.x).tickValues(seq(v.X0, v.X1, tStep)).tickFormat((d) => fmt(d, decimals(tStep))).tickSizeOuter(0);
                g.append('g').attr('class', 'axis').attr('transform', `translate(0,${this.h})`).call(ax);
                g.append('text').attr('class', 'axis-title').attr('x', this.w / 2).attr('y', this.h + 36).attr('text-anchor', 'middle').text(lab.axisTPsy || 't [°C]');
                const xStep = niceStep(v.Y1 - v.Y0, this.h, 32, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
                const ay = d3.axisRight(this.y).tickValues(seq(Math.max(0, v.Y0), v.Y1, xStep)).tickFormat((d) => fmt(d, decimals(xStep))).tickSizeOuter(0);
                g.append('g').attr('class', 'axis').attr('transform', `translate(${this.w},0)`).call(ay);
                g.append('text').attr('class', 'axis-title').attr('transform', `translate(${this.w + 40},${this.h / 2}) rotate(90)`).attr('text-anchor', 'middle').text(lab.axisXPsy || 'x [g/kg]');
            }
        }

        // ---- Data ----
        _marker(color) {
            const id = 'arr-' + color.replace(/[^a-z0-9]/gi, '');
            if (this.defs.select('#' + id).empty()) {
                this.defs.append('marker').attr('id', id).attr('viewBox', '0 0 10 10')
                    .attr('refX', 8.5).attr('refY', 5).attr('markerWidth', 5.5).attr('markerHeight', 5.5)
                    .attr('orient', 'auto-start-reverse').attr('markerUnits', 'strokeWidth')
                    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', color);
            }
            return `url(#${id})`;
        }

        renderData() {
            if (!this.x) return;
            const g = this.gData;
            g.selectAll('*').remove();
            const { scenarios, selected, highlight } = this.data;
            const fmt = this.opt.fmt, lab = this.opt.labels;
            const points = [];
            const order = scenarios.filter((s) => s.visible !== false).sort((a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0));

            for (const sc of order) {
                const gs = g.append('g').attr('class', sc.active ? 'scn active' : 'scn inactive');
                for (const st of sc.steps) {
                    if (!st.ok) continue;
                    const pts = st.path.map((q) => this.project(q.t, q.x, q.h));
                    const isHl = highlight && highlight.scnId === sc.id && highlight.stepId === st.step.id;
                    const lenPx = d3.sum(pts.slice(1), (q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
                    const path = this._path(gs, pts, 'proc' + (isHl ? ' hl' : ''));
                    if (path) {
                        path.attr('stroke', sc.color).attr('data-scn', sc.id).attr('data-step', st.step.id);
                        if (lenPx > 16) path.attr('marker-end', this._marker(sc.color));
                    }
                    // Onzichtbaar breed pad om hover/klik te vangen. Alleen melden bij een échte wissel:
                    // opnieuw tekenen onder de cursor zou anders een hover-lus veroorzaken.
                    const hit = this._path(gs, pts, 'hit');
                    if (hit) {
                        const h = { scnId: sc.id, stepId: st.step.id };
                        hit.on('pointerenter', () => this._hoverStep(h))
                            .on('pointerleave', () => this._hoverStep(null))
                            .on('click', (ev) => { ev.stopPropagation(); this.cb.onSelect && this.cb.onSelect(h); });
                    }
                    for (const ax of st.aux) {
                        if (ax.from) {
                            const aPts = PR.line(ax.from, ax.state, this.opt.p, 6).map((q) => this.project(q.t, q.x, q.h));
                            this._path(gs, aPts, 'aux').attr('stroke', sc.color);
                        }
                        const [ax0, ay0] = this.projectS(ax.state);
                        const role = ax.role;
                        points.push({
                            key: `${sc.id}:${st.step.id}:${role}`, px: ax0, py: ay0, color: sc.color, aux: true,
                            active: sc.active, state: ax.state, label: (lab.aux && lab.aux[role]) || '',
                            drag: !!(ax.drag && sc.active), ref: { scnId: sc.id, stepId: st.step.id, role }
                        });
                    }
                }
                sc.states.forEach((s, i) => {
                    const [px, py] = this.projectS(s);
                    const stepType = i > 0 ? sc.stepTypeOf(s.stepId) : null;
                    points.push({
                        key: `${sc.id}:${s.n}`, px, py, color: sc.color, active: sc.active, state: s, n: s.n,
                        label: String(s.n), scnId: sc.id,
                        selected: !!(selected && selected.scnId === sc.id && selected.n === s.n),
                        drag: sc.active && (i === 0 || stepType === 'point'),
                        ref: i === 0 ? { scnId: sc.id, role: 'start' } : { scnId: sc.id, stepId: s.stepId, role: 'end' },
                        values: this.opt.layers.values ? `${fmt(s.t, 1)} °C · ${fmt(s.rh, 0)}%` : ''
                    });
                });
            }
            this._renderPoints(points);
            this._renderPreview();
            this._renderLegend(order);
            this._points = points;
        }

        /** Plaats puntlabels gretig op de eerste vrije positie rond het punt. */
        _placeLabels(points) {
            const boxes = points.filter((d) => isFinite(d.px)).map((d) => ({ x0: d.px - 7, x1: d.px + 7, y0: d.py - 7, y1: d.py + 7 }));
            const hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
            const cands = [[9, -8, 'start'], [-9, -8, 'end'], [9, 15, 'start'], [-9, 15, 'end'], [0, -13, 'middle'], [0, 22, 'middle']];
            // Actieve scenario's en hoofdpunten eerst
            const order = points.slice().sort((a, b) => (b.active - a.active) || (a.aux - b.aux));
            for (const d of order) {
                if (!isFinite(d.px) || !d.label) { d.lx = 9; d.ly = -8; d.anchor = 'start'; continue; }
                const w = d.label.length * (d.aux ? 6.2 : 7.2) + 2, hgt = 12;
                let pick = cands[d.aux ? 3 : 0];
                for (const c of (d.aux ? [cands[3], cands[1], cands[2], cands[0], cands[5]] : cands)) {
                    const x0 = d.px + c[0] - (c[2] === 'end' ? w : c[2] === 'middle' ? w / 2 : 0);
                    const b = { x0, x1: x0 + w, y0: d.py + c[1] - hgt + 2, y1: d.py + c[1] + 2 };
                    if (!hit(b)) { pick = c; boxes.push(b); break; }
                }
                [d.lx, d.ly, d.anchor] = pick;
            }
        }

        _renderPoints(points) {
            this._placeLabels(points);
            const sel = this.gPoints.selectAll('g.ptg').data(points, (d) => d.key);
            sel.exit().remove();
            const enter = sel.enter().append('g').attr('class', 'ptg');
            enter.append('circle').attr('class', 'pt-ring');
            enter.append('circle').attr('class', 'pt');
            enter.append('text').attr('class', 'pt-lbl');
            enter.append('text').attr('class', 'pt-val');
            const all = enter.merge(sel);
            all.attr('class', (d) => 'ptg' + (d.drag ? ' drag' : '') + (d.active ? '' : ' inactive'))
                .attr('transform', (d) => `translate(${d.px},${d.py})`)
                .attr('display', (d) => (isFinite(d.px) && isFinite(d.py) ? null : 'none'));
            all.select('.pt')
                .attr('r', (d) => (d.aux ? 4.5 : d.active ? 6 : 5))
                .attr('fill', (d) => (d.aux ? this.colors.plot : d.color))
                .attr('stroke', (d) => (d.aux ? d.color : this.colors.plot))
                .attr('stroke-width', (d) => (d.aux ? 2 : 2.5));
            all.select('.pt-ring').attr('r', 11).attr('stroke', (d) => d.color).attr('display', (d) => (d.selected ? null : 'none'));
            all.select('.pt-lbl').attr('x', (d) => d.lx).attr('y', (d) => d.ly).attr('text-anchor', (d) => d.anchor)
                .attr('class', (d) => 'pt-lbl' + (d.aux ? ' aux-lbl' : '')).text((d) => d.label);
            all.select('.pt-val').attr('x', (d) => d.lx).attr('y', (d) => d.ly + 12).attr('text-anchor', (d) => d.anchor).text((d) => d.values || '');
            all.on('click', (ev, d) => {
                ev.stopPropagation();
                if (!d.aux && this.cb.onSelect) this.cb.onSelect({ scnId: d.scnId, n: d.n });
            });
            all.on('pointerenter', (ev, d) => { if (!this.dragging && this.cb.onHover) this.cb.onHover({ state: d.state, point: d, px: d.px, py: d.py }); });
            all.filter((d) => d.drag).call(this.dragBehavior);
            all.filter((d) => !d.drag).on('.drag', null);
        }

        _renderPreview() {
            const g = this.gPreview;
            g.selectAll('*').remove();
            const pv = this.data.preview;
            if (!pv || !pv.path) return;
            const pts = pv.path.map((q) => this.project(q.t, q.x, q.h));
            const path = this._path(g, pts, 'preview');
            if (path) path.attr('stroke', pv.color);
            const [px, py] = this.projectS(pv.state);
            g.append('circle').attr('class', 'preview-pt').attr('cx', px).attr('cy', py).attr('r', 5.5).attr('stroke', pv.color);
        }

        _renderLegend(scns) {
            const g = this.gLegend;
            g.selectAll('*').remove();
            if (scns.length < 2) return;
            const lh = 18, pad = 8;
            const items = scns.slice().sort((a, b) => a.index - b.index);
            const inner = g.append('g');
            items.forEach((s, i) => {
                const row = inner.append('g').attr('transform', `translate(${pad},${pad + i * lh + 9})`);
                row.append('line').attr('x1', 0).attr('x2', 18).attr('stroke', s.color).attr('stroke-width', 2.75).attr('stroke-linecap', 'round');
                row.append('text').attr('class', 'legend-txt').attr('x', 25).attr('y', 4).text(s.name);
            });
            const bb = inner.node().getBBox();
            const bw = bb.width + pad * 2, bh = items.length * lh + pad * 2 - 4;
            g.insert('rect', ':first-child').attr('class', 'legend-box').attr('width', bw).attr('height', bh).attr('rx', 6);
            const [lx, ly] = this.isMollier ? [this.w - bw - 10, this.h - bh - 30] : [10, 28];
            g.attr('transform', `translate(${lx},${ly})`);
        }

        // ---- Interactie ----
        _hoverStep(h) {
            const cur = this.data.highlight;
            if (this.dragging || (h && cur && h.scnId === cur.scnId && h.stepId === cur.stepId) || (!h && !cur)) return;
            if (this.cb.onHoverStep) this.cb.onHoverStep(h);
        }

        /** Markeer een processtap zonder opnieuw te tekenen. */
        setHighlight(h) {
            this.data.highlight = h;
            this.gData.selectAll('path.proc').classed('hl', function () {
                return !!h && this.getAttribute('data-scn') === h.scnId && this.getAttribute('data-step') === h.stepId;
            });
        }

        _onMove(ev) {
            if (this.dragging) return;
            const [mx, my] = d3.pointer(ev, this.gRoot.node());
            if (!this._inPlot(mx, my)) { this._clearHover(); return; }
            if (ev.target.closest && ev.target.closest('.ptg')) return;
            const s = this.unproject(mx, my);
            if (!s) { this._clearHover(); return; }
            this._drawHover(s, mx, my);
            if (this.cb.onHover) this.cb.onHover({ state: s, point: null, px: mx, py: my });
        }

        _clearHover() {
            this.gHover.selectAll('*').remove();
            if (this.cb.onHover) this.cb.onHover(null);
        }

        /** Hulplijnen door de cursor: x, t, h en RH. */
        _drawHover(s, mx, my) {
            const g = this.gHover, p = this.opt.p, v = this.view();
            g.selectAll('*').remove();
            const xs = P.satHumRatio(s.t, p);
            // Constante x
            if (this.isMollier) this._path(g, [[mx, 0], [mx, this.h]], 'hover-line');
            else {
                let tdp = v.X0;
                try { tdp = s.x > 0 ? P.tFromSatPres(P.pwFromX(Math.min(s.x, 0.5), p)) : v.X0; } catch (e) { /* laat */ }
                this._path(g, [[Math.max(0, this.x(tdp)), my], [this.w, my]], 'hover-line');
            }
            // Isotherm
            if (this.isMollier) {
                const x2 = (v.X1 + 1) / 1000, xe = Math.min(xs, x2);
                const pts = [this.projectTX(s.t, 0), this.projectTX(s.t, xe)];
                if (xs < x2) pts.push(this.projectTX(s.t, x2));
                this._path(g, pts, 'hover-line');
            } else {
                this._path(g, [this.project(s.t, 0, 0), this.project(s.t, Math.min(xs, 1), 0)], 'hover-line');
            }
            // RH-kromme
            if (!s.fog && s.rh > 0.5) {
                const pts = [];
                const [tLo, tHi] = this.isMollier ? this._tRange() : [v.X0 - 1, v.X1 + 1];
                for (let i = 0; i <= 120; i++) {
                    const t = tLo + (tHi - tLo) * i / 120;
                    const x = P.xFromTRh(t, s.rh, p);
                    if (!isFinite(x)) break;
                    pts.push(this.project(t, x, P.enthalpy(t, x)));
                    if (this.isMollier ? x * 1000 > v.X1 : x * 1000 > v.Y1) break;
                }
                this._path(g, pts, 'hover-line');
            }
            g.append('circle').attr('class', 'hover-dot').attr('cx', mx).attr('cy', my).attr('r', 3);
        }

        _onDrag(ev, d, phase) {
            const px = clamp(ev.x, 0, this.w), py = clamp(ev.y, 0, this.h);
            const s = this.unproject(px, py);
            if (!s) return;
            if (this.cb.onDrag) this.cb.onDrag(d.ref, s, phase);
            if (this.cb.onHover) this.cb.onHover(phase === 'end' ? null : { state: s, point: d, px, py, dragging: true });
        }

        // ---- Zoom ----
        zoomBy(f) { this.svg.transition().duration(250).call(this.zoom.scaleBy, f); }
        resetView(animate = true) {
            (animate ? this.svg.transition().duration(300) : this.svg).call(this.zoom.transform, d3.zoomIdentity);
            this.transform = d3.zoomIdentity;
            this._scales();
        }
        /** Zoom naar alle zichtbare punten van de scenario's. */
        fitToData() {
            const pts = [];
            for (const sc of this.data.scenarios) {
                if (sc.visible === false) continue;
                for (const s of sc.states) pts.push(this._baseProject(s));
                for (const st of sc.steps) if (st.ok) for (const a of st.aux) pts.push(this._baseProject(a.state));
            }
            if (!pts.length) { this.resetView(); return; }
            const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const bw = Math.max(x1 - x0, 40), bh = Math.max(y1 - y0, 40);
            const k = clamp(Math.min(this.w / (bw * 1.35), this.h / (bh * 1.35)), 1, 60);
            const t = d3.zoomIdentity.translate(this.w / 2, this.h / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
            this.svg.transition().duration(400).call(this.zoom.transform, t);
        }
        _baseProject(s) {
            if (this.isMollier) return [this.bx(s.x * 1000), this.by((s.h - P.R0 * s.x) / P.CP_DA)];
            return [this.bx(s.t), this.by(s.x * 1000)];
        }

        // ---- Export ----
        /** Zelfstandige SVG (met ingebedde stijl), zonder hover-hulplijnen. */
        toSVGString(title) {
            const clone = this.el.cloneNode(true);
            clone.querySelectorAll('.hover-layer, .preview-layer, .hit').forEach((n) => n.remove());
            clone.setAttribute('xmlns', SVGNS);
            clone.setAttribute('width', this.W);
            clone.setAttribute('height', this.H);
            const bg = document.createElementNS(SVGNS, 'rect');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', this.colors.page);
            clone.insertBefore(bg, clone.firstChild);
            if (title) {
                const tt = document.createElementNS(SVGNS, 'title');
                tt.textContent = title;
                clone.insertBefore(tt, clone.firstChild);
            }
            return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        }

        toPNGBlob(scale = 2) {
            const svgStr = this.toSVGString();
            return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
                img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = this.W * scale;
                    c.height = this.H * scale;
                    const ctx = c.getContext('2d');
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG'))), 'image/png');
                };
                img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
                img.src = url;
            });
        }
    }

    root.MollierChart = MollierChart;
    root.MollierChart.THEMES = THEMES;
})(typeof self !== 'undefined' ? self : this);
