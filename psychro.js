/**
 * Psychrometric Calculation Engine
 * Based on ASHRAE fundamentals and standard psychrometric equations
 */

class PsychroCalc {
    constructor() {
        this.P = 101.325; // Standard atmospheric pressure in kPa
    }

    /**
     * Set atmospheric pressure based on altitude
     * @param {number} altitude - Altitude in meters
     */
    setPressure(altitude) {
        // Barometric formula
        this.P = 101.325 * Math.pow(1 - 2.25577e-5 * altitude, 5.2559);
        return this.P;
    }

    /**
     * Saturation pressure using Antoine equation
     * @param {number} T - Temperature in °C
     * @returns {number} Saturation pressure in kPa
     */
    saturationPressure(T) {
        if (T < -100 || T > 200) return 0;
        // Antoine equation (valid for water)
        return 0.61078 * Math.exp((17.27 * T) / (T + 237.3));
    }

    /**
     * Calculate dew point temperature
     * @param {number} Pw - Water vapor partial pressure in kPa
     * @returns {number} Dew point in °C
     */
    dewPoint(Pw) {
        if (Pw <= 0) return -273.15;
        const alpha = Math.log(Pw / 0.61078);
        return (237.3 * alpha) / (17.27 - alpha);
    }

    /**
     * Calculate wet bulb temperature using iterative method
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} W - Humidity ratio in kg/kg
     * @returns {number} Wet bulb temperature in °C
     */
    wetBulb(Tdb, W) {
        // The humidity ratio implied by a wet-bulb temperature increases
        // monotonically with Twb, so we can solve by bisection on Twb in
        // the interval [-60, Tdb]. f(Twb) = Wstar(Tdb, Twb) - W.
        let lo = -60, hi = Tdb;
        const f = (twb) => this.humidityRatioFromWetBulb(Tdb, twb) - W;

        // If air is essentially saturated, wet bulb equals dry bulb.
        if (f(hi) <= 0) return Tdb;

        for (let i = 0; i < 80; i++) {
            const mid = (lo + hi) / 2;
            const fm = f(mid);
            if (Math.abs(fm) < 1e-7) return mid;
            if (fm > 0) hi = mid; else lo = mid;
        }
        return (lo + hi) / 2;
    }

    /**
     * Calculate humidity ratio from wet bulb temperature
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} Twb - Wet bulb temperature in °C
     * @returns {number} Humidity ratio in kg/kg
     */
    humidityRatioFromWetBulb(Tdb, Twb) {
        const Pws = this.saturationPressure(Twb);
        const Ws = 0.62198 * Pws / (this.P - Pws);
        return ((2501 - 2.326 * Twb) * Ws - 1.006 * (Tdb - Twb)) / (2501 + 1.86 * Tdb - 4.186 * Twb);
    }

    /**
     * Calculate enthalpy
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} W - Humidity ratio in kg/kg
     * @returns {number} Enthalpy in kJ/kg
     */
    enthalpy(Tdb, W) {
        return 1.006 * Tdb + W * (2501 + 1.86 * Tdb);
    }

    /**
     * Calculate air density
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} W - Humidity ratio in kg/kg
     * @returns {number} Density in kg/m³
     */
    density(Tdb, W) {
        const P_Pa = this.P * 1000; // Convert to Pa
        const T_K = Tdb + 273.15;
        return P_Pa / (287.055 * T_K * (1 + 1.6078 * W));
    }

    /**
     * Calculate specific volume
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} W - Humidity ratio in kg/kg
     * @returns {number} Specific volume in m³/kg
     */
    specificVolume(Tdb, W) {
        return 1 / this.density(Tdb, W);
    }

    /**
     * Calculate complete air state from Tdb and RH
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} RH - Relative humidity in %
     * @returns {object} Complete air state
     */
    fromTdbRH(Tdb, RH) {
        const Pws = this.saturationPressure(Tdb);
        const Pw = (RH / 100) * Pws;
        const W = 0.62198 * Pw / (this.P - Pw);
        const H = this.enthalpy(Tdb, W);
        const Tdew = this.dewPoint(Pw);
        const Twb = this.wetBulb(Tdb, W);
        const rho = this.density(Tdb, W);

        return {
            Tdb: Tdb,
            Twb: Twb,
            Tdew: Tdew,
            RH: RH,
            W: W,
            H: H,
            rho: rho,
            Pw: Pw,
            Pws: Pws
        };
    }

    /**
     * Calculate complete air state from Tdb and Twb
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} Twb - Wet bulb temperature in °C
     * @returns {object} Complete air state
     */
    fromTdbTwb(Tdb, Twb) {
        const W = this.humidityRatioFromWetBulb(Tdb, Twb);
        const H = this.enthalpy(Tdb, W);
        const Pws = this.saturationPressure(Tdb);
        const Pw = W * this.P / (0.62198 + W);
        const RH = (Pw / Pws) * 100;
        const Tdew = this.dewPoint(Pw);
        const rho = this.density(Tdb, W);

        return {
            Tdb: Tdb,
            Twb: Twb,
            Tdew: Tdew,
            RH: RH,
            W: W,
            H: H,
            rho: rho,
            Pw: Pw,
            Pws: Pws
        };
    }

    /**
     * Calculate complete air state from Tdb and Tdew
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} Tdew - Dew point temperature in °C
     * @returns {object} Complete air state
     */
    fromTdbTdew(Tdb, Tdew) {
        const Pw = this.saturationPressure(Tdew);
        const W = 0.62198 * Pw / (this.P - Pw);
        const H = this.enthalpy(Tdb, W);
        const Pws = this.saturationPressure(Tdb);
        const RH = (Pw / Pws) * 100;
        const Twb = this.wetBulb(Tdb, W);
        const rho = this.density(Tdb, W);

        return {
            Tdb: Tdb,
            Twb: Twb,
            Tdew: Tdew,
            RH: RH,
            W: W,
            H: H,
            rho: rho,
            Pw: Pw,
            Pws: Pws
        };
    }

    /**
     * Calculate complete air state from Tdb and W
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} W - Humidity ratio in kg/kg
     * @returns {object} Complete air state
     */
    fromTdbW(Tdb, W) {
        const H = this.enthalpy(Tdb, W);
        const Pw = W * this.P / (0.62198 + W);
        const Pws = this.saturationPressure(Tdb);
        const RH = (Pw / Pws) * 100;
        const Tdew = this.dewPoint(Pw);
        const Twb = this.wetBulb(Tdb, W);
        const rho = this.density(Tdb, W);

        return {
            Tdb: Tdb,
            Twb: Twb,
            Tdew: Tdew,
            RH: RH,
            W: W,
            H: H,
            rho: rho,
            Pw: Pw,
            Pws: Pws
        };
    }

    /**
     * Calculate complete air state from Tdb and H
     * @param {number} Tdb - Dry bulb temperature in °C
     * @param {number} H - Enthalpy in kJ/kg
     * @returns {object} Complete air state
     */
    fromTdbH(Tdb, H) {
        const W = (H - 1.006 * Tdb) / (2501 + 1.86 * Tdb);
        const Pw = W * this.P / (0.62198 + W);
        const Pws = this.saturationPressure(Tdb);
        const RH = (Pw / Pws) * 100;
        const Tdew = this.dewPoint(Pw);
        const Twb = this.wetBulb(Tdb, W);
        const rho = this.density(Tdb, W);

        return {
            Tdb: Tdb,
            Twb: Twb,
            Tdew: Tdew,
            RH: RH,
            W: W,
            H: H,
            rho: rho,
            Pw: Pw,
            Pws: Pws
        };
    }

    /**
     * Mix two air streams
     * @param {object} state1 - First air state
     * @param {number} mass1 - Mass flow rate of first stream
     * @param {object} state2 - Second air state
     * @param {number} mass2 - Mass flow rate of second stream
     * @returns {object} Mixed air state
     */
    mixAirStreams(state1, mass1, state2, mass2) {
        const totalMass = mass1 + mass2;
        const H_mix = (state1.H * mass1 + state2.H * mass2) / totalMass;
        const W_mix = (state1.W * mass1 + state2.W * mass2) / totalMass;
        const Tdb_mix = (H_mix - W_mix * 2501) / (1.006 + W_mix * 1.86);

        return this.fromTdbW(Tdb_mix, W_mix);
    }

    /**
     * Sensible heating process (constant humidity ratio)
     * @param {object} state - Initial air state
     * @param {number} targetTdb - Target dry bulb temperature in °C
     * @returns {object} Final air state
     */
    sensibleHeating(state, targetTdb) {
        return this.fromTdbW(targetTdb, state.W);
    }

    /**
     * Sensible cooling process (constant humidity ratio until saturation)
     * @param {object} state - Initial air state
     * @param {number} targetTdb - Target dry bulb temperature in °C
     * @returns {object} Final air state
     */
    sensibleCooling(state, targetTdb) {
        const newState = this.fromTdbW(targetTdb, state.W);

        // Check if condensation occurs (RH > 100%)
        if (newState.RH > 100) {
            // Cool to saturation point
            return this.fromTdbRH(targetTdb, 100);
        }

        return newState;
    }

    /**
     * Humidification process
     * @param {object} state - Initial air state
     * @param {number} targetValue - Target RH (%) or W (kg/kg)
     * @param {string} type - 'rh' or 'w'
     * @returns {object} Final air state
     */
    humidification(state, targetValue, type = 'rh') {
        if (type === 'rh') {
            return this.fromTdbRH(state.Tdb, targetValue);
        } else {
            return this.fromTdbW(state.Tdb, targetValue);
        }
    }

    /**
     * Cooling and dehumidification process
     * @param {object} state - Initial air state
     * @param {number} targetTdb - Target dry bulb temperature in °C
     * @param {number} targetRH - Target relative humidity in %
     * @returns {object} Final air state
     */
    coolingDehumidification(state, targetTdb, targetRH) {
        return this.fromTdbRH(targetTdb, targetRH);
    }

    /**
     * Calculate heat load
     * @param {object} state1 - Initial state
     * @param {object} state2 - Final state
     * @param {number} massFlow - Mass flow rate in kg/s
     * @returns {object} Heat loads
     */
    calculateLoad(state1, state2, massFlow) {
        const deltaH = state2.H - state1.H;
        const totalLoad = deltaH * massFlow; // kW
        const sensibleLoad = 1.006 * (state2.Tdb - state1.Tdb) * massFlow; // kW
        const latentLoad = totalLoad - sensibleLoad; // kW

        return {
            total: totalLoad,
            sensible: sensibleLoad,
            latent: latentLoad,
            deltaH: deltaH
        };
    }

    /**
     * Adiabatic humidification (constant enthalpy)
     * @param {object} state - Initial air state
     * @param {number} target - Target value (RH% or x in g/kg)
     * @param {string} type - 'rh' or 'x'
     * @returns {object} Final air state
     */
    adiabaticHumidification(state, target, type = 'rh') {
        const targetH = state.H; // Constant enthalpy (evaporative cooling)

        if (type === 'rh') {
            // Along a constant-enthalpy line, lowering temperature raises both
            // humidity ratio and RH (up to saturation at the wet-bulb point).
            // RH is therefore monotonically decreasing in T, so bisect on T
            // between the wet-bulb (saturation, RH = 100) and the start temp.
            const tHigh = state.Tdb;        // RH = start RH here
            const tLow = state.Twb - 1;     // at/below saturation (RH >= 100)
            target = Math.min(Math.max(target, 0.1), 100);

            const rhAt = (t) => this.fromTdbH(t, targetH).RH;

            let lo = tLow, hi = tHigh;
            // Guard: if target above what saturation gives, return saturation.
            if (target >= rhAt(lo)) return this.fromTdbH(lo, targetH);
            if (target <= rhAt(hi)) return this.fromTdbH(hi, targetH);

            for (let i = 0; i < 80; i++) {
                const mid = (lo + hi) / 2;
                const rh = rhAt(mid);
                if (Math.abs(rh - target) < 0.05) return this.fromTdbH(mid, targetH);
                if (rh > target) lo = mid; else hi = mid; // higher T -> lower RH
            }
            return this.fromTdbH((lo + hi) / 2, targetH);
        } else {
            // Target is x in g/kg, convert to kg/kg
            const targetX = target / 1000;
            const newTdb = (targetH - targetX * 2501) / (1.006 + targetX * 1.86);
            return this.fromTdbW(newTdb, targetX);
        }
    }

    /**
     * Steam humidification
     * @param {object} state - Initial air state
     * @param {number} target - Target value (RH% or x in g/kg)
     * @param {string} type - 'rh' or 'x'
     * @param {number} steamTemp - Steam temperature in °C
     * @returns {object} Final air state
     */
    steamHumidification(state, target, type = 'rh', steamTemp = 100) {
        let targetX;

        if (type === 'rh') {
            // Calculate target humidity ratio from target RH
            const Pws = this.saturationPressure(state.Tdb);
            const targetPw = (target / 100) * Pws;
            targetX = 0.62198 * targetPw / (this.P - targetPw);
        } else {
            // Target is already in g/kg, convert to kg/kg
            targetX = target / 1000;
        }

        const deltaX = targetX - state.W;

        // Energy from steam: latent heat + sensible heat of water
        // Simplified: assume steam adds enthalpy of vaporization + heating
        const steamEnthalpy = 2501 + 1.86 * steamTemp; // kJ/kg of steam
        const newH = state.H + deltaX * steamEnthalpy;

        // Calculate new temperature
        const newTdb = (newH - targetX * 2501) / (1.006 + targetX * 1.86);

        return this.fromTdbW(newTdb, targetX);
    }

    /**
     * Humidify by adding moisture at a given temperature
     * @param {object} state - Initial air state
     * @param {number} deltaX - Change in humidity ratio in kg/kg
     * @param {number} waterTemp - Water temperature in °C
     * @returns {object} Final air state
     */
    humidifyByDeltaX(state, deltaX, waterTemp = 20) {
        const newX = state.W + deltaX;

        // Energy balance: water adds sensible and latent heat
        // h_water = 4.186 * T_water (simplified)
        // h_vapor = 2501 + 1.86 * T_air
        const waterSensible = 4.186 * waterTemp;
        const vaporLatent = 2501 + 1.86 * state.Tdb;
        const energyAdded = deltaX * (vaporLatent + waterSensible - 4.186 * waterTemp);

        const newH = state.H + energyAdded;
        const newTdb = (newH - newX * 2501) / (1.006 + newX * 1.86);

        return this.fromTdbW(newTdb, newX);
    }
}

// Create global instance
const psychro = new PsychroCalc();
