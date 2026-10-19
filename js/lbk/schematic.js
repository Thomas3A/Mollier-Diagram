/**
 * schematic.js — schema van een luchtbehandelingskast (SVG-tekst, geen afhankelijkheden)
 *
 * Twee banen: onder de toevoer (buitenlucht → toevoer, van links naar rechts), boven de retour/afvoer
 * (van rechts naar links). WTW en mengkamer overspannen beide banen. Tussen de componenten staan de
 * puntnummers en toestanden, gelijk aan het Mollier-diagram en de tabel. Kleuren via CSS-variabelen
 * (css/lbk.css), zodat licht/donker en de huisstijl vanzelf meegaan.
 *
 * render(unit, result, opts) → SVG-string. Elementen met data-comp/data-side zijn klikbaar.
 */
(function (root) {
    'use strict';

    const COL = 100, LANE = 58, GAP = 62, PAD_L = 92, PAD_R = 92, TOP = 46, BW = 62;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---- Iconen (in een vak van BW × LANE rond (cx, cy)) ----
    function icon(c, cx, cy, h) {
        const x0 = cx - BW / 2, y0 = cy - h / 2;
        switch (c.type) {
            case 'filter': {
                let d = `M${cx - 10} ${y0 + 6}`;
                const n = 7, step = (h - 12) / n;
                for (let i = 1; i <= n; i++) d += ` L${cx + (i % 2 ? 10 : -10)} ${y0 + 6 + i * step}`;
                return `<path class="ico" d="${d}"/>`;
            }
            case 'heater': case 'cooler': {
                const cls = c.type === 'heater' ? 'ico heat' : 'ico cool';
                let d = `M${x0 + 10} ${cy}`;
                const n = 6, w = (BW - 20) / n;
                for (let i = 0; i < n; i++) d += ` l${w / 2} ${i % 2 ? 12 : -12} l${w / 2} ${i % 2 ? -12 : 12}`;
                const sign = c.type === 'heater'
                    ? `<path class="${cls}" d="M${cx - 5} ${y0 + 10}h10M${cx} ${y0 + 5}v10"/>`
                    : `<path class="${cls}" d="M${cx - 5} ${y0 + 10}h10"/>`;
                return `<path class="${cls}" d="${d}"/>${sign}`;
            }
            case 'humid': {
                if (c.kind === 'steam') {
                    let dots = '';
                    for (let i = 0; i < 4; i++) dots += `<circle class="ico-fill humid" cx="${cx + (i % 2 ? 9 : -9)}" cy="${y0 + 14 + i * 9}" r="2.2"/>`;
                    return `<path class="ico humid" d="M${cx} ${y0 + 8}V${y0 + h - 8}"/>${dots}`;
                }
                const drop = (x, y) => `<path class="ico humid" d="M${x} ${y - 7}c4 5 6 7 6 10a6 6 0 0 1-12 0c0-3 2-5 6-10z"/>`;
                return drop(cx - 9, cy - 4) + drop(cx + 9, cy + 6);
            }
            case 'fan': {
                const r = Math.min(20, h / 2 - 6);
                let blades = '';
                for (let k = 0; k < 3; k++) {
                    const a = k * 2 * Math.PI / 3;
                    const p = (rr, da) => `${(cx + rr * Math.cos(a + da)).toFixed(1)} ${(cy + rr * Math.sin(a + da)).toFixed(1)}`;
                    blades += `<path class="ico-fill fan" d="M${p(3, 0)} Q${p(r * 0.9, -0.25)} ${p(r * 0.85, 0.55)} Z"/>`;
                }
                return `<circle class="ico" cx="${cx}" cy="${cy}" r="${r}"/>${blades}<circle class="ico-fill fan" cx="${cx}" cy="${cy}" r="3"/>`;
            }
            case 'silencer': {
                let s = '';
                for (let i = -1; i <= 1; i++) s += `<rect class="ico" x="${cx + i * 15 - 4}" y="${y0 + 8}" width="8" height="${h - 16}" rx="3"/>`;
                return s;
            }
            default: return '';
        }
    }

    /** Overspannend element (WTW of mengkamer) tussen bovenkant retourbaan en onderkant toevoerbaan. */
    function spanIcon(c, cx, yTop, yBot) {
        const x0 = cx - BW / 2, x1 = cx + BW / 2, h = yBot - yTop, cy = (yTop + yBot) / 2;
        if (c.type === 'mix') {
            return `<path class="ico" d="M${cx} ${yTop + LANE / 2}V${yBot - LANE / 2 - 6}"/>`
                + `<path class="ico-fill neutral" d="M${cx - 6} ${yBot - LANE / 2 - 10}l6 9 6-9z"/>`
                + `<path class="ico" d="M${cx - 12} ${cy - 10}l24 -8M${cx - 12} ${cy}l24 -8M${cx - 12} ${cy + 10}l24 -8"/>`;
        }
        if (c.kind === 'wheel' || c.kind === 'sorption') {
            const r = Math.min(BW / 2 + 6, h / 2 - 6);
            let spokes = '';
            for (let k = 0; k < 6; k++) {
                const a = k * Math.PI / 6;
                spokes += `M${(cx - r * Math.cos(a)).toFixed(1)} ${(cy - r * Math.sin(a)).toFixed(1)}L${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
            }
            return `<circle class="ico${c.kind === 'sorption' ? ' dotted' : ''}" cx="${cx}" cy="${cy}" r="${r}"/><path class="ico thin" d="${spokes}"/>`;
        }
        if (c.kind === 'runaround') {
            const coil = (y) => {
                let d = `M${x0 + 10} ${y}`;
                for (let i = 0; i < 6; i++) d += ` l3.5 ${i % 2 ? 10 : -10} l3.5 ${i % 2 ? -10 : 10}`;
                return `<path class="ico" d="${d}"/>`;
            };
            return coil(yTop + LANE / 2) + coil(yBot - LANE / 2)
                + `<path class="ico dash" d="M${x1 - 8} ${yTop + LANE / 2 + 14}V${yBot - LANE / 2 - 14}"/><circle class="ico" cx="${x1 - 8}" cy="${cy}" r="5"/>`;
        }
        return `<path class="ico" d="M${x0 + 6} ${yTop + 6}L${x1 - 6} ${yBot - 6}M${x1 - 6} ${yTop + 6}L${x0 + 6} ${yBot - 6}"/>`;
    }

    /**
     * unit: LBK; res: resultaat van LbkEngine.step (of null); opts: {
     *   names: (c, side) → korte naam, value: (c, side) → waardetekst, state: (s) → [regel1, regel2],
     *   numbers: {compId → puntnummer}, labels: {out, sup, ret, exh}, selected, title }
     */
    function render(unit, res, opts) {
        const chain = unit.comps;
        const hrIdx = chain.findIndex((c) => c.type === 'hr' && c.on !== false);
        const mixIdx = chain.findIndex((c) => c.type === 'mix' && c.on !== false);
        const boundary = Math.max(hrIdx, mixIdx);
        // Retourcomponenten: 'na de WTW' links van de WTW, de rest rechts (ruimtezijde)
        const left = [], right = [];
        for (const c of unit.retComps) (hrIdx >= 0 && c.type === 'fan' && c.pos !== 'before' ? left : right).push(c);
        const n = chain.length;
        const availL = hrIdx >= 0 ? hrIdx : 0;
        const availR = boundary >= 0 ? n - 1 - boundary : n;
        const padL = Math.max(0, left.length - availL);
        const padR = Math.max(0, right.length - availR);
        const cols = Math.max(1, padL + n + padR);
        const W = PAD_L + cols * COL + PAD_R;
        const yRet = TOP, ySup = TOP + LANE + GAP, H = ySup + LANE + 52;
        const xc = (col) => PAD_L + col * COL + COL / 2;
        const xb = (col) => PAD_L + col * COL;
        const out = [];
        out.push(`<svg class="lbk-schema" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || '')}" style="max-width:${Math.round(W * 1.25)}px">`);
        out.push(`<defs><marker id="sch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow-head" d="M0 0L10 5L0 10z"/></marker></defs>`);
        // Behuizing en banen
        const cx0 = xb(0) - 10, cx1 = xb(cols) + 10;
        out.push(`<rect class="casing" x="${cx0}" y="${yRet - 12}" width="${cx1 - cx0}" height="${ySup + LANE + 12 - yRet + 12}" rx="10"/>`);
        out.push(`<rect class="lane ret" x="${cx0}" y="${yRet}" width="${cx1 - cx0}" height="${LANE}"/>`);
        out.push(`<rect class="lane sup" x="${cx0}" y="${ySup}" width="${cx1 - cx0}" height="${LANE}"/>`);
        // Stromingspijlen buiten de kast
        const L = opts.labels;
        out.push(`<path class="flow sup" d="M${cx0 - 66} ${ySup + LANE / 2}H${cx0 - 4}" marker-end="url(#sch-arrow)"/>`);
        out.push(`<path class="flow sup" d="M${cx1 + 4} ${ySup + LANE / 2}H${cx1 + 66}" marker-end="url(#sch-arrow)"/>`);
        out.push(`<path class="flow ret" d="M${cx1 + 66} ${yRet + LANE / 2}H${cx1 + 4}" marker-end="url(#sch-arrow)"/>`);
        out.push(`<path class="flow ret" d="M${cx0 - 4} ${yRet + LANE / 2}H${cx0 - 66}" marker-end="url(#sch-arrow)"/>`);
        const endLbl = (x, y, anchor, title, lines) => `<text class="end-lbl" x="${x}" y="${y}" text-anchor="${anchor}">${esc(title)}</text>`
            + (lines || []).map((l, i) => `<text class="end-val" x="${x}" y="${y + 13 + i * 12}" text-anchor="${anchor}">${esc(l)}</text>`).join('');
        out.push(endLbl(cx0 - 66, ySup + LANE / 2 + 20, 'start', L.out, res ? opts.state(res.out) : null));
        out.push(endLbl(cx1 + 66, ySup + LANE / 2 + 20, 'end', L.sup, res ? opts.state(res.supply) : null));
        out.push(endLbl(cx1 + 66, yRet + LANE / 2 - 34, 'end', L.ret, res ? opts.state(res.ret) : null));
        out.push(endLbl(cx0 - 66, yRet + LANE / 2 - 34, 'start', L.exh, res ? opts.state(res.exhaust) : null));

        // Toevoerzijde
        const pointAt = [];      // [x, puntnummer, toestand]
        if (res) pointAt.push([xb(padL), 1, res.out]);
        chain.forEach((c, i) => {
            const col = padL + i, x = xc(col), on = c.on !== false;
            const cls = `blk${on ? '' : ' off'}${opts.selected === c.id ? ' sel' : ''}`;
            const cr = res && res.comps[c.id];
            const flag = cr && (cr.capped || cr.frost) ? `<g class="flag${cr.capped ? ' bad' : ''}"><circle cx="${x + BW / 2 - 2}" cy="${(c.type === 'hr' || c.type === 'mix' ? yRet : ySup) + 2}" r="7"/><text x="${x + BW / 2 - 2}" y="${(c.type === 'hr' || c.type === 'mix' ? yRet : ySup) + 5.5}" text-anchor="middle">!</text></g>` : '';
            const title = `<title>${esc(opts.names(c, 'sup'))}${opts.tip ? ' — ' + esc(opts.tip(c)) : ''}</title>`;
            if (c.type === 'hr' || c.type === 'mix') {
                out.push(`<g class="${cls}" data-comp="${esc(c.id)}" data-side="sup" tabindex="0" role="button">${title}`
                    + `<rect class="box span" x="${x - BW / 2}" y="${yRet + 3}" width="${BW}" height="${ySup + LANE - 3 - yRet - 3}" rx="6"/>`
                    + spanIcon(c, x, yRet + 3, ySup + LANE - 3) + flag + '</g>');
            } else {
                out.push(`<g class="${cls}" data-comp="${esc(c.id)}" data-side="sup" tabindex="0" role="button">${title}`
                    + `<rect class="box" x="${x - BW / 2}" y="${ySup + 3}" width="${BW}" height="${LANE - 6}" rx="6"/>`
                    + icon(c, x, ySup + LANE / 2, LANE - 6) + flag + '</g>');
            }
            out.push(`<text class="blk-name${on ? '' : ' off'}" x="${x}" y="${ySup + LANE + 17}" text-anchor="middle">${esc(opts.names(c, 'sup'))}</text>`);
            const v = res && on ? opts.value(c, 'sup') : '';
            if (v) out.push(`<text class="blk-val" x="${x}" y="${ySup + LANE + 31}" text-anchor="middle">${esc(v)}</text>`);
            if (res && on && opts.numbers[c.id]) {
                const p = res.points.find((q) => q.id === c.id);
                if (p) pointAt.push([xb(col + 1), opts.numbers[c.id], p]);
            }
        });
        // Puntnummers en toestanden tussen de componenten (in de tussenruimte boven de toevoerbaan)
        for (const [x, nr, s] of pointAt) {
            out.push(`<g class="sch-pt"><circle cx="${x}" cy="${ySup + LANE / 2}" r="10.5"/><text x="${x}" y="${ySup + LANE / 2 + 4}" text-anchor="middle">${nr}</text></g>`);
            const lines = opts.state(s);
            lines.forEach((l, i) => out.push(`<text class="sch-val" x="${x}" y="${yRet + LANE + 22 + i * 12}" text-anchor="middle">${esc(l)}</text>`));
        }

        // Retourzijde
        const placeRet = (c, col) => {
            const x = xc(col), on = c.on !== false;
            const cls = `blk${on ? '' : ' off'}${opts.selected === c.id ? ' sel' : ''}`;
            out.push(`<g class="${cls}" data-comp="${esc(c.id)}" data-side="ret" tabindex="0" role="button"><title>${esc(opts.names(c, 'ret'))}</title>`
                + `<rect class="box" x="${x - BW / 2}" y="${yRet + 3}" width="${BW}" height="${LANE - 6}" rx="6"/>`
                + icon(c, x, yRet + LANE / 2, LANE - 6) + '</g>');
            out.push(`<text class="blk-name${on ? '' : ' off'}" x="${x}" y="${yRet - 18}" text-anchor="middle">${esc(opts.names(c, 'ret'))}</text>`);
            const v = res && on ? opts.value(c, 'ret') : '';
            if (v) out.push(`<text class="blk-val" x="${x}" y="${yRet - 5}" text-anchor="middle">${esc(v)}</text>`);
        };
        right.forEach((c, k) => placeRet(c, cols - 1 - k));
        left.forEach((c, k) => placeRet(c, padL + hrIdx - 1 - k));
        if (res && mixIdx >= 0 && res.r > 0) {
            out.push(`<text class="blk-val" x="${xc(padL + mixIdx)}" y="${ySup - 6}" text-anchor="middle">${esc(opts.recirc(res.r))}</text>`);
        }
        out.push('</svg>');
        return out.join('');
    }

    root.LbkSchematic = { render };
})(typeof self !== 'undefined' ? self : this);
