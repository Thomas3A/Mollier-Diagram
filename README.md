# 🌡️ Psychrometric Chart Simulator - Mollier Diagram Tool

An interactive web-based psychrometric calculator and visualizer for HVAC analysis. This tool allows you to define air states, apply various processes (heating, cooling, humidification, etc.), and visualize them on an interactive Mollier/Psychrometric chart.

## ✨ Features

### 🎯 Air State Calculation
- Define air properties using two known values:
  - Dry bulb temperature + any of:
    - Relative humidity (%)
    - Wet bulb temperature (°C)
    - Dew point temperature (°C)
    - Humidity ratio (kg/kg)
    - Enthalpy (kJ/kg)
- Automatic calculation of all psychrometric properties
- Altitude adjustment for atmospheric pressure correction

### 🔄 Process Types
- **Sensible Heating**: Increase temperature at constant humidity ratio
- **Sensible Cooling**: Decrease temperature (with condensation check)
- **Humidification**: Add moisture to air
- **Dehumidification**: Remove moisture from air
- **Cooling + Humidification**: Combined process
- **Cooling + Dehumidification**: Combined process with moisture removal
- **Mixing**: Weighted average of two air streams
- **Custom Point**: Directly define new air conditions

### 📊 Interactive Chart
- Real-time psychrometric chart visualization using D3.js
- Constant relative humidity curves (10-100%)
- Constant enthalpy lines (diagonal)
- Comfort zone overlay (22-26°C, 40-60% RH)
- Process lines with arrows showing state transitions
- Numbered state points for easy reference

### 📋 Results & Analysis
- **State Points Table**: Complete properties for each state
  - Dry bulb, wet bulb, dew point temperatures
  - Relative humidity
  - Humidity ratio
  - Enthalpy
  - Air density

- **Process Changes Table**: Differences between consecutive states
  - Temperature changes (ΔT)
  - Humidity changes (ΔRH, ΔW)
  - Enthalpy changes (ΔH)
  - Heat load calculations (kW)

### 💾 Data Management
- Save projects to browser localStorage
- Load previously saved projects
- Export data as JSON for external use
- Reset functionality to start fresh

### 🔧 Advanced Features
- Altitude compensation for atmospheric pressure
- Air flow input for load calculations
- Automatic heat load calculation (sensible/latent/total)
- Support for SI units (Imperial units ready for future implementation)

## 🚀 Getting Started

### Installation

1. Clone or download this repository
2. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
3. No installation or build process required!

### Quick Start

1. **Set Initial Conditions**:
   - Enter altitude (if applicable)
   - Enter dry bulb temperature (e.g., 25°C)
   - Select second parameter type (e.g., Relative Humidity)
   - Enter value (e.g., 50%)
   - Click "Calculate State"

2. **Add Processes**:
   - Select process type from dropdown
   - Enter required parameters
   - Click "Add Process Step"
   - Repeat to create multi-step processes

3. **View Results**:
   - Interactive chart updates automatically
   - Check state points table for detailed properties
   - Review process changes table for load calculations

4. **Save Your Work**:
   - Click "Save Project" to store in browser
   - Click "Export JSON" to download data file

## 📐 Technical Details

### Psychrometric Equations

The tool implements standard ASHRAE psychrometric equations:

- **Saturation Pressure** (Antoine equation):
  ```
  P_sat = 0.61078 × exp((17.27 × T) / (T + 237.3))
  ```

- **Humidity Ratio**:
  ```
  W = 0.62198 × (P_w / (P - P_w))
  ```

- **Enthalpy**:
  ```
  h = 1.006 × T + W × (2501 + 1.86 × T)
  ```

- **Air Density**:
  ```
  ρ = P / (287.055 × (T + 273.15) × (1 + 1.6078 × W))
  ```

- **Atmospheric Pressure** (altitude correction):
  ```
  P = 101.325 × (1 - 2.25577×10⁻⁵ × h)^5.2559
  ```

### Technology Stack

- **HTML5** - Structure
- **Tailwind CSS** - Styling and responsive design
- **Vanilla JavaScript** - Application logic
- **D3.js v7** - Chart visualization
- **LocalStorage** - Data persistence

### File Structure

```
Mollier-Diagram/
├── index.html      # Main HTML structure
├── psychro.js      # Psychrometric calculation engine
├── app.js          # Application logic and UI management
└── README.md       # This file
```

## 🎓 Usage Examples

### Example 1: Simple Heating Process

1. Initial state: 20°C, 50% RH
2. Add process: "Sensible Heating to 30°C"
3. Result: Temperature increases, RH decreases, W stays constant

### Example 2: Cooling with Dehumidification

1. Initial state: 35°C, 60% RH
2. Add process: "Cooling + Dehumidification to 15°C, 95% RH"
3. Result: Both temperature and moisture content decrease

### Example 3: Air Mixing

1. Initial state: 25°C, 40% RH
2. Add process: "Mix with 10°C, 90% RH (ratio 1:1)"
3. Result: Mixed conditions between the two streams

### Example 4: HVAC System Analysis

1. Outdoor air: 35°C, 60% RH
2. Cooling coil: Cool to 12°C, 95% RH
3. Reheat: Heat to 18°C
4. Final: Supply air conditions calculated

## 🔬 Use Cases

- **HVAC System Design**: Analyze air conditioning processes
- **Energy Calculations**: Determine heating/cooling loads
- **Comfort Analysis**: Check if conditions fall in comfort zone
- **Education**: Learn psychrometric principles
- **Research**: Quick calculations for research projects

## ⚠️ Limitations

- Currently supports SI units only (Imperial units can be added)
- Altitude range: -1000m to +5000m
- Temperature range: -10°C to 50°C (chart display)
- Calculation range: -100°C to 200°C
- Relative humidity: 0-100%

## 🔮 Future Enhancements

- [ ] Imperial units support (°F, BTU/lb)
- [ ] More process types (adiabatic mixing, heat recovery)
- [ ] Wet bulb temperature lines on chart
- [ ] Zoom and pan functionality
- [ ] Print/export chart as image
- [ ] Import JSON projects
- [ ] Multiple chart templates
- [ ] Mobile-responsive improvements
- [ ] Psychrometric property calculator mode

## 📚 References

- ASHRAE Fundamentals Handbook
- Psychrometric equations based on standard HVAC practices
- Inspired by professional tools like PsychroSim

## 📝 License

This project is free to use for personal and educational purposes.

## 🤝 Contributing

This is a private tool, but suggestions and improvements are welcome!

## 📧 Support

For issues or questions, please check the code documentation or psychrometric reference materials.

---

**Note**: This tool is intended for engineering calculations and educational purposes. Always verify critical calculations with professional software and standards.

## 🎯 Quick Reference

### Tips
- Start with simple single processes to understand behavior
- Use the comfort zone as a reference for HVAC design
- Save frequently when working on complex multi-step processes
- Export JSON files for documentation or sharing
- Check heat loads in the Process Changes table for energy analysis

### Troubleshooting
- **Chart not displaying**: Ensure JavaScript is enabled
- **Calculations seem wrong**: Check altitude setting
- **Cannot add process**: Ensure initial state is calculated first
- **Save not working**: Check browser localStorage permissions

---

**Built with ❤️ for HVAC professionals, students, and enthusiasts**
