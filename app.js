/**
 * Main Application Logic
 * Handles UI, state management, processes, and chart visualization
 */

// Global state
let states = [];
let processes = [];
let currentAltitude = 0;
let currentAirflow = 1000;

// Chart dimensions and scales
let chartWidth, chartHeight, xScale, yScale;
let svg, chartGroup;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    updateProcessInputs();

    // Event listeners
    document.getElementById('altitude').addEventListener('input', updatePressure);

    // Load saved project if exists
    if (localStorage.getItem('psychro-project')) {
        if (confirm('Load previously saved project?')) {
            loadProject();
        }
    }
});

/**
 * Update atmospheric pressure based on altitude
 */
function updatePressure() {
    const altitude = parseFloat(document.getElementById('altitude').value) || 0;
    currentAltitude = altitude;
    const pressure = psychro.setPressure(altitude);
    document.getElementById('pressure').textContent = pressure.toFixed(3);
}

/**
 * Calculate initial air state
 */
function calculateInitialState() {
    try {
        const Tdb = parseFloat(document.getElementById('tdb').value);
        const paramType = document.getElementById('param-type').value;
        const paramValue = parseFloat(document.getElementById('param-value').value);

        updatePressure();

        let state;
        switch(paramType) {
            case 'rh':
                state = psychro.fromTdbRH(Tdb, paramValue);
                break;
            case 'twb':
                state = psychro.fromTdbTwb(Tdb, paramValue);
                break;
            case 'tdew':
                state = psychro.fromTdbTdew(Tdb, paramValue);
                break;
            case 'w':
                state = psychro.fromTdbW(Tdb, paramValue);
                break;
            case 'h':
                state = psychro.fromTdbH(Tdb, paramValue);
                break;
        }

        // Reset and add initial state
        states = [state];
        processes = [];

        updateChart();
        updateTables();
        updateProcessList();

    } catch(error) {
        alert('Error calculating state: ' + error.message);
    }
}

/**
 * Update process input fields based on selected process type
 */
function updateProcessInputs() {
    const processType = document.getElementById('process-type').value;
    const inputsDiv = document.getElementById('process-inputs');

    let html = '';

    switch(processType) {
        case 'heat':
        case 'cool':
            html = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target Temperature (°C)</label>
                    <input type="number" id="target-temp" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            `;
            break;

        case 'humidify':
        case 'dehumidify':
            html = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
                    <select id="target-type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="rh">Relative Humidity (%)</option>
                        <option value="w">Humidity Ratio (kg/kg)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                    <input type="number" id="target-value" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            `;
            break;

        case 'coolhumidify':
        case 'cooldehumidify':
            html = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target Temperature (°C)</label>
                    <input type="number" id="target-temp" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target RH (%)</label>
                    <input type="number" id="target-rh" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            `;
            break;

        case 'mix':
            html = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Stream 2 - Tdb (°C)</label>
                    <input type="number" id="mix-tdb" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Stream 2 - RH (%)</label>
                    <input type="number" id="mix-rh" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Mass Ratio (m1/m2)</label>
                    <input type="number" id="mix-ratio" value="1" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            `;
            break;

        case 'custom':
            html = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Dry Bulb (°C)</label>
                    <input type="number" id="custom-tdb" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">RH (%)</label>
                    <input type="number" id="custom-rh" step="0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
            `;
            break;
    }

    inputsDiv.innerHTML = html;
}

/**
 * Add a process step
 */
function addProcess() {
    if (states.length === 0) {
        alert('Please calculate initial air state first');
        return;
    }

    try {
        const processType = document.getElementById('process-type').value;
        const currentState = states[states.length - 1];
        let newState, processName;

        switch(processType) {
            case 'heat':
                const heatTemp = parseFloat(document.getElementById('target-temp').value);
                if (heatTemp <= currentState.Tdb) {
                    alert('Target temperature must be higher than current temperature for heating');
                    return;
                }
                newState = psychro.sensibleHeating(currentState, heatTemp);
                processName = `Heat to ${heatTemp}°C`;
                break;

            case 'cool':
                const coolTemp = parseFloat(document.getElementById('target-temp').value);
                if (coolTemp >= currentState.Tdb) {
                    alert('Target temperature must be lower than current temperature for cooling');
                    return;
                }
                newState = psychro.sensibleCooling(currentState, coolTemp);
                processName = `Cool to ${coolTemp}°C`;
                break;

            case 'humidify':
                const humidType = document.getElementById('target-type').value;
                const humidValue = parseFloat(document.getElementById('target-value').value);
                newState = psychro.humidification(currentState, humidValue, humidType);
                processName = `Humidify to ${humidValue}${humidType === 'rh' ? '%' : ' kg/kg'}`;
                break;

            case 'dehumidify':
                const dehumidType = document.getElementById('target-type').value;
                const dehumidValue = parseFloat(document.getElementById('target-value').value);
                newState = psychro.humidification(currentState, dehumidValue, dehumidType);
                processName = `Dehumidify to ${dehumidValue}${dehumidType === 'rh' ? '%' : ' kg/kg'}`;
                break;

            case 'coolhumidify':
            case 'cooldehumidify':
                const cdTemp = parseFloat(document.getElementById('target-temp').value);
                const cdRH = parseFloat(document.getElementById('target-rh').value);
                newState = psychro.coolingDehumidification(currentState, cdTemp, cdRH);
                processName = `Cool to ${cdTemp}°C, ${cdRH}% RH`;
                break;

            case 'mix':
                const mixTdb = parseFloat(document.getElementById('mix-tdb').value);
                const mixRH = parseFloat(document.getElementById('mix-rh').value);
                const mixRatio = parseFloat(document.getElementById('mix-ratio').value);
                const stream2 = psychro.fromTdbRH(mixTdb, mixRH);
                newState = psychro.mixAirStreams(currentState, mixRatio, stream2, 1);
                processName = `Mix with ${mixTdb}°C, ${mixRH}% RH (ratio ${mixRatio}:1)`;
                break;

            case 'custom':
                const customTdb = parseFloat(document.getElementById('custom-tdb').value);
                const customRH = parseFloat(document.getElementById('custom-rh').value);
                newState = psychro.fromTdbRH(customTdb, customRH);
                processName = `Custom point: ${customTdb}°C, ${customRH}% RH`;
                break;
        }

        // Add process and new state
        processes.push({
            type: processType,
            name: processName,
            start: currentState,
            end: newState
        });

        states.push(newState);

        updateChart();
        updateTables();
        updateProcessList();

    } catch(error) {
        alert('Error adding process: ' + error.message);
    }
}

/**
 * Remove a process
 */
function removeProcess(index) {
    processes.splice(index, 1);
    states.splice(index + 1, 1);

    updateChart();
    updateTables();
    updateProcessList();
}

/**
 * Update process list display
 */
function updateProcessList() {
    const listDiv = document.getElementById('process-list');

    if (processes.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 italic">No processes added yet</p>';
        return;
    }

    let html = '';
    processes.forEach((proc, i) => {
        html += `
            <div class="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div>
                    <span class="font-semibold text-gray-700">${i + 1}.</span>
                    <span class="text-gray-800">${proc.name}</span>
                </div>
                <button onclick="removeProcess(${i})" class="text-red-600 hover:text-red-800 font-semibold">
                    Remove
                </button>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

/**
 * Update state points and process changes tables
 */
function updateTables() {
    // State points table
    const statesTableBody = document.getElementById('states-table');

    if (states.length === 0) {
        statesTableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-3 text-gray-500 italic text-center">No data available</td></tr>';
    } else {
        let html = '';
        states.forEach((state, i) => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-semibold">${i}</td>
                    <td class="px-4 py-3">${state.Tdb.toFixed(2)}</td>
                    <td class="px-4 py-3">${state.Twb.toFixed(2)}</td>
                    <td class="px-4 py-3">${state.Tdew.toFixed(2)}</td>
                    <td class="px-4 py-3">${state.RH.toFixed(1)}</td>
                    <td class="px-4 py-3">${(state.W * 1000).toFixed(2)}</td>
                    <td class="px-4 py-3">${state.H.toFixed(2)}</td>
                    <td class="px-4 py-3">${state.rho.toFixed(3)}</td>
                </tr>
            `;
        });
        statesTableBody.innerHTML = html;
    }

    // Process changes table
    const changesTableBody = document.getElementById('changes-table');

    if (processes.length === 0) {
        changesTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-3 text-gray-500 italic text-center">No processes added</td></tr>';
    } else {
        let html = '';
        const airflow = parseFloat(document.getElementById('airflow').value) || 1000;

        processes.forEach((proc, i) => {
            const deltaT = proc.end.Tdb - proc.start.Tdb;
            const deltaRH = proc.end.RH - proc.start.RH;
            const deltaW = proc.end.W - proc.start.W;
            const deltaH = proc.end.H - proc.start.H;

            // Calculate mass flow rate
            const massFlow = (airflow / 3600) * proc.start.rho; // kg/s
            const Q = deltaH * massFlow; // kW

            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-semibold">${i}→${i+1}: ${proc.name}</td>
                    <td class="px-4 py-3">${deltaT.toFixed(2)}</td>
                    <td class="px-4 py-3">${deltaRH.toFixed(1)}</td>
                    <td class="px-4 py-3">${(deltaW * 1000).toFixed(2)}</td>
                    <td class="px-4 py-3">${deltaH.toFixed(2)}</td>
                    <td class="px-4 py-3 ${Q >= 0 ? 'text-red-600' : 'text-blue-600'}">${Q.toFixed(2)}</td>
                </tr>
            `;
        });
        changesTableBody.innerHTML = html;
    }
}

/**
 * Initialize the psychrometric chart
 */
function initializeChart() {
    svg = d3.select('#chart');
    const container = document.querySelector('.chart-container');
    chartWidth = container.clientWidth - 80;
    chartHeight = 600 - 80;

    svg.selectAll('*').remove();

    // Create main group with margins
    chartGroup = svg.append('g')
        .attr('transform', 'translate(60, 20)');

    // Add arrow marker for process lines
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 10)
        .attr('markerHeight', 10)
        .attr('refX', 9)
        .attr('refY', 3)
        .attr('orient', 'auto')
        .append('polygon')
        .attr('points', '0 0, 10 3, 0 6')
        .attr('fill', '#10b981');

    drawChartBackground();
}

/**
 * Draw chart background (grid and constant lines)
 */
function drawChartBackground() {
    // Define scales
    xScale = d3.scaleLinear()
        .domain([0, 50])
        .range([0, chartWidth]);

    yScale = d3.scaleLinear()
        .domain([0, 0.030])
        .range([chartHeight, 0]);

    // Clear previous background
    chartGroup.selectAll('.background-layer').remove();

    const bgLayer = chartGroup.append('g').attr('class', 'background-layer');

    // Draw axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(10).tickFormat(d => (d * 1000).toFixed(1));

    bgLayer.append('g')
        .attr('transform', `translate(0, ${chartHeight})`)
        .call(xAxis)
        .append('text')
        .attr('x', chartWidth / 2)
        .attr('y', 40)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .text('Dry Bulb Temperature (°C)');

    bgLayer.append('g')
        .call(yAxis)
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -45)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .text('Humidity Ratio (g/kg)');

    // Draw RH curves
    const rhValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    rhValues.forEach(rh => {
        const points = [];
        for (let t = 0; t <= 50; t += 0.5) {
            try {
                const state = psychro.fromTdbRH(t, rh);
                if (state.W <= 0.030) {
                    points.push([t, state.W]);
                }
            } catch(e) {}
        }

        if (points.length > 0) {
            const line = d3.line()
                .x(d => xScale(d[0]))
                .y(d => yScale(d[1]))
                .curve(d3.curveMonotoneX);

            bgLayer.append('path')
                .datum(points)
                .attr('class', 'rh-curve')
                .attr('d', line)
                .style('stroke', rh === 100 ? '#2563eb' : '#93c5fd');

            // Label
            if (points.length > 2) {
                const lastPoint = points[points.length - 1];
                bgLayer.append('text')
                    .attr('x', xScale(lastPoint[0]) + 5)
                    .attr('y', yScale(lastPoint[1]))
                    .attr('font-size', '10px')
                    .attr('fill', '#3b82f6')
                    .text(`${rh}%`);
            }
        }
    });

    // Draw enthalpy lines
    const enthalpyValues = [20, 30, 40, 50, 60, 70, 80, 90, 100];
    enthalpyValues.forEach(h => {
        const points = [];
        for (let t = 0; t <= 50; t += 1) {
            try {
                const state = psychro.fromTdbH(t, h);
                if (state.W >= 0 && state.W <= 0.030 && state.RH >= 0 && state.RH <= 100) {
                    points.push([t, state.W]);
                }
            } catch(e) {}
        }

        if (points.length > 1) {
            const line = d3.line()
                .x(d => xScale(d[0]))
                .y(d => yScale(d[1]));

            bgLayer.append('path')
                .datum(points)
                .attr('class', 'enthalpy-line')
                .attr('d', line);

            // Label
            const firstPoint = points[0];
            bgLayer.append('text')
                .attr('x', xScale(firstPoint[0]) - 5)
                .attr('y', yScale(firstPoint[1]) - 5)
                .attr('font-size', '9px')
                .attr('fill', '#8b5cf6')
                .text(`${h}`);
        }
    });

    // Draw comfort zone (22-26°C, 40-60% RH)
    const comfortZone = [];
    const comfortT = [22, 26, 26, 22];
    const comfortRH = [40, 40, 60, 60];

    for (let i = 0; i < 4; i++) {
        const state = psychro.fromTdbRH(comfortT[i], comfortRH[i]);
        comfortZone.push([comfortT[i], state.W]);
    }

    bgLayer.append('polygon')
        .attr('class', 'comfort-zone')
        .attr('points', comfortZone.map(p => `${xScale(p[0])},${yScale(p[1])}`).join(' '));
}

/**
 * Update chart with current states and processes
 */
function updateChart() {
    if (states.length === 0) return;

    // Remove old data layers
    chartGroup.selectAll('.data-layer').remove();

    const dataLayer = chartGroup.append('g').attr('class', 'data-layer');

    // Draw process lines
    processes.forEach((proc, i) => {
        dataLayer.append('line')
            .attr('class', 'process-line')
            .attr('x1', xScale(proc.start.Tdb))
            .attr('y1', yScale(proc.start.W))
            .attr('x2', xScale(proc.end.Tdb))
            .attr('y2', yScale(proc.end.W));
    });

    // Draw state points
    states.forEach((state, i) => {
        const group = dataLayer.append('g');

        group.append('circle')
            .attr('class', 'state-point')
            .attr('cx', xScale(state.Tdb))
            .attr('cy', yScale(state.W))
            .attr('r', 6);

        group.append('text')
            .attr('x', xScale(state.Tdb))
            .attr('y', yScale(state.W) - 12)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .attr('font-size', '12px')
            .attr('fill', '#dc2626')
            .text(i);
    });
}

/**
 * Reset all data
 */
function resetAll() {
    if (confirm('Reset all data?')) {
        states = [];
        processes = [];
        updateChart();
        updateTables();
        updateProcessList();
    }
}

/**
 * Save project to localStorage
 */
function saveProject() {
    const project = {
        states: states,
        processes: processes,
        altitude: currentAltitude,
        airflow: document.getElementById('airflow').value,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('psychro-project', JSON.stringify(project));
    alert('Project saved successfully!');
}

/**
 * Load project from localStorage
 */
function loadProject() {
    const saved = localStorage.getItem('psychro-project');
    if (!saved) {
        alert('No saved project found');
        return;
    }

    try {
        const project = JSON.parse(saved);
        states = project.states;
        processes = project.processes;

        if (project.altitude !== undefined) {
            document.getElementById('altitude').value = project.altitude;
            updatePressure();
        }

        if (project.airflow !== undefined) {
            document.getElementById('airflow').value = project.airflow;
        }

        updateChart();
        updateTables();
        updateProcessList();

        alert('Project loaded successfully!');
    } catch(error) {
        alert('Error loading project: ' + error.message);
    }
}

/**
 * Export data as JSON file
 */
function exportData() {
    const project = {
        states: states,
        processes: processes.map(p => ({
            type: p.type,
            name: p.name,
            start: p.start,
            end: p.end
        })),
        altitude: currentAltitude,
        airflow: document.getElementById('airflow').value,
        timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psychro-project-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
