/**
 * Psychrometric Chart Simulator - Application Logic
 * State management, process handling, and D3 chart rendering.
 */

// ---- Global state ----
let states = [];
let processes = [];
let currentAltitude = 0;
let currentAirflow = 1000;
let currentMassFlow = 0;

// ---- Chart globals ----
let chartWidth, chartHeight, xScale, yScale, svg, chartGroup;

// Chart ranges
const X_MIN = 0, X_MAX = 26;      // humidity ratio g/kg
const T_MIN = -15, T_MAX = 40;    // temperature °C

// ---- Process catalogue (only implemented types) ----
const processCategories = {
    heating: [
        { value: 'heat-to-temp', label: 'Heat to temperature' },
        { value: 'heat-by-delta', label: 'Heat by ΔT' },
        { value: 'heat-by-power', label: 'Heat by power (kW)' },
        { value: 'heat-to-enthalpy', label: 'Heat to enthalpy' }
    ],
    cooling: [
        { value: 'cool-to-temp', label: 'Cool to temperature' },
        { value: 'cool-by-delta', label: 'Cool by ΔT' },
        { value: 'cool-by-power', label: 'Cool by power (kW)' },
        { value: 'cool-dehumid', label: 'Cool & dehumidify (to T, RH)' }
    ],
    humidification: [
        { value: 'humid-adiabatic', label: 'Adiabatic (constant h)' },
        { value: 'humid-steam', label: 'Steam humidification' },
        { value: 'humid-to-rh', label: 'Humidify to RH' },
        { value: 'humid-by-delta-x', label: 'Humidify by Δx' },
        { value: 'humid-by-water-flow', label: 'Humidify by water flow' }
    ],
    dehumidification: [
        { value: 'dehumid-to-rh', label: 'Dehumidify to RH' },
        { value: 'dehumid-by-delta-x', label: 'Dehumidify by Δx' },
        { value: 'dehumid-by-water-flow', label: 'Dehumidify by water removal' }
    ],
    mixing: [
        { value: 'mix-streams', label: 'Mix two air streams' }
    ],
    other: [
        { value: 'custom-point', label: 'Custom point (T, RH)' }
    ]
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', function () {
    initializeChart();
    updateProcessTypes();
    updatePressure();

    document.getElementById('altitude').addEventListener('input', updatePressure);
    document.getElementById('airflow').addEventListener('input', updateMassFlow);

    if (localStorage.getItem('psychro-project')) {
        if (confirm('Load previously saved project?')) loadProject();
    }
});

// ---- Settings ----
function updatePressure() {
    currentAltitude = parseFloat(document.getElementById('altitude').value) || 0;
    const p = psychro.setPressure(currentAltitude);
    document.getElementById('pressure').textContent = p.toFixed(3);
    // Recompute existing states under new pressure is non-trivial; keep as informational.
}

function updateMassFlow() {
    currentAirflow = parseFloat(document.getElementById('airflow').value) || 0;
    if (states.length > 0) {
        currentMassFlow = (currentAirflow / 3600) * states[states.length - 1].rho;
        document.getElementById('massflow').value = currentMassFlow.toFixed(4);
    } else {
        document.getElementById('massflow').value = '';
    }
    updateTables();
}

// ---- Process type dropdown ----
function updateProcessTypes() {
    const category = document.getElementById('process-category').value;
    const sel = document.getElementById('process-type');
    sel.innerHTML = '';
    processCategories[category].forEach(p => {
        const o = document.createElement('option');
        o.value = p.value;
        o.textContent = p.label;
        sel.appendChild(o);
    });
    updateProcessInputs();
}

// ---- Initial state ----
function calculateInitialState() {
    try {
        const Tdb = parseFloat(document.getElementById('tdb').value);
        const type = document.getElementById('param-type').value;
        const val = parseFloat(document.getElementById('param-value').value);
        if (isNaN(Tdb) || isNaN(val)) { alert('Please enter valid numbers.'); return; }

        updatePressure();

        let state;
        switch (type) {
            case 'rh':   state = psychro.fromTdbRH(Tdb, val); break;
            case 'twb':  state = psychro.fromTdbTwb(Tdb, val); break;
            case 'tdew': state = psychro.fromTdbTdew(Tdb, val); break;
            case 'w':    state = psychro.fromTdbW(Tdb, val / 1000); break;
            case 'h':    state = psychro.fromTdbH(Tdb, val); break;
        }

        states = [state];
        processes = [];
        updateMassFlow();
        updateChart();
        updateTables();
        updateProcessList();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ---- Dynamic process inputs ----
function field(label, id, placeholder, value) {
    return `<div>
        <label class="label">${label}</label>
        <input type="number" id="${id}" step="0.1" class="field"
            ${placeholder ? `placeholder="${placeholder}"` : ''}
            ${value !== undefined ? `value="${value}"` : ''}>
    </div>`;
}

function targetTypeSelect() {
    return `<div>
        <label class="label">Target by</label>
        <select id="humid-target-type" class="field">
            <option value="rh">Relative Humidity (%)</option>
            <option value="x">Humidity Ratio (g/kg)</option>
        </select>
    </div>`;
}

function updateProcessInputs() {
    const type = document.getElementById('process-type').value;
    const div = document.getElementById('process-inputs');
    let html = '';

    switch (type) {
        case 'heat-to-temp':
        case 'cool-to-temp':
            html = field('Target Temperature (°C)', 'target-temp', 'e.g. 30'); break;
        case 'heat-by-delta':
            html = field('Temperature rise ΔT (K)', 'delta-temp', 'e.g. 10'); break;
        case 'cool-by-delta':
            html = field('Temperature drop ΔT (K)', 'delta-temp', 'e.g. 10'); break;
        case 'heat-by-power':
            html = field('Heating power (kW)', 'power', 'e.g. 15'); break;
        case 'cool-by-power':
            html = field('Cooling power (kW)', 'power', 'e.g. 20'); break;
        case 'heat-to-enthalpy':
            html = field('Target enthalpy (kJ/kg)', 'target-enthalpy', 'e.g. 60'); break;
        case 'cool-dehumid':
            html = field('Target Temperature (°C)', 'target-temp', 'e.g. 12')
                 + field('Target RH (%)', 'target-rh', 'e.g. 95'); break;
        case 'humid-adiabatic':
            html = targetTypeSelect() + field('Target value', 'humid-target', 'e.g. 80')
                 + `<p class="text-xs text-slate-500">Evaporative — follows constant enthalpy.</p>`; break;
        case 'humid-steam':
            html = targetTypeSelect() + field('Target value', 'humid-target', 'e.g. 60')
                 + field('Steam temperature (°C)', 'steam-temp', '', 100); break;
        case 'humid-to-rh':
            html = field('Target RH (%)', 'target-rh', 'e.g. 60'); break;
        case 'humid-by-delta-x':
            html = field('Humidity rise Δx (g/kg)', 'delta-x', 'e.g. 2')
                 + field('Water temperature (°C)', 'water-temp', '', 20); break;
        case 'humid-by-water-flow':
            html = field('Water flow (kg/h)', 'water-flow', 'e.g. 5')
                 + field('Water temperature (°C)', 'water-temp', '', 20); break;
        case 'dehumid-to-rh':
            html = field('Target RH (%)', 'target-rh', 'e.g. 40'); break;
        case 'dehumid-by-delta-x':
            html = field('Humidity drop Δx (g/kg)', 'delta-x', 'e.g. 3'); break;
        case 'dehumid-by-water-flow':
            html = field('Water removed (kg/h)', 'water-flow', 'e.g. 4'); break;
        case 'mix-streams':
            html = field('Stream 2 — Temperature (°C)', 'mix-temp', 'e.g. 10')
                 + field('Stream 2 — RH (%)', 'mix-rh', 'e.g. 90')
                 + field('Mass ratio (this : stream 2)', 'mix-ratio', '', 1); break;
        case 'custom-point':
            html = field('Temperature (°C)', 'custom-temp', 'e.g. 22')
                 + field('RH (%)', 'custom-rh', 'e.g. 50'); break;
    }
    div.innerHTML = html;
}

function num(id) { return parseFloat(document.getElementById(id).value); }

/**
 * Pure transformation: apply a process (type + params) to an air state.
 * Returns { state, name, water } or throws an Error with a user message.
 * Massflow is passed in so power/water-flow steps are consistent on recompute.
 */
function applyProcess(s, type, params, massFlow) {
    const hw = 2501, cpv = 1.86;
    const sensFactor = 1.006 + cpv * s.W; // dh/dT at constant W
    let ns, name, water = 0;

    switch (type) {
        case 'heat-to-temp': {
            const t = params.targetTemp;
            if (t <= s.Tdb) throw new Error('Target must be above current temperature.');
            ns = psychro.sensibleHeating(s, t); name = `Heat to ${t} °C`; break;
        }
        case 'heat-by-delta': {
            const d = Math.abs(params.deltaT);
            ns = psychro.sensibleHeating(s, s.Tdb + d); name = `Heat +${d} K`; break;
        }
        case 'heat-by-power': {
            if (!(massFlow > 0)) throw new Error('Set a non-zero air flow.');
            const dT = params.power / massFlow / sensFactor;
            ns = psychro.sensibleHeating(s, s.Tdb + dT); name = `Heat ${params.power} kW`; break;
        }
        case 'heat-to-enthalpy': {
            const h = params.targetH;
            const t = (h - s.W * hw) / sensFactor;
            if (t <= s.Tdb) throw new Error('Target enthalpy must be higher than current.');
            ns = psychro.sensibleHeating(s, t); name = `Heat to ${h} kJ/kg`; break;
        }
        case 'cool-to-temp': {
            const t = params.targetTemp;
            if (t >= s.Tdb) throw new Error('Target must be below current temperature.');
            ns = psychro.sensibleCooling(s, t); name = `Cool to ${t} °C`;
            water = Math.max(0, (s.W - ns.W) * massFlow * 3600); break;
        }
        case 'cool-by-delta': {
            const d = Math.abs(params.deltaT);
            ns = psychro.sensibleCooling(s, s.Tdb - d); name = `Cool -${d} K`;
            water = Math.max(0, (s.W - ns.W) * massFlow * 3600); break;
        }
        case 'cool-by-power': {
            if (!(massFlow > 0)) throw new Error('Set a non-zero air flow.');
            const dT = params.power / massFlow / sensFactor;
            ns = psychro.sensibleCooling(s, s.Tdb - dT); name = `Cool ${params.power} kW`;
            water = Math.max(0, (s.W - ns.W) * massFlow * 3600); break;
        }
        case 'cool-dehumid': {
            ns = psychro.fromTdbRH(params.targetTemp, params.targetRH);
            name = `Cool & dehumid → ${params.targetTemp} °C, ${params.targetRH}%`;
            water = Math.max(0, (s.W - ns.W) * massFlow * 3600); break;
        }
        case 'humid-adiabatic': {
            ns = psychro.adiabaticHumidification(s, params.value, params.targetType);
            name = `Adiabatic humidify → ${params.value}${params.targetType === 'rh' ? '%' : ' g/kg'}`;
            water = Math.max(0, (ns.W - s.W) * massFlow * 3600); break;
        }
        case 'humid-steam': {
            ns = psychro.steamHumidification(s, params.value, params.targetType, params.steamTemp);
            name = `Steam humidify → ${params.value}${params.targetType === 'rh' ? '%' : ' g/kg'}`;
            water = Math.max(0, (ns.W - s.W) * massFlow * 3600); break;
        }
        case 'humid-to-rh': {
            if (params.targetRH <= s.RH) throw new Error('Target RH must be above current RH.');
            ns = psychro.fromTdbRH(s.Tdb, params.targetRH); name = `Humidify to ${params.targetRH}%`;
            water = Math.max(0, (ns.W - s.W) * massFlow * 3600); break;
        }
        case 'humid-by-delta-x': {
            const dx = Math.abs(params.deltaX) / 1000;
            ns = psychro.humidifyByDeltaX(s, dx, params.waterTemp);
            name = `Humidify +${(dx * 1000).toFixed(1)} g/kg`;
            water = dx * massFlow * 3600; break;
        }
        case 'humid-by-water-flow': {
            if (!(massFlow > 0)) throw new Error('Set a non-zero air flow.');
            const dx = (params.waterFlow / 3600) / massFlow;
            ns = psychro.humidifyByDeltaX(s, dx, params.waterTemp);
            name = `Humidify ${params.waterFlow} kg/h`; water = params.waterFlow; break;
        }
        case 'dehumid-to-rh': {
            if (params.targetRH >= s.RH) throw new Error('Target RH must be below current RH.');
            ns = psychro.fromTdbRH(s.Tdb, params.targetRH); name = `Dehumidify to ${params.targetRH}%`;
            water = Math.max(0, (s.W - ns.W) * massFlow * 3600); break;
        }
        case 'dehumid-by-delta-x': {
            const dx = Math.abs(params.deltaX) / 1000;
            ns = psychro.fromTdbW(s.Tdb, Math.max(0, s.W - dx));
            name = `Dehumidify -${(dx * 1000).toFixed(1)} g/kg`;
            water = dx * massFlow * 3600; break;
        }
        case 'dehumid-by-water-flow': {
            if (!(massFlow > 0)) throw new Error('Set a non-zero air flow.');
            const dx = (params.waterFlow / 3600) / massFlow;
            ns = psychro.fromTdbW(s.Tdb, Math.max(0, s.W - dx));
            name = `Dehumidify ${params.waterFlow} kg/h`; water = params.waterFlow; break;
        }
        case 'mix-streams': {
            const s2 = psychro.fromTdbRH(params.mixTemp, params.mixRH);
            ns = psychro.mixAirStreams(s, params.mixRatio, s2, 1);
            name = `Mix with ${params.mixTemp} °C/${params.mixRH}% (${params.mixRatio}:1)`; break;
        }
        case 'custom-point': {
            ns = psychro.fromTdbRH(params.customTemp, params.customRH);
            name = `Custom ${params.customTemp} °C, ${params.customRH}%`; break;
        }
        default: throw new Error('Unknown process.');
    }

    if (!ns || !isFinite(ns.Tdb) || !isFinite(ns.W)) throw new Error('Could not compute this process. Check inputs.');
    return { state: ns, name, water };
}

// Collect parameters for the selected process type from the input fields.
function collectParams(type) {
    switch (type) {
        case 'heat-to-temp':
        case 'cool-to-temp': return { targetTemp: num('target-temp') };
        case 'heat-by-delta':
        case 'cool-by-delta': return { deltaT: num('delta-temp') };
        case 'heat-by-power':
        case 'cool-by-power': return { power: num('power') };
        case 'heat-to-enthalpy': return { targetH: num('target-enthalpy') };
        case 'cool-dehumid': return { targetTemp: num('target-temp'), targetRH: num('target-rh') };
        case 'humid-adiabatic': return { targetType: document.getElementById('humid-target-type').value, value: num('humid-target') };
        case 'humid-steam': return { targetType: document.getElementById('humid-target-type').value, value: num('humid-target'), steamTemp: num('steam-temp') };
        case 'humid-to-rh':
        case 'dehumid-to-rh': return { targetRH: num('target-rh') };
        case 'humid-by-delta-x':
        case 'dehumid-by-delta-x': return { deltaX: num('delta-x'), waterTemp: num('water-temp') };
        case 'humid-by-water-flow':
        case 'dehumid-by-water-flow': return { waterFlow: num('water-flow'), waterTemp: num('water-temp') };
        case 'mix-streams': return { mixTemp: num('mix-temp'), mixRH: num('mix-rh'), mixRatio: num('mix-ratio') };
        case 'custom-point': return { customTemp: num('custom-temp'), customRH: num('custom-rh') };
        default: return {};
    }
}

// ---- Add process ----
function addProcess() {
    if (states.length === 0) { alert('Set the initial air state first.'); return; }
    try {
        const type = document.getElementById('process-type').value;
        const params = collectParams(type);
        if (Object.values(params).some(v => typeof v === 'number' && isNaN(v))) {
            alert('Please fill in all fields with valid numbers.'); return;
        }
        const s = states[states.length - 1];
        const massFlow = (currentAirflow / 3600) * s.rho;
        const r = applyProcess(s, type, params, massFlow);

        processes.push({ type, params, name: r.name, start: s, end: r.state, waterFlow: r.water });
        states.push(r.state);

        updateMassFlow();
        updateChart();
        updateTables();
        updateProcessList();
    } catch (e) {
        alert(e.message);
    }
}

// Rebuild the whole state chain from the initial state after an edit.
function recomputeChain() {
    if (states.length === 0) { processes = []; return; }
    const start = states[0];
    states = [start];
    const rebuilt = [];
    for (const p of processes) {
        const s = states[states.length - 1];
        const massFlow = (currentAirflow / 3600) * s.rho;
        try {
            const r = applyProcess(s, p.type, p.params, massFlow);
            rebuilt.push({ type: p.type, params: p.params, name: r.name, start: s, end: r.state, waterFlow: r.water });
            states.push(r.state);
        } catch (e) {
            // Skip a step that is no longer valid against the new upstream state.
        }
    }
    processes = rebuilt;
}

function removeProcess(i) {
    processes.splice(i, 1);
    recomputeChain();
    updateMassFlow();
    updateChart();
    updateTables();
    updateProcessList();
}

// ---- Process list ----
function updateProcessList() {
    const list = document.getElementById('process-list');
    document.getElementById('process-count').textContent = processes.length;

    if (processes.length === 0) {
        list.innerHTML = '<p class="text-slate-400 italic text-sm text-center py-3">No steps yet</p>';
        return;
    }

    list.innerHTML = processes.map((p, i) => `
        <div class="proc-item">
            <div>
                <div class="text-sm font-semibold text-slate-700">
                    <span class="text-slate-400">${i}→${i + 1}</span> ${p.name}
                </div>
                <div class="text-xs text-slate-500 mt-0.5">
                    ΔT ${(p.end.Tdb - p.start.Tdb).toFixed(1)} °C ·
                    Δx ${((p.end.W - p.start.W) * 1000).toFixed(2)} g/kg
                </div>
            </div>
            <span class="proc-remove" onclick="removeProcess(${i})">✕</span>
        </div>`).join('');
}

// ---- Tables ----
function signClass(v) { return v >= 0 ? 'color:#dc2626' : 'color:#2563eb'; }

function updateTables() {
    const st = document.getElementById('states-table');
    if (states.length === 0) {
        st.innerHTML = '<tr><td colspan="8" class="text-center text-slate-400 italic py-5">No data</td></tr>';
    } else {
        st.innerHTML = states.map((s, i) => `
            <tr>
                <td class="font-semibold text-slate-700">${i}</td>
                <td>${s.Tdb.toFixed(2)}</td>
                <td>${s.Twb.toFixed(2)}</td>
                <td>${s.Tdew.toFixed(2)}</td>
                <td>${s.RH.toFixed(1)}</td>
                <td>${(s.W * 1000).toFixed(2)}</td>
                <td>${s.H.toFixed(2)}</td>
                <td>${s.rho.toFixed(3)}</td>
            </tr>`).join('');
    }

    const ct = document.getElementById('changes-table');
    if (processes.length === 0) {
        ct.innerHTML = '<tr><td colspan="8" class="text-center text-slate-400 italic py-5">No processes</td></tr>';
        return;
    }
    ct.innerHTML = processes.map((p, i) => {
        const dT = p.end.Tdb - p.start.Tdb;
        const dx = (p.end.W - p.start.W) * 1000;
        const dh = p.end.H - p.start.H;
        const m = (currentAirflow / 3600) * p.start.rho;
        const Qt = dh * m;
        const Qs = 1.006 * dT * m;
        const Ql = Qt - Qs;
        const w = p.waterFlow || 0;
        const f = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
        return `
            <tr>
                <td class="font-medium text-slate-700">${i}→${i + 1}: ${p.name}</td>
                <td style="${signClass(dT)}">${f(dT)}</td>
                <td style="${signClass(dx)}">${f(dx)}</td>
                <td style="${signClass(dh)}">${f(dh)}</td>
                <td class="font-semibold" style="${signClass(Qt)}">${f(Qt)}</td>
                <td style="${signClass(Qs)}">${f(Qs)}</td>
                <td style="${signClass(Ql)}">${f(Ql)}</td>
                <td>${w.toFixed(2)}</td>
            </tr>`;
    }).join('');
}

// ---- Chart ----
function initializeChart() {
    svg = d3.select('#chart');
    const container = document.querySelector('#chart').parentNode;
    chartWidth = container.clientWidth - 90;
    chartHeight = 640 - 110;

    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs.append('marker')
        .attr('id', 'arrow')
        .attr('markerWidth', 7).attr('markerHeight', 7)
        .attr('refX', 6).attr('refY', 2.5)
        .attr('orient', 'auto')
        .append('polygon').attr('points', '0 0, 7 2.5, 0 5').attr('fill', '#dc2626');

    chartGroup = svg.append('g').attr('transform', 'translate(60, 55)');
    drawChartBackground();
}

function drawChartBackground() {
    xScale = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, chartWidth]);
    yScale = d3.scaleLinear().domain([T_MIN, T_MAX]).range([chartHeight, 0]);

    chartGroup.selectAll('.bg').remove();
    const bg = chartGroup.append('g').attr('class', 'bg');

    // Gridlines
    for (let x = X_MIN; x <= X_MAX; x += 2)
        bg.append('line').attr('class', x % 10 === 0 ? 'grid-line-major' : 'grid-line')
            .attr('x1', xScale(x)).attr('y1', 0).attr('x2', xScale(x)).attr('y2', chartHeight);
    for (let t = T_MIN; t <= T_MAX; t += 5)
        bg.append('line').attr('class', t % 10 === 0 ? 'grid-line-major' : 'grid-line')
            .attr('x1', 0).attr('y1', yScale(t)).attr('x2', chartWidth).attr('y2', yScale(t));

    // Axes
    bg.append('g').attr('class', 'axis')
        .call(d3.axisTop(xScale).ticks(13))
        .append('text').attr('x', chartWidth / 2).attr('y', -32)
        .attr('fill', '#334155').attr('text-anchor', 'middle')
        .attr('font-size', '13px').attr('font-weight', '600')
        .text('Absolute Humidity  x  (g/kg)');

    bg.append('g').attr('class', 'axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale).ticks(13));

    bg.append('g').attr('class', 'axis')
        .call(d3.axisLeft(yScale).ticks(11))
        .append('text').attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2).attr('y', -42)
        .attr('fill', '#334155').attr('text-anchor', 'middle')
        .attr('font-size', '13px').attr('font-weight', '600')
        .text('Dry Bulb Temperature  (°C)');

    // Constant-enthalpy reference lines
    [10, 20, 30, 40, 50, 60, 70, 80].forEach(h => {
        const pts = [];
        for (let t = T_MIN; t <= T_MAX; t += 1) {
            const s = psychro.fromTdbH(t, h);
            const xg = s.W * 1000;
            if (xg >= X_MIN && xg <= X_MAX && s.RH <= 100.5) pts.push([xg, t]);
        }
        if (pts.length > 1) {
            bg.append('path').datum(pts).attr('class', 'enthalpy-line')
                .attr('d', d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])));
        }
    });

    // RH curves
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(rh => {
        const pts = [];
        for (let t = T_MIN; t <= T_MAX; t += 0.5) {
            const s = psychro.fromTdbRH(t, rh);
            const xg = s.W * 1000;
            if (xg >= X_MIN && xg <= X_MAX) pts.push([xg, t]);
        }
        if (pts.length > 1) {
            bg.append('path').datum(pts)
                .attr('class', rh === 100 ? 'rh-curve rh-curve-100' : 'rh-curve')
                .attr('d', d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])).curve(d3.curveMonotoneX));
            const lp = pts[Math.floor(pts.length * 0.82)];
            if (lp) bg.append('text').attr('x', xScale(lp[0]) + 3).attr('y', yScale(lp[1]))
                .attr('font-size', '10px').attr('fill', '#60a5fa').attr('font-weight', '600')
                .text(`${rh}%`);
        }
    });

    // Comfort zone (22–26 °C, 40–60% RH)
    const cz = [[22, 40], [22, 60], [26, 60], [26, 40]].map(([t, rh]) => {
        const s = psychro.fromTdbRH(t, rh); return [s.W * 1000, t];
    });
    bg.append('polygon').attr('class', 'comfort-zone')
        .attr('points', cz.map(p => `${xScale(p[0])},${yScale(p[1])}`).join(' '));
    bg.append('text')
        .attr('x', xScale((cz[0][0] + cz[2][0]) / 2)).attr('y', yScale((cz[0][1] + cz[2][1]) / 2))
        .attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#3b82f6')
        .text('Comfort');
}

function updateChart() {
    // Always clear the data layer first (fixes "reset still shows points").
    chartGroup.selectAll('.data').remove();
    if (states.length === 0) return;

    const layer = chartGroup.append('g').attr('class', 'data');

    processes.forEach(p => {
        layer.append('line').attr('class', 'process-line')
            .attr('x1', xScale(p.start.W * 1000)).attr('y1', yScale(p.start.Tdb))
            .attr('x2', xScale(p.end.W * 1000)).attr('y2', yScale(p.end.Tdb));
    });

    states.forEach((s, i) => {
        const g = layer.append('g');
        g.append('circle').attr('class', 'state-point')
            .attr('cx', xScale(s.W * 1000)).attr('cy', yScale(s.Tdb)).attr('r', 6)
            .append('title')
            .text(`Point ${i}: ${s.Tdb.toFixed(1)} °C, ${(s.W * 1000).toFixed(1)} g/kg, ${s.RH.toFixed(0)}% RH`);
        g.append('text')
            .attr('x', xScale(s.W * 1000)).attr('y', yScale(s.Tdb) - 12)
            .attr('text-anchor', 'middle').attr('font-weight', '700').attr('font-size', '12px')
            .attr('fill', '#1e293b').attr('stroke', '#fff').attr('stroke-width', '3')
            .attr('paint-order', 'stroke').text(i);
    });
}

// ---- Reset / persistence ----
function resetAll() {
    if (!confirm('Reset all data?')) return;
    states = [];
    processes = [];
    document.getElementById('massflow').value = '';
    updateChart();
    updateTables();
    updateProcessList();
}

function saveProject() {
    const project = {
        initialState: states[0] || null,
        processes: processes.map(p => ({ type: p.type, params: p.params })),
        altitude: currentAltitude,
        airflow: currentAirflow,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('psychro-project', JSON.stringify(project));
    alert('Project saved.');
}

function loadProject() {
    const saved = localStorage.getItem('psychro-project');
    if (!saved) { alert('No saved project found.'); return; }
    try {
        const p = JSON.parse(saved);
        if (p.altitude !== undefined) { document.getElementById('altitude').value = p.altitude; updatePressure(); }
        if (p.airflow !== undefined) { document.getElementById('airflow').value = p.airflow; currentAirflow = p.airflow; }

        states = p.initialState ? [p.initialState] : [];
        processes = (p.processes || []).map(pr => ({ type: pr.type, params: pr.params, start: null, end: null, waterFlow: 0 }));
        recomputeChain();

        updateMassFlow();
        updateChart();
        updateTables();
        updateProcessList();
    } catch (e) {
        alert('Error loading project: ' + e.message);
    }
}

function exportData() {
    const project = {
        states,
        processes: processes.map(p => ({ type: p.type, params: p.params, name: p.name, start: p.start, end: p.end, waterFlow: p.waterFlow })),
        settings: { altitude: currentAltitude, airflow: currentAirflow, pressure: psychro.P },
        timestamp: new Date().toISOString(),
        version: '3.0'
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psychrometric-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Redraw chart on window resize so it stays fitted.
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        initializeChart();
        updateChart();
    }, 200);
});
