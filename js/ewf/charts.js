/**
 * charts.js — D3-grafieken voor de EWF-weergave (stijl afgestemd op chart.js)
 *
 *  - Cascadeprofiel: small multiples met gedeelde hoogte-as (temperatuur | x | RV), crosshair
 *  - Drukbalans: per verdieping balken rond een gecentreerde nul-as (toevoer | afvoer) + opbouwtabel
 *  - Zonneschoorsteen: θ_glas, θ_lucht, θ_wand over de hoogte met grens 80 °C
 *  - Energie: thermisch (polariteit) en elektrisch (EWF vs conventionele LBK)
 * Kleuren via CSS-variabelen in css/ewf.css (--ewf-s1…s3, --ewf-cool, --ewf-heat, --ewf-crit).
 */
(function (root) {
    'use strict';

    const d3 = root.d3;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    /** Nieuw SVG in el met responsieve breedte. */
    function frame(el, height, label) {
        el.querySelectorAll(':scope > svg.ewf-ch, :scope > .ewf-ctip').forEach((n) => n.remove());
        const w = Math.max(300, Math.floor(el.clientWidth || 640));
        const svg = d3.select(el).append('svg').attr('class', 'ewf-ch').attr('width', w).attr('height', height)
            .attr('viewBox', `0 0 ${w} ${height}`).attr('role', 'img').attr('aria-label', label);
        const tip = d3.select(el).append('div').attr('class', 'ewf-ctip').attr('hidden', true);
        return { svg, w, h: height, tip };
    }

    function legend(items, esc) {
        return `<div class="ewf-legend-row">${items.map(([cls, txt, dash]) => `<span class="lg"><i class="${cls}${dash ? ' dash' : ''}"></i>${esc(txt)}</span>`).join('')}</div>`;
    }

    function showTip(tip, el, html, x, y) {
        tip.html(html).attr('hidden', null);
        const node = tip.node(), W = el.clientWidth;
        const tw = node.offsetWidth, th = node.offsetHeight;
        node.style.left = (x + 14 + tw > W ? Math.max(0, x - tw - 14) : x + 14) + 'px';
        node.style.top = Math.max(0, y - th / 2) + 'px';
    }

    function grid(g, scale, axis, size, ticks) {
        const gg = g.append('g').attr('class', 'grid');
        const vals = scale.ticks(ticks);
        if (axis === 'x') vals.forEach((v) => gg.append('line').attr('x1', scale(v)).attr('x2', scale(v)).attr('y1', 0).attr('y2', size));
        else vals.forEach((v) => gg.append('line').attr('y1', scale(v)).attr('y2', scale(v)).attr('x1', 0).attr('x2', size));
    }

    // =====================================================================
    // Cascadeprofiel
    // =====================================================================
    function profile(pane, r, c) {
        const { t, fmt, esc } = c;
        const prof = r.cascade.profile, H = r.derived.H;
        const hasW = r.cascade.active;
        pane.innerHTML = `<div class="ewf-chart-head"><div class="ewf-chart-title">${esc(t('ewf.ch.profileTitle'))}</div>`
            + legend([['s1', t('ewf.ch.tWater')], ['s2', t('ewf.ch.tAir')]].filter((x, i) => hasW || i === 1), esc) + `</div>`
            + `<div class="ewf-chart ewf-chart-profile"></div><p class="hint ewf-src">${esc(t('ewf.ch.profileSrc'))}</p>`;
        const el = pane.querySelector('.ewf-chart-profile');
        const { svg, w, h, tip } = frame(el, 380, t('ewf.ch.profileTitle'));
        const m = { t: 28, r: 14, b: 34, l: 50 };
        const pw = w - m.l - m.r, ph = h - m.t - m.b, gap = 18;
        const widths = [0.44, 0.28, 0.28].map((f) => f * (pw - 2 * gap));
        const x0s = [0, widths[0] + gap, widths[0] + widths[1] + 2 * gap];
        const y = d3.scaleLinear().domain([0, H]).range([ph, 0]);
        const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
        const temps = prof.flatMap((q) => (hasW ? [q.t, q.tw] : [q.t]));
        const panels = [
            { key: 't', title: t('ewf.ch.pTemp'), dom: d3.extent(temps), lines: hasW ? [['tw', 's1'], ['t', 's2']] : [['t', 's2']], f: (v) => v },
            { key: 'x', title: t('ewf.ch.pX'), dom: d3.extent(prof, (q) => q.x * 1000), lines: [['x', 's1']], f: (v) => v * 1000 },
            { key: 'rh', title: t('ewf.ch.pRh'), dom: [Math.min(...prof.map((q) => q.rh)), 100], lines: [['rh', 's1']], f: (v) => v }
        ];
        // y-as
        grid(g, y, 'y', pw, 6);
        g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
        g.append('text').attr('class', 'axis-title').attr('transform', `translate(${-38},${ph / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(t('ewf.ch.height'));
        const xs = [];
        panels.forEach((p, i) => {
            const pad = Math.max(0.5, (p.dom[1] - p.dom[0]) * 0.08);
            const x = d3.scaleLinear().domain([p.dom[0] - pad, p.dom[1] + pad]).nice(4).range([0, widths[i]]);
            if (p.key === 'rh') x.domain([Math.max(0, x.domain()[0]), 100]);
            xs.push(x);
            const gp = g.append('g').attr('transform', `translate(${x0s[i]},0)`);
            grid(gp, x, 'x', ph, 4);
            gp.append('rect').attr('class', 'frame').attr('width', widths[i]).attr('height', ph);
            gp.append('g').attr('class', 'axis').attr('transform', `translate(0,${ph})`).call(d3.axisBottom(x).ticks(widths[i] < 140 ? 3 : 5).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
            gp.append('text').attr('class', 'panel-title').attr('x', 0).attr('y', -10).text(p.title);
            for (const [k, cls] of p.lines) {
                const line = d3.line().defined((q) => q[k] != null && isFinite(q[k])).x((q) => x(p.f(q[k]))).y((q) => y(q.z));
                gp.append('path').attr('class', 'ln ' + cls).attr('d', line(prof));
            }
        });
        // sproeihoogte
        if (hasW) {
            g.append('line').attr('class', 'ref').attr('x1', 0).attr('x2', widths[0]).attr('y1', y(H)).attr('y2', y(H));
            g.append('text').attr('class', 'ref-lbl').attr('x', widths[0] - 2).attr('y', y(H) + 12).attr('text-anchor', 'end').text(t('ewf.ch.spray'));
        }
        // crosshair
        const hov = g.append('g').attr('class', 'hover').style('display', 'none');
        hov.append('line').attr('class', 'xh').attr('x1', 0).attr('x2', pw);
        const dots = [];
        panels.forEach((p, i) => p.lines.forEach(([k, cls]) => dots.push({ i, k, cls, f: p.f, c: hov.append('circle').attr('class', 'dot ' + cls).attr('r', 4) })));
        g.append('rect').attr('class', 'overlay').attr('width', pw).attr('height', ph)
            .on('pointermove', (ev) => {
                const [mx, my] = d3.pointer(ev);
                const z = y.invert(my);
                const q = prof.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
                hov.style('display', null).select('.xh').attr('y1', y(q.z)).attr('y2', y(q.z));
                for (const d of dots) {
                    const v = q[d.k];
                    d.c.style('display', v == null ? 'none' : null).attr('cx', x0s[d.i] + (v == null ? 0 : xs[d.i](d.f(v)))).attr('cy', y(q.z));
                }
                showTip(tip, el, `<div class="tip-h">z = ${fmt(q.z, 1)} m</div>`
                    + `<div><span>${esc(t('ewf.ch.tAir'))}</span><b>${fmt(q.t, 2)} °C</b></div>`
                    + (q.tw != null ? `<div><span>${esc(t('ewf.ch.tWater'))}</span><b>${fmt(q.tw, 2)} °C</b></div>` : '')
                    + `<div><span>x</span><b>${fmt(q.x * 1000, 2)} g/kg</b></div><div><span>RV</span><b>${fmt(q.rh, 1)} %</b></div>`
                    + (q.wd != null ? `<div><span>${esc(t('ewf.ch.wd'))}</span><b>${fmt(q.wd, 2)} m/s</b></div>` : ''), mx + m.l, my + m.t);
            })
            .on('pointerleave', () => { hov.style('display', 'none'); tip.attr('hidden', true); });
    }

    // =====================================================================
    // Zonneschoorsteen
    // =====================================================================
    function chimney(pane, r, c) {
        const { t, fmt, esc } = c;
        const prof = r.chimney.profile.filter((q) => q.tgl != null);
        const H = r.derived.H, ch = r.chimney;
        pane.innerHTML = `<div class="ewf-chart-head"><div class="ewf-chart-title">${esc(t('ewf.ch.chimTitle', { state: t(ch.open ? 'ewf.kpi.open' : 'ewf.kpi.closed') }))}</div>`
            + legend([['s1', t('ewf.ch.tGlass')], ['s2', t('ewf.ch.tAir')], ['s3', t('ewf.ch.tWall')], ['crit', t('ewf.ch.limit80'), true]], esc) + `</div>`
            + `<div class="ewf-chart ewf-chart-chim"></div>`
            + `<p class="hint">${esc(t('ewf.ch.chimSummary', { q: fmt(ch.Q / 1000, 1), eta: ch.eta == null ? '—' : fmt(ch.eta, 2), dp: fmt(ch.dpTh, 1), gl: fmt(ch.tGlassMax, 1), wl: fmt(ch.tWallMax, 1), phi: fmt(r.rad.total, 0) }))}</p>`
            + `<p class="hint ewf-src">${esc(t('ewf.ch.chimSrc'))}</p>`;
        const el = pane.querySelector('.ewf-chart-chim');
        const { svg, w, h, tip } = frame(el, 360, t('ewf.ch.chimTitle', { state: '' }));
        const m = { t: 14, r: 64, b: 38, l: 50 };
        const pw = w - m.l - m.r, ph = h - m.t - m.b;
        const all = [...prof.flatMap((q) => [q.t, q.tgl, q.tw]), ch.tIn, 80];
        const x = d3.scaleLinear().domain([d3.min(all) - 2, Math.max(85, d3.max(all) + 2)]).nice(6).range([0, pw]);
        const y = d3.scaleLinear().domain([0, H]).range([ph, 0]);
        const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
        grid(g, x, 'x', ph, 6);
        grid(g, y, 'y', pw, 6);
        g.append('rect').attr('class', 'frame').attr('width', pw).attr('height', ph);
        g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ph})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
        g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
        g.append('text').attr('class', 'axis-title').attr('x', pw / 2).attr('y', ph + 32).attr('text-anchor', 'middle').text(t('ewf.ch.temp'));
        g.append('text').attr('class', 'axis-title').attr('transform', `translate(${-38},${ph / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(t('ewf.ch.height'));
        g.append('line').attr('class', 'ref crit').attr('x1', x(80)).attr('x2', x(80)).attr('y1', 0).attr('y2', ph);
        g.append('text').attr('class', 'ref-lbl').attr('x', x(80) - 4).attr('y', 12).attr('text-anchor', 'end').text('80 °C');
        const air = [{ z: 0, t: ch.tIn }].concat(prof.map((q) => ({ z: q.z, t: q.t })));
        const series = [['tgl', 's1', prof], ['t', 's2', air], ['tw', 's3', prof]];
        for (const [k, cls, data] of series) {
            g.append('path').attr('class', 'ln ' + cls).attr('d', d3.line().x((q) => x(q[k])).y((q) => y(q.z))(data));
        }
        // directe labels aan de top (relief voor de lichtere derde kleur)
        const top = prof[prof.length - 1];
        const labels = [[top.tgl, t('ewf.ch.lGlass')], [top.t, t('ewf.ch.lAir')], [top.tw, t('ewf.ch.lWall')]]
            .map(([v, s]) => ({ x: x(v), s })).sort((a, b) => a.x - b.x);
        let last = -1e9;
        for (const lb of labels) {
            if (lb.x - last < 34) continue;
            g.append('text').attr('class', 'end-lbl').attr('x', lb.x).attr('y', -3).attr('text-anchor', 'middle').text(lb.s);
            last = lb.x;
        }
        const hov = g.append('g').attr('class', 'hover').style('display', 'none');
        hov.append('line').attr('class', 'xh').attr('x1', 0).attr('x2', pw);
        const dots = series.map(([k, cls]) => ({ k, c: hov.append('circle').attr('class', 'dot ' + cls).attr('r', 4) }));
        g.append('rect').attr('class', 'overlay').attr('width', pw).attr('height', ph)
            .on('pointermove', (ev) => {
                const [mx, my] = d3.pointer(ev);
                const z = y.invert(my);
                const q = prof.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
                hov.style('display', null).select('.xh').attr('y1', y(q.z)).attr('y2', y(q.z));
                for (const d of dots) d.c.attr('cx', x(q[d.k])).attr('cy', y(q.z));
                showTip(tip, el, `<div class="tip-h">z = ${fmt(q.z, 1)} m</div><div><span>${esc(t('ewf.ch.tGlass'))}</span><b>${fmt(q.tgl, 1)} °C</b></div>`
                    + `<div><span>${esc(t('ewf.ch.tAir'))}</span><b>${fmt(q.t, 2)} °C</b></div><div><span>${esc(t('ewf.ch.tWall'))}</span><b>${fmt(q.tw, 1)} °C</b></div>`, mx + m.l, my + m.t);
            })
            .on('pointerleave', () => { hov.style('display', 'none'); tip.attr('hidden', true); });
    }

    // =====================================================================
    // Drukbalans per verdieping
    // =====================================================================
    function pressure(pane, r, c, S) {
        const { t, fmt, esc } = c;
        const sup = r.pressure.supply, exh = r.pressure.exhaust, n = sup.length;
        if (!S.floorSel || S.floorSel > n) S.floorSel = null;
        pane.innerHTML = `<div class="ewf-chart-head"><div class="ewf-chart-title">${esc(t('ewf.ch.pressTitle'))}</div>`
            + legend([['s1', t('ewf.ch.throttle')], ['crit', t('ewf.ch.deficit')]], esc) + `</div>`
            + `<div class="ewf-chart ewf-chart-press"></div><div class="ewf-buildup"></div><p class="hint ewf-src">${esc(t('ewf.ch.pressSrc'))}</p>`;
        const el = pane.querySelector('.ewf-chart-press');
        const bh = clamp(220 / n, 12, 26);
        const { svg, w, h, tip } = frame(el, Math.max(200, n * (bh + 6) + 70), t('ewf.ch.pressTitle'));
        const m = { t: 26, r: 12, b: 30, l: 44 }, gap = 26;
        const pw = (w - m.l - m.r - gap) / 2, ph = h - m.t - m.b;
        const M = Math.max(5, ...sup.map((q) => Math.abs(q.available)), ...exh.map((q) => Math.abs(q.available))) * 1.15;
        const yb = d3.scaleBand().domain(d3.range(n, 0, -1)).range([0, ph]).paddingInner(0.25);
        const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
        g.append('g').attr('class', 'axis').call(d3.axisLeft(yb).tickSize(0).tickPadding(8).tickFormat((k) => t('ewf.sch.floorShort', { k })));
        [[sup, t('ewf.ch.supply')], [exh, t('ewf.ch.exhaust')]].forEach(([rows, title], i) => {
            const x = d3.scaleLinear().domain([-M, M]).nice(4).range([0, pw]);
            const gp = g.append('g').attr('transform', `translate(${i * (pw + gap)},0)`);
            grid(gp, x, 'x', ph, 4);
            gp.append('g').attr('class', 'axis').attr('transform', `translate(0,${ph})`).call(d3.axisBottom(x).ticks(pw < 220 ? 3 : 5).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
            gp.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', ph);
            gp.append('text').attr('class', 'panel-title').attr('x', 0).attr('y', -10).text(`${title} [Pa]`);
            const thick = Math.min(24, yb.bandwidth());
            for (const q of rows) {
                const v = q.available, x0 = x(Math.min(0, v)), x1 = x(Math.max(0, v));
                const yy = yb(q.floor) + (yb.bandwidth() - thick) / 2;
                const rw = Math.max(1, x1 - x0), rr = Math.min(4, rw / 2, thick / 2);
                // 4 px afgeronde data-kant, recht aan de nul-as
                const d = v >= 0
                    ? `M${x0},${yy} H${x1 - rr} Q${x1},${yy} ${x1},${yy + rr} V${yy + thick - rr} Q${x1},${yy + thick} ${x1 - rr},${yy + thick} H${x0} Z`
                    : `M${x1},${yy} H${x0 + rr} Q${x0},${yy} ${x0},${yy + rr} V${yy + thick - rr} Q${x0},${yy + thick} ${x0 + rr},${yy + thick} H${x1} Z`;
                const sel = S.floorSel === q.floor;
                gp.append('path').attr('class', 'bar ' + (v >= 0 ? 's1' : 'crit') + (sel ? ' sel' : '')).attr('d', d);
                const lx = v >= 0 ? x1 + 4 : x0 - 4;
                if (thick >= 10) gp.append('text').attr('class', 'bar-lbl').attr('x', lx).attr('y', yy + thick / 2 + 3.5).attr('text-anchor', v >= 0 ? 'start' : 'end')
                    .text((v >= 0 ? '+' : '') + fmt(v, 1));
                gp.append('rect').attr('class', 'hit').attr('x', 0).attr('y', yb(q.floor)).attr('width', pw).attr('height', yb.bandwidth())
                    .on('pointermove', (ev) => {
                        const [mx, my] = d3.pointer(ev, el);
                        showTip(tip, el, `<div class="tip-h">${esc(t('ewf.sch.floorShort', { k: q.floor }))} · ${esc(title)}</div>`
                            + `<div><span>${esc(t(v >= 0 ? 'ewf.ch.throttle' : 'ewf.ch.deficit'))}</span><b>${fmt(Math.abs(v), 1)} Pa</b></div>`, mx, my);
                    })
                    .on('pointerleave', () => tip.attr('hidden', true))
                    .on('click', () => { S.floorSel = S.floorSel === q.floor ? null : q.floor; pressure(pane, r, c, S); });
            }
        });
        pane.querySelector('.ewf-buildup').innerHTML = buildupTable(r, c, S.floorSel);
    }

    /** Opbouw van de drukmarge: onderste, bovenste en (optioneel) geselecteerde verdieping. */
    function buildupTable(r, c, sel) {
        const { t, fmt, esc } = c;
        const n = r.pressure.supply.length;
        const floors = [...new Set([1, n, sel].filter(Boolean))].sort((a, b) => a - b);
        const S = (k) => r.pressure.supply[k - 1], E = (k) => r.pressure.exhaust[k - 1];
        const sg = (v) => (v > 0 ? '+' : '') + fmt(v, 1);
        const rowsS = [
            ['pOver', (k) => S(k).parts.pOver], ['dpHydr', (k) => S(k).parts.dpHydr], ['dpThKc', (k) => S(k).parts.dpThCascade],
            ['dpShaft', (k) => S(k).parts.dpShaft], ['lossSup', (k) => S(k).parts.loss]
        ];
        const ld = (k) => E(k).parts.lossDetail;
        const rowsE = [
            ['dpThZs', (k) => E(k).parts.dpThChimney], ['shuntCol', (k) => E(k).parts.dpShunt], ['pEj', (k) => E(k).parts.pEj],
            ['lExt', (k) => -ld(k).ext], ['lShunt', (k) => -ld(k).shunt], ['lU', (k) => -ld(k).ubend], ['lChim', (k) => -ld(k).chimney],
            ['lFiwi', (k) => -ld(k).fiwihex], ['lDyn', (k) => -ld(k).dyn]
        ];
        const head = `<tr><th class="l">${esc(t('ewf.bu.term'))}</th>${floors.map((k) => `<th>${esc(t('ewf.sch.floorShort', { k }))}${k === sel ? ' ●' : ''}<span class="u">Pa</span></th>`).join('')}</tr>`;
        const body = (rows, total, cls) => rows.map(([k, f]) => `<tr><td class="l">${esc(t('ewf.bu.' + k))}</td>${floors.map((fl) => `<td>${sg(f(fl))}</td>`).join('')}</tr>`).join('')
            + `<tr class="sum ${cls}"><td class="l">${esc(t('ewf.bu.' + total))}</td>${floors.map((fl) => { const v = (total === 'sumSup' ? S : E)(fl).available; return `<td class="${v >= 0 ? 'ok' : 'bad'}">${sg(v)}</td>`; }).join('')}</tr>`;
        return `<div class="table-wrap"><table class="data-table ewf-table ewf-bu">`
            + `<thead>${head}</thead><tbody><tr class="grp"><td colspan="${floors.length + 1}">${esc(t('ewf.ch.supply'))}</td></tr>${body(rowsS, 'sumSup')}`
            + `<tr class="grp"><td colspan="${floors.length + 1}">${esc(t('ewf.ch.exhaust'))}</td></tr>${body(rowsE, 'sumExh')}</tbody></table></div>`
            + `<p class="hint">${esc(t('ewf.bu.hint'))}</p>`;
    }

    // =====================================================================
    // Energie
    // =====================================================================
    function energy(el, r, c) {
        if (!el) return;
        const { t, fmt, esc } = c;
        const p = r.power;
        const therm = [['cascade', r.cascade.Q], ['reheat', r.reheat.Q], ['chimney', r.chimney.Q], ['fiwihex', r.fiwihex.Q]];
        const elec = [['pumps', p.Pspray + p.Psource, p.ref.PcoolConv], ['fans', p.Pfan, p.ref.PfanConv],
            ['total', p.Pspray + p.Psource + p.Pfan, p.ref.PcoolConv + p.ref.PfanConv]];
        el.innerHTML = `<div class="ewf-chart-head"><div class="ewf-chart-title">${esc(t('ewf.ch.thermTitle'))}</div>${legend([['cool', t('ewf.ch.cooling')], ['heat', t('ewf.ch.heating')]], esc)}</div>`
            + `<div class="ewf-chart ewf-chart-therm"></div>`
            + `<div class="ewf-chart-head"><div class="ewf-chart-title">${esc(t('ewf.ch.elecTitle'))}</div>${legend([['s1', t('ewf.ch.ewf')], ['s2', t('ewf.ch.conv')]], esc)}</div>`
            + `<div class="ewf-chart ewf-chart-elec"></div><p class="hint ewf-src">${esc(t('ewf.ch.energySrc'))}</p>`;
        // thermisch: polariteit (koelen links, verwarmen rechts)
        {
            const box = el.querySelector('.ewf-chart-therm');
            const { svg, w, tip } = frame(box, therm.length * 34 + 44, t('ewf.ch.thermTitle'));
            const m = { t: 8, r: 54, b: 28, l: 150 }, pw = w - m.l - m.r, ph = therm.length * 34;
            const M = Math.max(1, ...therm.map((q) => Math.abs(q[1]) / 1000)) * 1.1;
            const x = d3.scaleLinear().domain([Math.min(0, ...therm.map((q) => q[1] / 1000)) < 0 ? -M : 0, M]).nice(4).range([0, pw]);
            const y = d3.scaleBand().domain(therm.map((q) => q[0])).range([0, ph]).paddingInner(0.3);
            const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
            grid(g, x, 'x', ph, 4);
            g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ph})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => fmt(v, 0)).tickSizeOuter(0));
            g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat((k) => t('ewf.ch.e_' + k)));
            g.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', ph);
            bars(g, therm.map(([k, v]) => ({ k, v: v / 1000, cls: v < 0 ? 'cool' : 'heat' })), x, y, fmt, tip, box, (d) => `${t('ewf.ch.e_' + d.k)}: ${fmt(d.v, 1)} kW`);
        }
        // elektrisch: EWF vs conventionele LBK
        {
            const box = el.querySelector('.ewf-chart-elec');
            const { svg, w, tip } = frame(box, elec.length * 46 + 40, t('ewf.ch.elecTitle'));
            const m = { t: 6, r: 54, b: 28, l: 150 }, pw = w - m.l - m.r, ph = elec.length * 46;
            const x = d3.scaleLinear().domain([0, Math.max(0.5, ...elec.flatMap((q) => [q[1], q[2]]).map((v) => v / 1000)) * 1.1]).nice(4).range([0, pw]);
            const y = d3.scaleBand().domain(elec.map((q) => q[0])).range([0, ph]).paddingInner(0.3);
            const y2 = d3.scaleBand().domain(['ewf', 'conv']).range([0, y.bandwidth()]).paddingInner(0.15);
            const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
            grid(g, x, 'x', ph, 4);
            g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ph})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => fmt(v, v < 10 ? 1 : 0)).tickSizeOuter(0));
            g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat((k) => t('ewf.ch.e_' + k)));
            const data = elec.flatMap(([k, a, b]) => [{ k, s: 'ewf', v: a / 1000, cls: 's1' }, { k, s: 'conv', v: b / 1000, cls: 's2' }]);
            for (const d of data) {
                const top = y(d.k) + y2(d.s), th = Math.min(18, y2.bandwidth());
                const x1 = x(Math.max(0, d.v)), rr = Math.min(4, Math.max(0.5, x1) / 2, th / 2);
                g.append('path').attr('class', 'bar ' + d.cls)
                    .attr('d', `M0,${top} H${x1 - rr} Q${x1},${top} ${x1},${top + rr} V${top + th - rr} Q${x1},${top + th} ${x1 - rr},${top + th} H0 Z`);
                g.append('text').attr('class', 'bar-lbl').attr('x', x1 + 4).attr('y', top + th / 2 + 3.5).text(fmt(d.v, d.v < 10 ? 2 : 1));
                g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', top).attr('width', pw).attr('height', th)
                    .on('pointermove', (ev) => { const [mx, my] = d3.pointer(ev, box); showTip(tip, box, `${esc(t('ewf.ch.e_' + d.k))} · ${esc(t(d.s === 'ewf' ? 'ewf.ch.ewf' : 'ewf.ch.conv'))}: <b>${fmt(d.v, 2)} kW</b>`, mx, my); })
                    .on('pointerleave', () => tip.attr('hidden', true));
            }
        }
    }

    function bars(g, data, x, y, fmt, tip, box, label) {
        const th = Math.min(24, y.bandwidth());
        for (const d of data) {
            const x0 = x(Math.min(0, d.v)), x1 = x(Math.max(0, d.v)), top = y(d.k) + (y.bandwidth() - th) / 2;
            const rw = Math.max(1, x1 - x0), rr = Math.min(4, rw / 2, th / 2);
            const path = d.v >= 0
                ? `M${x0},${top} H${x1 - rr} Q${x1},${top} ${x1},${top + rr} V${top + th - rr} Q${x1},${top + th} ${x1 - rr},${top + th} H${x0} Z`
                : `M${x1},${top} H${x0 + rr} Q${x0},${top} ${x0},${top + rr} V${top + th - rr} Q${x0},${top + th} ${x0 + rr},${top + th} H${x1} Z`;
            g.append('path').attr('class', 'bar ' + d.cls).attr('d', path);
            g.append('text').attr('class', 'bar-lbl').attr('x', d.v >= 0 ? x1 + 4 : x0 - 4).attr('y', top + th / 2 + 3.5)
                .attr('text-anchor', d.v >= 0 ? 'start' : 'end').text(fmt(d.v, Math.abs(d.v) < 10 ? 1 : 0));
            g.append('rect').attr('class', 'hit').attr('x', x.range()[0]).attr('y', top).attr('width', x.range()[1] - x.range()[0]).attr('height', th)
                .on('pointermove', (ev) => { const [mx, my] = d3.pointer(ev, box); showTip(tip, box, label(d), mx, my); })
                .on('pointerleave', () => tip.attr('hidden', true));
        }
    }

    root.EwfCharts = { profile, chimney, pressure, energy, buildupTable, frame, legend, showTip, grid };
})(typeof self !== 'undefined' ? self : this);
