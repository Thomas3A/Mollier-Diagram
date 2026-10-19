# LBK samenstellen en energieverbruik — rekenmethode

Rekenkern: `js/lbk/engine.js` (geen DOM, getest met `test/lbk-engine.test.js` en `test/lbk-climate.test.js`).
Luchtfysica: `js/psychro.js` (ASHRAE Handbook – Fundamentals 2017, hoofdstuk 1).

## 1. Opbouw van een LBK

- **Toevoerzijde:** geordende reeks componenten van buitenlucht naar toevoer: filter, WTW, mengkamer,
  verwarmer, koeler, bevochtiger, ventilator, geluiddemper (maximaal één WTW en één mengkamer).
- **Retour-/afvoerzijde:** filter, retourventilator (vóór of na de WTW), geluiddemper.
- **Debiet:** toevoer in m³/h; massastroom droge lucht ṁ = q_v · 1,2 kg/m³ / 3600. Retourdebiet als
  percentage van de toevoer.
- **Eisen toevoerlucht:** toevoertemperatuur vast of buitentemperatuur-gecompenseerd (lineair tussen
  T_buiten,winter en T_buiten,zomer), optioneel x_min (bevochtigen) en x_max (ontvochtigen).
- **Retourlucht:** t_retour winter/zomer (zelfde overgang als de toevoertemperatuur);
  x_retour = x_toevoer + Δx_ruimte zolang er bezetting is. Dit vaste punt wordt per uur opgelost
  met de secantmethode (alleen nodig bij mengkamer of vochtterugwinning).
- **Bestaande LBK:** vermogens begrensd op de ingevulde capaciteit (0 = onbegrensd).
  **Nieuw ontwerp:** onbegrensd; het resultaat bij de ontwerpcondities is het benodigde vermogen.
  "Vermogens vastleggen" neemt die +10 % over als capaciteit en zet de LBK om naar *bestaand*.

## 2. Regeling per uur

Elk component krijgt een doel. Het temperatuurdoel op positie *i* is het toevoer-setpoint min de
temperatuurstijging stroomafwaarts: ventilatoren (Δh = P/ṁ) en het voelbare deel van stoombevochtiging
(Δx · c_p,v · (100 − t)).

| Component | Regeling |
|---|---|
| WTW | Temperatuurrendement η (NEN-EN 308) aan de toevoerzijde, × min(1, ṁ_afvoer/ṁ_toevoer). Moduleert φ ∈ [0, 1] zodat t ≤ doel bij warmteterugwinning en t ≥ doel bij koudeterugwinning (buiten warmer dan retour); daartussen bypass. Wielen: vochtterugwinning met η_x. **Vorstbeveiliging:** de droge afvoertemperatuur t_r − ṁ_t·c_p,t·Δt_t/(ṁ_a·c_p,a) blijft ≥ de vorstgrens (platenwisselaar standaard 1 °C). Optioneel **indirect adiabatisch koelen**: de afvoerlucht wordt vóór de WTW bevochtigd (rendement × afstand tot de natteboltemperatuur) als er koudevraag is. |
| Mengkamer | Vast recirculatieaandeel, of regelend tussen 0 en het maximum: meer recirculatie bij warmte- of koudevraag, 100 % buitenlucht als die gunstig is. Recirculatielucht = retourlucht na een eventuele retourventilator vóór de WTW. Componenten vóór de mengkamer voeren ṁ·(1 − r). |
| Verwarmer | Naar het temperatuurdoel, of naar een vast setpoint (voorverwarmer). Vóór een adiabatische bevochtiger: naar max(isenthalp van het doel, h waarbij het rendement x_min haalt), begrensd op 50 °C. |
| Koeler | Bypassfactor-model: uittrede = ADP + BF·(intrede − ADP) op de rechte (h, x)-lijn. ADP = min(ADP voor het temperatuurdoel, dauwpunt voor x_max), ≥ min. ADP (koudwatertemperatuur). ADP boven het dauwpunt van de intrede: droge koeling. Dode zone 0,05 K. Q = ṁ·[(h₁ − h₂) − (x₁ − x₂)·c_w·t₂]. Bij een capaciteitsgrens wordt de uittrede langs dezelfde lijn teruggeschoven. |
| Bevochtiger | Tot x_min. Stoom: Δh/Δx = 2501 + 1,86·100 kJ/kg, max. 95 % RV (geen mist); energie stoomproductie (h_stoom − c_w·10 °C)/kg. Adiabatisch: x₂ = x₁ + η·(x_s(t_nat) − x₁), h constant (+ enthalpie van het water). |
| Ventilator | P = q_v·Δp/η · (q/q_n)^n met Δp = extern + alle interne drukverliezen aan die zijde (eerste ventilator); alle elektrische energie wordt warmte in de luchtstroom. SFP-klasse volgens NEN-EN 16798-3. |

Een eis telt als niet gehaald bij |Δt| > 0,5 K of een x-afwijking > 0,2 g/kg.

## 3. Ontwerpcondities

Winter- en zomerontwerpconditie (standaard −10 °C / 90 % en 28 °C / 50 %), volle bezetting, 100 % debiet.
Adviezen (`check()`): ontbrekende ventilator, naverwarmer na een ontvochtigende koeler, bevochtiger zonder
eis, stoombevochtiger vóór de verwarmer, adiabatische bevochtiger zonder verwarmer, eisen niet gehaald
(met de componenten op capaciteit) en actieve vorstbeveiliging.

## 4. Jaarberekening

- 8760 uur, MET zonder zomertijd; 365 dagen (29 februari weggelaten). Weekdag van 1 januari uit de
  klimaatdata (referentiejaren: maandag; werkelijke jaren: echte weekdag). Klimaatdata: zie
  [`docs/klimaat/README.md`](../klimaat/README.md).
- **Weekpatroon:** 7 × 24 uurblokken met bezetting 0–100 % (standaard ma–vr 8–17 uur, 80 %).
  Bezet uur: debiet = max(min. debiet, bezetting) bij *volgt bezetting*, 100 % bij *constant*.
- **Buiten kantooruren** (bezetting 0 %): *uit*; *basisventilatie volledig behandeld* (eigen debiet,
  zelfde eisen, geen vochtlast); *basisventilatie alleen vorstvrij* (WTW actief, verwarmen tot de
  minimumtemperatuur, geen koeling of bevochtiging); *zomernachtventilatie* (alleen ventilatoren, WTW in
  bypass) als het die dag (of de dag ervoor, vóór 12 uur) ≥ T_trigger was en T_min ≤ T_buiten ≤ t_retour − 2 K.
- **Resultaten** per maand (kWh, kg, uren), per component, piekvermogens, uurreeksen voor de
  belastingduurkromme, en uren waarin de eisen niet worden gehaald (alleen bezette uren).

## 5. Eindenergie en kosten

| Post | Omrekening |
|---|---|
| Warmte | HR-ketel: m³ = Q / (η · 9,77 kWh/m³), η op bovenwaarde · warmtepomp: kWh = Q / SCOP · stadsverwarming: GJ = Q · 0,0036 / η · elektrisch: kWh = Q / η |
| Koude | kWh = Q / SEER |
| Stoom | elektrisch kWh of gas m³ = Q_stoom / η |
| Water | stoom + adiabatisch + indirect adiabatisch (m³) |
| Ventilatoren | kWh elektrisch |

Tarieven per project (€/kWh, €/m³ gas, €/GJ, €/m³ water), zonder btw en vastrecht.

## 6. Grenzen van het model

Geen gebouwmodel: de retourlucht is een opgegeven toestand en het koeleffect van nachtventilatie op het
gebouw wordt niet gerekend. Geen opwarm- en afkoeltijd, filtervervuiling, regelschommelingen,
feestdagen of zomertijd. Werkelijke jaren hebben alleen een gemeten temperatuur; het vochtgehalte is
benaderd (zie klimaat-README), dus latente koeling en bevochtiging zijn daar indicatief. Bedoeld om
varianten te vergelijken en een orde van grootte van het verbruik te geven.
