/**
 * Main Application Logic - Mollier Diagram Version
 * Handles UI, state management, processes, and chart visualization
 */

// Global state
let states = [];
let processes = [];
let currentAltitude = 0;
let currentAirflow = 1000;
let currentMassFlow = 0;

// Chart dimensions and scales
let chartWidth, chartHeight, xScale, yScale;
let svg, chartGroup;

// Process type definitions by category
const processCategories = {
    heating: [
        { value: 'heat-to-temp', label: 'Heat to Temperature' },
        { value: 'heat-by-delta', label: 'Heat by ΔT' },
        { value: 'heat-by-power', label: 'Heat by Power (kW)' },
        { value: 'heat-to-enthalpy', label: 'Heat to Enthalpy' }
    ],
    cooling: [
        { value: 'cool-to-temp', label: 'Cool to Temperature' },
        { value: 'cool-by-delta', label: 'Cool by ΔT' },
        { value: 'cool-by-power', label: 'Cool by Power (kW)' },
        { value: 'cool-dehumid', label: 'Cool & Dehumidify' }
    ],
    humidification: [
        { value: 'humid-adiabatic', label: 'Adiabatic Humidification' },
        { value: 'humid-steam', label: 'Steam Humidification' },
        { value: 'humid-to-rh', label: 'Humidify to RH' },
        { value: 'humid-by-delta-x', label: 'Humidify by Δx' },
        { value: 'humid-by-water-flow', label: 'Humidify by Water Flow' }
    ],
    dehumidification: [
        { value: 'dehumid-to-rh', label: 'Dehumidify to RH' },
        { value: 'dehumid-by-delta-x', label: 'Dehumidify by Δx' },
        { value: 'dehumid-by-water-flow', label: 'Dehumidify by Water Removal' }
    ],
    mixing: [
        { value: 'mix-streams', label: 'Mix Two Air Streams' },
        { value: 'mix-ratio', label: 'Mix by Mass Ratio' }
    ],
    other: [
        { value: 'custom-point', label: 'Custom Point' },
        { value: 'heat-recovery', label: 'Heat Recovery' }
    ]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    updateProcessTypes(); // Initialize process types
    updateProcessInputs();

    // Event listeners
    document.getElementById('altitude').addEventListener('input', updatePressure);
    document.getElementById('airflow').addEventListener('input', updateMassFlow);

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
 * Update mass flow rate based on airflow and density
 */
function updateMassFlow() {
    currentAirflow = parseFloat(document.getElementById('airflow').value) || 1000;
    if (states.length > 0) {
        const lastState = states[states.length - 1];
        currentMassFlow = (currentAirflow / 3600) * lastState.rho;
        document.getElementById('massflow').value = currentMassFlow.toFixed(3);
    }
}

/**
 * Update process types dropdown based on selected category
 */
function updateProcessTypes() {
    const category = document.getElementById('process-category').value;
    const processTypeSelect = document.getElementById('process-type');

    processTypeSelect.innerHTML = '';
    processCategories[category].forEach(proc => {
        const option = document.createElement('option');
        option.value = proc.value;
        option.textContent = proc.label;
        processTypeSelect.appendChild(option);
    });

    updateProcessInputs();
}

/**
 * Calculate initial air state
 */
function calculateInitialState() {
    try {
        const Tdb = parseFloat(document.getElementById('tdb').value);
        const paramType = document.getElementById('param-type').value;
        let paramValue = parseFloat(document.getElementById('param-value').value);

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
                // Convert g/kg to kg/kg
                state = psychro.fromTdbW(Tdb, paramValue / 1000);
                break;
            case 'h':
                state = psychro.fromTdbH(Tdb, paramValue);
                break;
        }

        // Reset and add initial state
        states = [state];
        processes = [];

        updateMassFlow();
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
        case 'heat-to-temp':
            html = `
                <div class="input-group">
                    <label class="input-label">Target Temperature (°C)</label>
                    <input type="number" id="target-temp" step="0.1" class="input-field" placeholder="e.g., 30">
                </div>
            `;
            break;

        case 'heat-by-delta':
            html = `
                <div class="input-group">
                    <label class="input-label">Temperature Increase ΔT (K)</label>
                    <input type="number" id="delta-temp" step="0.1" class="input-field" placeholder="e.g., 10">
                </div>
            `;
            break;

        case 'heat-by-power':
            html = `
                <div class="input-group">
                    <label class="input-label">Heating Power (kW)</label>
                    <input type="number" id="heating-power" step="0.1" class="input-field" placeholder="e.g., 15">
                </div>
            `;
            break;

        case 'heat-to-enthalpy':
            html = `
                <div class="input-group">
                    <label class="input-label">Target Enthalpy (kJ/kg)</label>
                    <input type="number" id="target-enthalpy" step="0.1" class="input-field" placeholder="e.g., 60">
                </div>
            `;
            break;

        case 'cool-to-temp':
            html = `
                <div class="input-group">
                    <label class="input-label">Target Temperature (°C)</label>
                    <input type="number" id="target-temp" step="0.1" class="input-field" placeholder="e.g., 15">
                </div>
            `;
            break;

        case 'cool-by-delta':
            html = `
                <div class="input-group">
                    <label class="input-label">Temperature Decrease ΔT (K)</label>
                    <input type="number" id="delta-temp" step="0.1" class="input-field" placeholder="e.g., 10">
                </div>
            `;
            break;

        case 'cool-by-power':
            html = `
                <div class="input-group">
                    <label class="input-label">Cooling Power (kW)</label>
                    <input type="number" id="cooling-power" step="0.1" class="input-field" placeholder="e.g., 20">
                </div>
            `;
            break;

        case 'cool-dehumid':
            html = `
                <div class="input-group">
                    <label class="input-label">Target Temperature (°C)</label>
                    <input type="number" id="target-temp" step="0.1" class="input-field" placeholder="e.g., 12">
                </div>
                <div class="input-group">
                    <label class="input-label">Target RH (%)</label>
                    <input type="number" id="target-rh" step="0.1" class="input-field" placeholder="e.g., 95">
                </div>
            `;
            break;

        case 'humid-adiabatic':
            html = `
                <div class="input-group">
                    <label class="input-label">Target RH (%) or Target x (g/kg)</label>
                    <select id="humid-target-type" class="input-field mb-2">
                        <option value="rh">Target RH (%)</option>
                        <option value="x">Target x (g/kg)</option>
                    </select>
                    <input type="number" id="humid-target" step="0.1" class="input-field" placeholder="e.g., 80">
                </div>
                <p class="text-xs text-gray-600">Constant enthalpy (evaporative cooling)</p>
            `;
            break;

        case 'humid-steam':
            html = `
                <div class="input-group">
                    <label class="input-label">Target RH (%) or Target x (g/kg)</label>
                    <select id="humid-target-type" class="input-field mb-2">
                        <option value="rh">Target RH (%)</option>
                        <option value="x">Target x (g/kg)</option>
                    </select>
                    <input type="number" id="humid-target" step="0.1" class="input-field" placeholder="e.g., 60">
                </div>
                <div class="input-group">
                    <label class="input-label">Steam Temperature (°C)</label>
                    <input type="number" id="steam-temp" value="100" step="0.1" class="input-field">
                </div>
            `;
            break;

        case 'humid-to-rh':
            html = `
                <div class="input-group">
                    <label class="input-label">Target RH (%)</label>
                    <input type="number" id="target-rh" step="0.1" class="input-field" placeholder="e.g., 60">
                </div>
            `;
            break;

        case 'humid-by-delta-x':
            html = `
                <div class="input-group">
                    <label class="input-label">Humidity Ratio Increase Δx (g/kg)</label>
                    <input type="number" id="delta-x" step="0.1" class="input-field" placeholder="e.g., 2">
                </div>
                <div class="input-group">
                    <label class="input-label">Water Temperature (°C)</label>
                    <input type="number" id="water-temp" value="20" step="0.1" class="input-field">
                </div>
            `;
            break;

        case 'humid-by-water-flow':
            html = `
                <div class="input-group">
                    <label class="input-label">Water Flow Rate (kg/h)</label>
                    <input type="number" id="water-flow" step="0.1" class="input-field" placeholder="e.g., 5">
                </div>
                <div class="input-group">
                    <label class="input-label">Water Temperature (°C)</label>
                    <input type="number" id="water-temp" value="20" step="0.1" class="input-field">
                </div>
            `;
            break;

        case 'dehumid-to-rh':
            html = `
                <div class="input-group">
                    <label class="input-label">Target RH (%)</label>
                    <input type="number" id="target-rh" step="0.1" class="input-field" placeholder="e.g., 40">
                </div>
            `;
            break;

        case 'dehumid-by-delta-x':
            html = `
                <div class="input-group">
                    <label class="input-label">Humidity Ratio Decrease Δx (g/kg)</label>
                    <input type="number" id="delta-x" step="0.1" class="input-field" placeholder="e.g., 3">
                </div>
            `;
            break;

        case 'dehumid-by-water-flow':
            html = `
                <div class="input-group">
                    <label class="input-label">Water Removal Rate (kg/h)</label>
                    <input type="number" id="water-flow" step="0.1" class="input-field" placeholder="e.g., 4">
                </div>
            `;
            break;

        case 'mix-streams':
            html = `
                <div class="input-group">
                    <label class="input-label">Stream 2 - Temperature (°C)</label>
                    <input type="number" id="mix-temp" step="0.1" class="input-field" placeholder="e.g., 10">
                </div>
                <div class="input-group">
                    <label class="input-label">Stream 2 - RH (%)</label>
                    <input type="number" id="mix-rh" step="0.1" class="input-field" placeholder="e.g., 90">
                </div>
                <div class="input-group">
                    <label class="input-label">Mass Flow Ratio (m1:m2)</label>
                    <input type="number" id="mix-ratio" value="1" step="0.1" class="input-field">
                </div>
            `;
            break;

        case 'custom-point':
            html = `
                <div class="input-group">
                    <label class="input-label">Temperature (°C)</label>
                    <input type="number" id="custom-temp" step="0.1" class="input-field" placeholder="e.g., 22">
                </div>
                <div class="input-group">
                    <label class="input-label">RH (%)</label>
                    <input type="number" id="custom-rh" step="0.1" class="input-field" placeholder="e.g., 50">
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
        let newState, processName, waterFlow = 0;

        // Update mass flow
        currentMassFlow = (currentAirflow / 3600) * currentState.rho;

        switch(processType) {
            case 'heat-to-temp':
                const targetTemp = parseFloat(document.getElementById('target-temp').value);
                if (targetTemp <= currentState.Tdb) {
                    alert('Target temperature must be higher than current temperature');
                    return;
                }
                newState = psychro.sensibleHeating(currentState, targetTemp);
                processName = `Heat to ${targetTemp}°C`;
                break;

            case 'heat-by-delta':
                const deltaT = parseFloat(document.getElementById('delta-temp').value);
                newState = psychro.sensibleHeating(currentState, currentState.Tdb + deltaT);
                processName = `Heat by ΔT = ${deltaT}K`;
                break;

            case 'heat-by-power':
                const power = parseFloat(document.getElementById('heating-power').value);
                const deltaH = power / currentMassFlow;
                newState = psychro.fromTdbH(currentState.Tdb + deltaH / 1.006, currentState.H + deltaH);
                processName = `Heat with ${power}kW`;
                break;

            case 'heat-to-enthalpy':
                const targetH = parseFloat(document.getElementById('target-enthalpy').value);
                const newT = (targetH - currentState.W * 2501) / (1.006 + currentState.W * 1.86);
                newState = psychro.fromTdbW(newT, currentState.W);
                processName = `Heat to h = ${targetH}kJ/kg`;
                break;

            case 'cool-to-temp':
                const coolTemp = parseFloat(document.getElementById('target-temp').value);
                if (coolTemp >= currentState.Tdb) {
                    alert('Target temperature must be lower than current temperature');
                    return;
                }
                newState = psychro.sensibleCooling(currentState, coolTemp);
                processName = `Cool to ${coolTemp}°C`;
                if (newState.RH > 99) {
                    waterFlow = (currentState.W - newState.W) * currentMassFlow * 3600;
                }
                break;

            case 'cool-by-delta':
                const coolDelta = parseFloat(document.getElementById('delta-temp').value);
                newState = psychro.sensibleCooling(currentState, currentState.Tdb - coolDelta);
                processName = `Cool by ΔT = ${coolDelta}K`;
                if (newState.RH > 99) {
                    waterFlow = (currentState.W - newState.W) * currentMassFlow * 3600;
                }
                break;

            case 'cool-by-power':
                const coolPower = parseFloat(document.getElementById('cooling-power').value);
                const coolDeltaH = -coolPower / currentMassFlow;
                const coolNewT = (currentState.H + coolDeltaH - currentState.W * 2501) / (1.006 + currentState.W * 1.86);
                newState = psychro.sensibleCooling(currentState, coolNewT);
                processName = `Cool with ${coolPower}kW`;
                if (newState.RH > 99) {
                    waterFlow = (currentState.W - newState.W) * currentMassFlow * 3600;
                }
                break;

            case 'cool-dehumid':
                const cdTemp = parseFloat(document.getElementById('target-temp').value);
                const cdRH = parseFloat(document.getElementById('target-rh').value);
                newState = psychro.coolingDehumidification(currentState, cdTemp, cdRH);
                processName = `Cool & Dehumid to ${cdTemp}°C, ${cdRH}%RH`;
                waterFlow = (currentState.W - newState.W) * currentMassFlow * 3600;
                break;

            case 'humid-adiabatic':
                const adiabaticType = document.getElementById('humid-target-type').value;
                const adiabaticTarget = parseFloat(document.getElementById('humid-target').value);
                newState = psychro.adiabaticHumidification(currentState, adiabaticTarget, adiabaticType);
                processName = `Adiabatic humidification to ${adiabaticTarget}${adiabaticType === 'rh' ? '%' : 'g/kg'}`;
                waterFlow = (newState.W - currentState.W) * currentMassFlow * 3600;
                break;

            case 'humid-steam':
                const steamType = document.getElementById('humid-target-type').value;
                const steamTarget = parseFloat(document.getElementById('humid-target').value);
                const steamTemp = parseFloat(document.getElementById('steam-temp').value);
                newState = psychro.steamHumidification(currentState, steamTarget, steamType, steamTemp);
                processName = `Steam humidification to ${steamTarget}${steamType === 'rh' ? '%' : 'g/kg'}`;
                waterFlow = (newState.W - currentState.W) * currentMassFlow * 3600;
                break;

            case 'humid-to-rh':
                const targetRH = parseFloat(document.getElementById('target-rh').value);
                newState = psychro.fromTdbRH(currentState.Tdb, targetRH);
                processName = `Humidify to ${targetRH}%RH`;
                waterFlow = (newState.W - currentState.W) * currentMassFlow * 3600;
                break;

            case 'humid-by-delta-x':
                const deltaX = parseFloat(document.getElementById('delta-x').value) / 1000;
                const waterTemp = parseFloat(document.getElementById('water-temp').value);
                newState = psychro.humidifyByDeltaX(currentState, deltaX, waterTemp);
                processName = `Humidify by Δx = ${(deltaX * 1000).toFixed(2)}g/kg`;
                waterFlow = deltaX * currentMassFlow * 3600;
                break;

            case 'humid-by-water-flow':
                const waterFlowRate = parseFloat(document.getElementById('water-flow').value);
                const waterTempFlow = parseFloat(document.getElementById('water-temp').value);
                const deltaXFlow = (waterFlowRate / 3600) / currentMassFlow;
                newState = psychro.humidifyByDeltaX(currentState, deltaXFlow, waterTempFlow);
                processName = `Humidify with ${waterFlowRate}kg/h water`;
                waterFlow = waterFlowRate;
                break;

            case 'dehumid-to-rh':
                const dehumidRH = parseFloat(document.getElementById('target-rh').value);
                newState = psychro.fromTdbRH(currentState.Tdb, dehumidRH);
                processName = `Dehumidify to ${dehumidRH}%RH`;
                waterFlow = (currentState.W - newState.W) * currentMassFlow * 3600;
                break;

            case 'dehumid-by-delta-x':
                const dehumidDeltaX = parseFloat(document.getElementById('delta-x').value) / 1000;
                newState = psychro.fromTdbW(currentState.Tdb, currentState.W - dehumidDeltaX);
                processName = `Dehumidify by Δx = ${(dehumidDeltaX * 1000).toFixed(2)}g/kg`;
                waterFlow = dehumidDeltaX * currentMassFlow * 3600;
                break;

            case 'dehumid-by-water-flow':
                const dehumidWaterFlow = parseFloat(document.getElementById('water-flow').value);
                const dehumidDeltaXFlow = (dehumidWaterFlow / 3600) / currentMassFlow;
                newState = psychro.fromTdbW(currentState.Tdb, currentState.W - dehumidDeltaXFlow);
                processName = `Dehumidify removing ${dehumidWaterFlow}kg/h water`;
                waterFlow = dehumidWaterFlow;
                break;

            case 'mix-streams':
                const mixTemp = parseFloat(document.getElementById('mix-temp').value);
                const mixRH = parseFloat(document.getElementById('mix-rh').value);
                const mixRatio = parseFloat(document.getElementById('mix-ratio').value);
                const stream2 = psychro.fromTdbRH(mixTemp, mixRH);
                newState = psychro.mixAirStreams(currentState, mixRatio, stream2, 1);
                processName = `Mix with ${mixTemp}°C, ${mixRH}%RH (${mixRatio}:1)`;
                break;

            case 'custom-point':
                const customTemp = parseFloat(document.getElementById('custom-temp').value);
                const customRH = parseFloat(document.getElementById('custom-rh').value);
                newState = psychro.fromTdbRH(customTemp, customRH);
                processName = `Custom: ${customTemp}°C, ${customRH}%RH`;
                break;

            default:
                alert('Process type not implemented yet');
                return;
        }

        // Store water flow information
        newState.waterFlow = waterFlow;

        // Add process and new state
        processes.push({
            type: processType,
            name: processName,
            start: currentState,
            end: newState,
            waterFlow: waterFlow
        });

        states.push(newState);

        updateMassFlow();
        updateChart();
        updateTables();
        updateProcessList();

    } catch(error) {
        alert('Error adding process: ' + error.message);
        console.error(error);
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
    const countBadge = document.getElementById('process-count');

    countBadge.textContent = processes.length;

    if (processes.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 italic text-center py-4">No processes added yet</p>';
        return;
    }

    let html = '';
    processes.forEach((proc, i) => {
        html += `
            <div class="process-card">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="font-semibold text-gray-800 mb-1">
                            <span class="text-green-600">${i}→${i+1}</span>: ${proc.name}
                        </div>
                        <div class="text-xs text-gray-600">
                            ΔT: ${(proc.end.Tdb - proc.start.Tdb).toFixed(1)}°C |
                            Δx: ${((proc.end.W - proc.start.W) * 1000).toFixed(2)}g/kg
                        </div>
                    </div>
                    <button onclick="removeProcess(${i})" class="text-red-600 hover:text-red-800 font-semibold ml-2">
                        ✕
                    </button>
                </div>
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
        statesTableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-gray-500 italic text-center">No data available</td></tr>';
    } else {
        let html = '';
        states.forEach((state, i) => {
            html += `
                <tr>
                    <td class="px-4 py-3 font-bold text-green-600">${i}</td>
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
        changesTableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-gray-500 italic text-center">No processes added</td></tr>';
    } else {
        let html = '';

        processes.forEach((proc, i) => {
            const deltaT = proc.end.Tdb - proc.start.Tdb;
            const deltaX = proc.end.W - proc.start.W;
            const deltaH = proc.end.H - proc.start.H;

            // Calculate mass flow rate for this process
            const massFlow = (currentAirflow / 3600) * proc.start.rho;
            const Qtotal = deltaH * massFlow;
            const Qsensible = 1.006 * deltaT * massFlow;
            const Qlatent = Qtotal - Qsensible;

            const waterFlow = proc.waterFlow || 0;

            html += `
                <tr>
                    <td class="px-4 py-3 font-semibold text-gray-700">${i}→${i+1}: ${proc.name}</td>
                    <td class="px-4 py-3 ${deltaT >= 0 ? 'text-red-600' : 'text-blue-600'}">${deltaT >= 0 ? '+' : ''}${deltaT.toFixed(2)}</td>
                    <td class="px-4 py-3 ${deltaX >= 0 ? 'text-blue-600' : 'text-orange-600'}">${deltaX >= 0 ? '+' : ''}${(deltaX * 1000).toFixed(2)}</td>
                    <td class="px-4 py-3 ${deltaH >= 0 ? 'text-red-600' : 'text-blue-600'}">${deltaH >= 0 ? '+' : ''}${deltaH.toFixed(2)}</td>
                    <td class="px-4 py-3 font-semibold ${Qtotal >= 0 ? 'text-red-600' : 'text-blue-600'}">${Qtotal >= 0 ? '+' : ''}${Qtotal.toFixed(2)}</td>
                    <td class="px-4 py-3 ${Qsensible >= 0 ? 'text-red-600' : 'text-blue-600'}">${Qsensible >= 0 ? '+' : ''}${Qsensible.toFixed(2)}</td>
                    <td class="px-4 py-3 ${Qlatent >= 0 ? 'text-red-600' : 'text-blue-600'}">${Qlatent >= 0 ? '+' : ''}${Qlatent.toFixed(2)}</td>
                    <td class="px-4 py-3 ${waterFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}">${waterFlow >= 0 ? '+' : ''}${waterFlow.toFixed(2)}</td>
                </tr>
            `;
        });
        changesTableBody.innerHTML = html;
    }
}

/**
 * Initialize the Psychrometric Chart (T vs x)
 */
function initializeChart() {
    svg = d3.select('#chart');
    const container = document.querySelector('.chart-container');
    chartWidth = container.clientWidth - 100;
    chartHeight = 720 - 120; // Increased top margin for x-axis

    svg.selectAll('*').remove();

    // Create main group with margins (extra top margin for x-axis)
    chartGroup = svg.append('g')
        .attr('transform', 'translate(70, 60)');

    // Add arrow marker for process lines
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('refX', 7)
        .attr('refY', 2.5)
        .attr('orient', 'auto')
        .append('polygon')
        .attr('points', '0 0, 8 2.5, 0 5')
        .attr('fill', '#ef4444');

    // Add gradient for comfort zone
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'comfortGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#86efac')
        .attr('stop-opacity', 0.3);
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#22c55e')
        .attr('stop-opacity', 0.2);

    drawChartBackground();
}

/**
 * Draw Psychrometric Chart background (T on y-axis, x on x-axis)
 */
function drawChartBackground() {
    // Define scales - Psychrometric chart: x-axis = Humidity ratio, y-axis = Temperature
    xScale = d3.scaleLinear()
        .domain([0, 26])  // Humidity ratio range in g/kg
        .range([0, chartWidth]);

    yScale = d3.scaleLinear()
        .domain([-15, 40])  // Temperature range in °C
        .range([chartHeight, 0]);

    // Clear previous background
    chartGroup.selectAll('.background-layer').remove();

    const bgLayer = chartGroup.append('g').attr('class', 'background-layer');

    // Draw gridlines
    // Vertical gridlines (for humidity)
    for (let x = 0; x <= 26; x += 2) {
        bgLayer.append('line')
            .attr('class', x % 10 === 0 ? 'grid-line-major' : 'grid-line')
            .attr('x1', xScale(x))
            .attr('y1', 0)
            .attr('x2', xScale(x))
            .attr('y2', chartHeight);
    }

    // Horizontal gridlines (for temperature)
    for (let t = -15; t <= 40; t += 5) {
        bgLayer.append('line')
            .attr('class', t % 10 === 0 ? 'grid-line-major' : 'grid-line')
            .attr('x1', 0)
            .attr('y1', yScale(t))
            .attr('x2', chartWidth)
            .attr('y2', yScale(t));
    }

    // Draw axes
    const xAxisTop = d3.axisTop(xScale).ticks(13);
    const xAxisBottom = d3.axisBottom(xScale).ticks(13);
    const yAxis = d3.axisLeft(yScale).ticks(11);

    // X-axis on top
    bgLayer.append('g')
        .attr('transform', 'translate(0, 0)')
        .call(xAxisTop)
        .style('font-size', '11px')
        .style('font-weight', '500')
        .append('text')
        .attr('x', chartWidth / 2)
        .attr('y', -35)
        .attr('fill', '#059669')
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '700')
        .text('Absolute Humidity x (g/kg)');

    // X-axis on bottom (for reference)
    bgLayer.append('g')
        .attr('transform', `translate(0, ${chartHeight})`)
        .call(xAxisBottom)
        .style('font-size', '11px')
        .style('font-weight', '500');

    // Y-axis on left
    bgLayer.append('g')
        .call(yAxis)
        .style('font-size', '11px')
        .style('font-weight', '500')
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -50)
        .attr('fill', '#047857')
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '700')
        .text('Dry Bulb Temperature (°C)');

    // Draw RH curves
    const rhValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    rhValues.forEach(rh => {
        const points = [];
        for (let t = -15; t <= 40; t += 0.5) {
            try {
                const state = psychro.fromTdbRH(t, rh);
                const xVal = state.W * 1000; // Convert to g/kg
                if (xVal >= 0 && xVal <= 26) {
                    points.push([xVal, t]);
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
                .attr('class', rh === 100 ? 'rh-curve rh-curve-100' : 'rh-curve')
                .attr('d', line);

            // Label
            if (points.length > 2) {
                const labelPoint = points[Math.floor(points.length * 0.8)];
                bgLayer.append('text')
                    .attr('x', xScale(labelPoint[0]) + 3)
                    .attr('y', yScale(labelPoint[1]))
                    .attr('font-size', '11px')
                    .attr('font-weight', '600')
                    .attr('fill', rh === 100 ? '#2563eb' : '#3b82f6')
                    .text(`${rh}%`);
            }
        }
    });

    // Draw constant enthalpy lines (diagonal)
    const enthalpyValues = [20, 30, 40, 50, 60, 70, 80, 90];
    enthalpyValues.forEach(h => {
        const points = [];
        for (let t = -15; t <= 40; t += 1) {
            try {
                const state = psychro.fromTdbH(t, h);
                const xVal = state.W * 1000;
                if (xVal >= 0 && xVal <= 26 && state.RH <= 100) {
                    points.push([xVal, t]);
                }
            } catch(e) {}
        }

        if (points.length > 2) {
            const line = d3.line()
                .x(d => xScale(d[0]))
                .y(d => yScale(d[1]));

            bgLayer.append('path')
                .datum(points)
                .attr('class', 'temp-line')
                .attr('d', line)
                .attr('stroke', '#94a3af')
                .attr('opacity', 0.25);

            // Label at the last point
            const lastPoint = points[Math.floor(points.length * 0.9)];
            if (lastPoint) {
                bgLayer.append('text')
                    .attr('x', xScale(lastPoint[0]) + 2)
                    .attr('y', yScale(lastPoint[1]) - 2)
                    .attr('font-size', '9px')
                    .attr('fill', '#6b7280')
                    .attr('opacity', 0.6)
                    .text(`${h}kJ/kg`);
            }
        }
    });

    // Draw comfort zone
    const comfortPoints = [];
    const comfortConditions = [
        [22, 40], [22, 60], [26, 60], [26, 40]
    ];

    comfortConditions.forEach(([t, rh]) => {
        const state = psychro.fromTdbRH(t, rh);
        const xVal = state.W * 1000; // Convert to g/kg
        comfortPoints.push([xVal, t]);
    });

    bgLayer.append('polygon')
        .attr('class', 'comfort-zone')
        .attr('points', comfortPoints.map(p => `${xScale(p[0])},${yScale(p[1])}`).join(' '));

    // Comfort zone label
    const centerX = (comfortPoints[0][0] + comfortPoints[2][0]) / 2;
    const centerT = (comfortPoints[0][1] + comfortPoints[2][1]) / 2;
    bgLayer.append('text')
        .attr('x', xScale(centerX))
        .attr('y', yScale(centerT))
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('fill', '#059669')
        .text('Comfort Zone');
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
        const x1 = proc.start.W * 1000; // Convert to g/kg
        const y1 = proc.start.Tdb;
        const x2 = proc.end.W * 1000; // Convert to g/kg
        const y2 = proc.end.Tdb;

        dataLayer.append('line')
            .attr('class', 'process-line')
            .attr('x1', xScale(x1))
            .attr('y1', yScale(y1))
            .attr('x2', xScale(x2))
            .attr('y2', yScale(y2));
    });

    // Draw state points
    states.forEach((state, i) => {
        const group = dataLayer.append('g');
        const xVal = state.W * 1000; // Convert to g/kg
        const yVal = state.Tdb;

        group.append('circle')
            .attr('class', 'state-point')
            .attr('cx', xScale(xVal))
            .attr('cy', yScale(yVal))
            .attr('r', 7)
            .append('title')
            .text(`Point ${i}: ${state.Tdb.toFixed(1)}°C, ${(state.W*1000).toFixed(1)}g/kg, ${state.RH.toFixed(0)}%RH`);

        group.append('text')
            .attr('x', xScale(xVal))
            .attr('y', yScale(yVal) - 15)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .attr('font-size', '14px')
            .attr('fill', '#059669')
            .attr('stroke', 'white')
            .attr('stroke-width', '3')
            .attr('paint-order', 'stroke')
            .text(i);
    });
}

/**
 * Reset all data
 */
function resetAll() {
    if (confirm('Reset all data? This cannot be undone.')) {
        states = [];
        processes = [];
        updateChart();
        updateTables();
        updateProcessList();
        document.getElementById('massflow').value = '';
    }
}

/**
 * Save project to localStorage
 */
function saveProject() {
    const project = {
        states: states,
        processes: processes.map(p => ({
            type: p.type,
            name: p.name,
            waterFlow: p.waterFlow
        })),
        altitude: currentAltitude,
        airflow: currentAirflow,
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

        // Reconstruct processes with full state objects
        processes = [];
        for (let i = 0; i < project.processes.length; i++) {
            processes.push({
                type: project.processes[i].type,
                name: project.processes[i].name,
                start: states[i],
                end: states[i + 1],
                waterFlow: project.processes[i].waterFlow || 0
            });
        }

        if (project.altitude !== undefined) {
            document.getElementById('altitude').value = project.altitude;
            updatePressure();
        }

        if (project.airflow !== undefined) {
            document.getElementById('airflow').value = project.airflow;
            currentAirflow = project.airflow;
        }

        updateMassFlow();
        updateChart();
        updateTables();
        updateProcessList();

        alert(`Project loaded successfully!\nSaved: ${new Date(project.timestamp).toLocaleString()}`);
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
            end: p.end,
            waterFlow: p.waterFlow
        })),
        settings: {
            altitude: currentAltitude,
            airflow: currentAirflow,
            pressure: psychro.P
        },
        timestamp: new Date().toISOString(),
        version: '2.0'
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mollier-diagram-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
