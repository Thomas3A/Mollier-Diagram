# Earth, Wind & Fire — rekenmethode, aannames en validatie

Dit document beschrijft het rekenmodel achter de weergave **Earth, Wind & Fire** (EWF) in de Mollier-tool:
wat er wordt berekend, welke vergelijkingen en aannames erin zitten, waar bewust van het proefschrift is
afgeweken en hoe het model is gevalideerd. Dezelfde inhoud staat compacter in de app, tabblad
*Methode & bronnen*; de validatietabel daar wordt live berekend met dezelfde code (`EwfModel.runValidation()`).

> **Disclaimer.** Quasi-stationair ontwerpmodel ter verkenning; geen vervanging voor CFD, windtunnelonderzoek
> of dynamische gebouwsimulatie. Validatie op basis van schaalproeven (Bronsema 2013).

Formule- en paragraafnummers (bijv. *3.2.15/6*, *§4.5.11*) verwijzen naar B. Bronsema (2013), *Earth, Wind &
Fire – Natuurlijke Airconditioning*, proefschrift TU Delft. Het proefschrift zelf zit niet in de repository.

## 1. Wat het model doet

Een **momentopname** van het complete EWF-systeem voor één weersituatie bij een **constant geregeld
ventilatiedebiet** (§2.5.5, §3.5.5.8, §4.5.5). Per verdieping wordt bepaald of de natuurlijke drijvende
krachten volstaan: een overschot wordt met kleppen weggesmoord, een tekort door een hulpventilator aangevuld.
Het gebouw is een **neutrale zone** (§3.5.5.2): de druk in de verblijfsruimten is gelijk aan de buitendruk op
dezelfde hoogte, dus toevoer en afvoer worden elk afzonderlijk in drukbalans gebracht.

Luchtweg: buiten → overdrukruimte (1) → klimaatcascade (omlaag) → bassin (9) → toevoerschacht (omhoog) →
verdiepingen (2) → shuntkanaal (3, omlaag) → zonneschoorsteen (omhoog) → FiWiHEx (4) → venturi-ejector (6) → buiten.

Niet in het model: transmissie en thermische massa van het gebouw, jaarsimulatie, CFD, kanaalontwerp per ruimte,
windturbines en PV (hoofdstuk 5).

Code: `js/ewf/physics.js` (fysica), `js/ewf/solar.js` (zon), `js/ewf/model.js` (gebouw, presets, `simulate`),
`js/ewf/weather.js` (Open-Meteo). Referentie-implementatie en testorakel: `docs/ewf/ewf_prototype.py`.

## 2. Modelopbouw

Alle drukken zijn relatief t.o.v. de statische buitendruk op dezelfde hoogte (positief = overdruk). Dichtheid
altijd `ρ = p/(R_da·T·(1 + 1,607858·x))·(1 + x)` (ASHRAE eq. 11/28); de buitenluchtdichtheid ρ_e is constant over
de hoogte. Psychrometrie via `js/psychro.js` (ASHRAE 2017, Hyland-Wexler).

### 2.1 Gebouw en debiet
- `AVO = n·AVO_verd`, `n_pers = AVO·bezettingsdichtheid`.
- `q_v = n_pers·q_p + AVO·q_B` (NEN-EN 16798-1, cat. II laag-emitterend: 7 dm³/s·p en 0,7 dm³/(s·m²)) of handmatig.
  Standaard 1,4 dm³/(s·m²) ≈ 5 m³/(m²·h), het uitgangspunt van het proefschrift (§3.5.1.1).
- `q_v` geldt bij ρ_ref = 1,20 kg/m³; `ṁ_da = q_v·1,20/(1 + x_e)`. Afvoer = toevoer.
- Bbl-controle: `q_v ≥ n_pers·6,5 dm³/s` (art. 4.122 lid 2).

### 2.2 Wind en Ventecdak (hoofdstuk 2)
- Potentiële wind U10 (KNMI, 10 m, z0 = 0,03 m) → mesowind op 60 m: `U_meso = U10·ln(60/0,03)/ln(10/0,03)`;
  lokaal `U(z) = U_meso·ln((z − d)/z0)/ln(60/z0)` (2.1.1, 2.5.1–2.5.3). Terreinklasse 6 (z0 = 0,5 m, d = 10 m)
  geeft `U(z) = 0,273·U10·ln((z − 10)/0,5)` (2.5.3).
- `U_ref = U(H + Δz_dak)`, `q_dyn = ½·ρ_e·U_ref²`; overdruk `p_over = 0,8·q_dyn` (2.1.4, §2.4.3).
- Onderdruk ejector `p_ej = Cp_ej·q_dyn` met `Cp_ej = 0,2913·ln(U_ej/U_ref) + 0,0151` (c = 2 m, 2.3.2) of
  `0,5374·ln(·) + 0,6381` (c = 1 m, 2.3.1); geldig voor 0,1 ≤ U_ej/U_ref ≤ 0,8, daarbuiten de grenswaarde + melding.
  Het Ventecdak zonder geleideschoepen is windrichtingonafhankelijk (§2.2.4).

### 2.3 Klimaatcascade (hoofdstuk 3)
Gelijkstroom-celmodel van boven naar beneden, N = 400 cellen (SPEC §5.3, identiek aan `cascade()` in het prototype):
- Druppelsnelheid uit de impulsvergelijking met `C_d = 24/Re·(1 + 0,15·Re^0,687)` (Re < 1000, anders 0,44) op d30,
  start w0 = 10 m/s (≈ 0,5 bar, §3.2.4); `a = g·(1 − ρ_a/ρ_w) − ¾·(ρ_a/ρ_w)·C_d·w_r·|w_r|/d30` (3.2.4/4).
- Druppeloppervlak per cel `A = 6·V_water/d32` (Sauter); warmte- en stofoverdracht met Ranz-Marshall op d32
  (3.2.6/1, 3.2.7/1); verdamping/condensatie `ṁ_ev = β·A·(ρ_v,s(t_w) − ρ_v,lucht)` boven vloeibaar water (3.2.2/3).
- Oververzadiging (mist): isenthalpisch naar verzadiging; het condensaat gaat naar de waterstroom (zie §4, P2).
- **Hydraulische trek** = gewicht van het zwevende water: `Δp_hydr = Σ (ṁ_w/A_c)·g·Δt` (3.2.15/3–6).
- Aerodynamische trek (3.2.15/2) wordt alleen informatief getoond, niet in de drukbalans.
- Controles: energiebalans lucht + water `|balanceErr| < 0,1 %`, waterbalans `ṁ_w,uit = ṁ_w,in − ṁ_ev` (exact).
- Regeling (§3.5.3, §3.5.6, variant A): koelen als θ_e > 17 °C met water 13 °C en RW/L automatisch in [0,3; 1,2]
  (bisectie, N = 200) zodat t_uit = 17 °C; verwarmen/bevochtigen met RW/L = 0,9 en water 13 °C (15 °C bij θ_e < 0 °C),
  naverwarmen tot 18 °C. Optioneel variant A1: cascade uit (droge schacht, geen hydraulische trek).

### 2.4 Toevoerzijde (§3.5.5)
- `Δp_th,kc = Σ g·Δz·(ρ_profiel − ρ_e)` — altijd geïntegreerd over het berekende profiel (§3.3.10).
- `P_voet = p_over + Δp_hydr + Δp_th,kc`; per verdieping `P_k = P_voet − g·z_k·(ρ_toe − ρ_e) − Δp_toe,ontwerp`
  met `z_k = (k − ½)·h_verd` en Δp_toe,ontwerp = 25 Pa (§3.5.5.7).
- `P_k > 0` → smoren; `P_k < 0` → hulpventilator in de cascade, gedimensioneerd op de slechtste verdieping.

### 2.5 Ruimte (§5.5 SPEC)
- t_ruimte = 25 °C bij koelen (type BETA), 21 °C bij verwarmen; `x_ruimte = x_toe + G_vocht/ṁ_da` met 65 g/(h·p).
- `Q_vent = ṁ_da·(c_p,da + c_p,v·x_toe)·(t_ruimte − t_toe)`, `Q_int = 35 W/m²·AVO·aanwezigheid`, `Q_rest = Q_int − Q_vent`.
- Comfort: RV ≤ 60 % en x ≤ 12 g/kg (§3.1.5.5); winter: RV > 45 % bij θ_e < 0 °C → condensrisico.
  Verwacht gedrag: bij de ontwerp-zomerconditie komt RV_ruimte rond 65 % uit — de cascade met 13 °C water droogt
  minder dan het conceptontwerp aanneemt (bevestigd door meting B1, §3.4.10.4). De tool toont dat als waarschuwing.

### 2.6 Zonneschoorsteen, FiWiHEx en afvoer (hoofdstuk 4)
- Straling op het glas gesplitst in direct en diffuus; doorgelaten `S = R·g·(Φ_beam·k(θ) + Φ_diff·0,874)` met
  `k(θ) = g(θ)/g(0)` (polynoom fig. 4.2.2). Vaste gevelstraling uit het proefschrift: zonder invalshoekcorrectie.
- Driekennodenmodel per segment (4 per verdieping, voet → top), glas – lucht – absorber, Gauss-Seidel met demping ½:
  `U* = 1/(1/U − 0,13)`, `B_str = 0,872·B + 1,6·D`, `B_conv = B + 2·D`, `h_str = 4·ε_res·σ·T³`,
  `h_c = [(1,5·|Δθ|^⅓)³ + (7,65·w)³]^⅓` (Churchill-Usagi), f1 = 0,25 en f2 = 0,75 (§4.2.2).
- Uitvoer: profielen, `Q_zs`, rendement `η = Q_zs/(R·B·H·Φ)` (4.5.6/1), t_glas,max, t_wand,max en trek
  `Δp_th,zs = Σ g·Δz·(ρ_e − ρ_zs)` (4.2.6/1). Kantelpunt (§4.5.6.8): bij `Q_zs ≤ 0` is de schoorsteen dicht en
  wordt via de shunt direct naar het dak afgezogen.
- FiWiHEx (aanname): `Q_hr = ε·ṁ_da·c_p·max(0, t_top − t_w,in)`, ε = 0,7, t_w,in = 20 °C, Δp = 10 Pa.
- Drukverliezen: rooster/overstroom 5 Pa, shunt (vierkant, 1 m/s) en schoorsteen met λ volgens 4.2.7/3
  (Swamee-Jain-vorm van Colebrook-White, ruwheid 10 mm), U-bocht ζ = 0,5, uitstroomverlies ½ρw².
- Afvoermarge per verdieping (open): `A_k = Δp_th,zs + g·z_k·(ρ_ruimte − ρ_e) − p_ej − Σ verliezen`;
  dicht: `A_k = g·(H − z_k)·(ρ_e − ρ_ruimte) − p_ej − Σ verliezen`. In de winter kost de shuntkolom trek, zodat de
  **bovenste** verdiepingen het minst overhouden.

### 2.7 Energie (§3.5.4, §4.5.11)
- `P_vent = q_v·(Δp_vent,toe + Δp_vent,af)/(0,85·0,90)`.
- `P_sproei = ρ_w·g·h_pomp·q_w/0,75` met `h_pomp = H + 50 kPa/(ρ_w g) + 100 Pa/m·(H + 10 m)/(ρ_w g) + 1 kPa/(ρ_w g)`.
- `P_bron = |Q_cascade|/(c_w·ΔT_bron)/ρ_w·15 kPa/0,75`, `ΔT_bron = max(1 K, |t_w,uit − t_w,in|)`.
- `COP = |Q_koel|/(P_sproei + P_bron)`, alleen in koelbedrijf (3.5.4/4).
- Referentie conventionele LBK (case study): `q_v·2,64 kW/(m³/s)` en `|Q_koel|/3,0`.

### 2.8 Zon en weer
- Zonnestand: NOAA *General Solar Position Calculations* (Spencer-reeksen). Splitsing GHI → DNI/DHI met
  Erbs et al. (1982), k_t ≤ 0,8; onder α < 5° alles diffuus. Transpositie naar het verticale vlak met
  Hay & Davies (1980): direct + circumsolair, isotroop diffuus en grondreflectie (ρ_g = 0,2).
- "Weer van nu": Open-Meteo Forecast API, `models=knmi_seamless` (KNMI HARMONIE-AROME 2 km). Straling op de gevel:
  `beam = DNI·cos θ` (eigen zonnestand op `current.time`), `diffuus = GTI − beam`. Modelwaarde, geen meting.

## 3. Aannames

Waarden zonder bron in het proefschrift; in de app gemarkeerd met de badge *aanname*.

| Aanname | Waarde | Toelichting |
|---|---|---|
| Hoogte dakopbouw boven de bovenste vloer | 4 m | techniekverdieping 3,7 m (fig. 2.2.2) |
| Verplaatsingshoogte d terreinklasse 7 / 8 | 10 / 15 m | proefschrift geeft alleen klasse 6 (d = 10 m) |
| Vorm shuntkanaal | vierkant, w = 1,0 m/s | D_h = zijde |
| FiWiHEx | ε = 0,7, t_w,in = 20 °C, Δp = 10 Pa | eenvoudig model (§4.5.8.2) |
| Leidinglengte sproeipomp | H + 10 m | §3.5.4.2 geeft alleen R en Δp_lokaal |
| Ondergrens variant A1 | θ_e ≥ 10 °C | definitie "tussenseizoen" (zie §5) |
| Buitenluchtdichtheid | constant over de hoogte | luchtdrukgradiënt verwaarloosd |
| Wandwarmte cascade | verwaarloosd | aandeel 3–5 % (§3.5.2.3), geïsoleerde schacht |
| Weerpresets met * in SPEC §6.3 | U10 en gevelstraling | zie toelichting per preset in de app |

## 4. Bewuste afwijkingen

### 4.1 Van het proefschrift (SPEC §5.10, aangevuld)

| # | Proefschrift | Probleem | Keuze in deze tool |
|---|---|---|---|
| 1 | Druppeloppervlak 3.2.5/7 ∝ d32²/d30³ | Correct is n·π·d20² = 6V/d32; met d32 i.p.v. d20 ≈ 2× te groot | `A = 6V/d32` (Sauter), gevalideerd tegen de metingen. Gevolg: voor grove spectra (s1–s7) een hogere uittredetemperatuur dan tabel 3.5.2/1. |
| 2 | Eindsnelheid 3.2.4/6 | Strijdig met fig. 3.2.4/2 en Gunn & Kinzer (1 mm → ±4 m/s) | Krachtenevenwicht met C_d(Re) en impulsvergelijking vanaf w0 |
| 3 | CWC 7,65·w (4.2.4/9) én 6,5·w (§4.5.11.2) | Twee waarden onder hetzelfde nummer | 7,65·w, Churchill-Usagi met vrije convectie; instelbaar |
| 4 | Knoopvergelijkingen 4.2.5/13–15 | Drukfouten; verlies binnenwand ontbreekt in knoop 3 | Correcte energiebalansen (§2.6) |
| 5 | Aerodynamische trek 3.2.15/2 | In de metingen niet aantoonbaar | Alleen informatief |
| 6 | Thermische trek met gemiddelde temperatuur | Profiel sterk niet-lineair (§3.3.10) | Integratie over het profiel |
| 7 | Tabel 3.3.9/2 | Volumestroom water vs massastroom inconsistent | Rekenen met RW/L × ṁ_da |
| 8 | Case study §7.5.3: 200 kW koeling | Past niet bij Δh ≈ 15 kJ/kg (≈ 60 kW) | Niet gebruikt als validatie |
| 9 | 3.5.5/3: constante 12 120 | Gaat uit van 3,5 m verdiepingshoogte en ρ0·T0 | Generieke hydrostatica; 12 120 alleen in de test |
| 10 | Tabel 3.1.7/3: x = 13,3 g/kg | Afronding | Altijd `psychro.js` (ASHRAE) |
| 11 | §3.5.5.4/5: winter "+16,3 Pa bovenin" (zomer "−0,3 Pa") | Reproduceerbaar als de toevoerschacht (18 °C) t.o.v. de **cascadekolom** wordt gerekend: `P_top = P_voet − g·H·(ρ_ts − ρ_kc)`. Met de neutrale-zonebenadering van SPEC §5.4 (schacht t.o.v. **buitenlucht**) volgt +30,3 Pa (U-buiseffect: koude kolom omlaag, warme omhoog). | Model volgt SPEC §5.4 (+30,3 Pa); **bevestigd door de opdrachtgever op 6-10-2026**. De validatie toetst +30,3 Pa; 16,3 Pa (conventie proefschrift) staat er alleen ter vergelijking bij. De verwachte waarde +16,3 Pa in SPEC §12.1 is daarmee vervangen door +30,3 Pa. |

### 4.2 Van het prototype `ewf_prototype.py`

| # | Prototype | Keuze | Effect |
|---|---|---|---|
| P1 | p_ws boven ijs vanaf t < 0 °C | `psychro.js`: boven ijs voor t ≤ 0,01 °C | verwaarloosbaar |
| P2 | Mistcorrectie: isenthalpisch op de lucht alleen; condensaat telt als massa bij de waterstroom zonder energie | Isenthalpisch voor lucht + nevel (condensaat als water bij t_s), condensaat mengt met de waterstroom | Energiebalans in vorst-presets van 0,13–0,20 % naar ≤ 0,02 % (eis < 0,1 %). Verschil met het orakel ≤ 0,01 K en ≤ 0,07 % in Q. |
| P3 | Zonneschoorsteen: massastroom per segment ρ(θ_in,seg)·q | Overgenomen | Bekende vereenvoudiging: een massabehoudende variant geeft dezelfde Q (< 0,05 %) maar t_uit tot 0,26 K lager. Zie open punten. |
| P4 | Prototype rekent zonneschoorsteen altijd met 3,5 m-segmenten | 4 segmenten per verdieping (h_verd) | identiek bij 3,5 m |
| P5 | `P_pomp` in Bijlage B = alleen sproeipomp | Tabel "Alle weersituaties" toont sproei- + bronpomp | P_pomp ≈ 0,2 kW hoger dan Bijlage B |

## 5. Keuzes waar de specificatie open liet

| Onderwerp | Keuze |
|---|---|
| Thermische massa/transmissie | niet gemodelleerd (SPEC §1) |
| Variant A1 "tussenseizoen" | actief als optie aan staat en `t_A1,min ≤ θ_e ≤ t_toe,koel` (standaard 10…17 °C); naverwarmen tot 18 °C |
| Grens vorstwater | invoerveld `θ_e < 0 °C` (case D4) |
| Straling bij live weer en andere gevelazimut | GTI geldt alleen voor de opgevraagde azimut; anders Hay-Davies uit DNI/DHI |
| Zonnestand presets zonder tijdstip | ware middag (uurhoek 0) op 21-07 / 21-03 / 21-12 van 2026 |
| FiWiHEx-uittrede | `t_na = t_top − ε·(t_top − t_w,in)` (consistent met Q_hr) |
| Harde invoergrenzen | buiten het zinvolle bereik: oranje melding; buiten fysisch zinvolle grenzen wordt de waarde begrensd met melding, zodat nooit NaN ontstaat |
| Zonnefaçade | zelfde model; bij omschakelen B = gevelbreedte van een vierkante vloer (√AVO_verd), D = 0,65 m |
| Weerinvoer bewerken | schakelt de bron naar *Handmatig* (waarden van de preset/live-meting worden overgenomen) |
| Live-weer bewaren | alleen de gemapte waarden + tijdstempel in `project.ewf`, nooit de API-respons |
| Locatie live-weer | keuzelijst van zes KNMI-stations, De Bilt standaard |
| Deellink vanuit EWF | `?view=ewf` vóór de hash; het `#p=`-formaat zelf is ongewijzigd |
| "Open in Mollier-diagram" | debiet als droge-luchtmassastroom (kg/h) zodat ṁ identiek is aan het EWF-model (q_v geldt bij 1,20 kg/m³); stappen: klimaatcascade (nieuw procestype; bij een eigen spectrum een vrij punt), naverwarmen, ruimtebelasting (Q_s zo dat het eindpunt de ruimtetoestand is), zonneschoorsteen (verwarmen), FiWiHEx (koelen) |
| Procestype klimaatcascade | categorie *EWF-cascade*; doorsnede uit de luchtsnelheid bij 1,20 kg/m³; Q = ṁ·Δh luchtzijde (condensaat blijft in het water, dus geen condensaatterm) |
| Temperatuurkleuren schema | divergerend blauw – neutraal grijs – rood, −10…50 °C, midden 20 °C; licht en donker apart gekozen |
| Animatie | SMIL in het SVG (pauzeren zonder herrendering, ook in de SVG-export); standaard uit bij *prefers-reduced-motion* |
| "Alle weersituaties" | berekend in stukjes van < 25 ms (geen blokkade van de hoofdthread), opnieuw bij gebouwwijziging |
| Validatietabel in de app | eenmalig per sessie berekend bij het openen van *Methode & bronnen* |

## 6. Validatie

Alle waarden hieronder zijn berekend met de JavaScript-kern (`EwfModel.runValidation()`, ook live in de app) en
worden in `npm test` gecontroleerd (`test/ewf-*.test.js`). Notatie: *model (referentie)*. Daarnaast vergelijken de
tests alle uitkomsten met het orakel `test/fixtures/ewf-oracle.json` (temperaturen ± 0,3 K, drukken ± 1,0 Pa of
± 3 %, vermogens ± 3 %, RW/L ± 0,03); de afwijking is in alle gevallen < 0,01 K / < 0,01 Pa.

**Eindsnelheid druppels** (model / Gunn & Kinzer 1949, tolerantie ± 10 %)

| d [mm] | 0,5 | 1 | 1,5 | 2 | 3 |
|---|---|---|---|---|---|
| w_t [m/s] | 2,03 (2,06) ✅ | 3,87 (4,03) ✅ | 5,47 (5,40) ✅ | 6,94 (6,49) ✅ | 8,62 (8,06) ✅ |

**Klimaatcascade testopstelling** (tab. 3.4.7; model (meting); toleranties t ± 1,5 K (B1) / ± 1,0 K, t_w ± 0,5 K, x ± 1,0 g/kg, Δp ± 1,5 Pa, balans < 0,1 %)

| Case | t_uit [°C] | t_w,uit [°C] | x_uit [g/kg] | Δp [Pa] | balans [%] |
|---|---|---|---|---|---|
| B1 | 18,12 (16,85) ✅ | 15,23 (15,11) ✅ | 10,91 (11,64) ✅ | 5,81 (5,81) ✅ | 0,004 ✅ |
| B2 | 15,80 (15,21) ✅ | 14,44 (14,37) ✅ | 10,44 (10,87) ✅ | 6,80 (6,18) ✅ | 0,008 ✅ |
| B4 | 11,58 (11,60) ✅ | 11,99 (12,13) ✅ | 8,49 (8,38) ✅ | 8,38 (7,17) ✅ | 0,013 ✅ |
| B3 | 9,66 (9,54) ✅ | 10,86 (11,00) ✅ | 7,46 (7,15) ✅ | 9,21 (8,44) ✅ | 0,013 ✅ |
| B5 | 5,60 (5,78) ✅ | 8,42 (8,50) ✅ | 5,64 (5,39) ✅ | 10,85 (9,77) ✅ | 0,012 ✅ |

**Klimaatcascade ware grootte vs CFD** (tab. 3.3.9/2; H 28 m, 40 000 m³/h, 2 m/s; tolerantie ± 2,0 K)

| Case | t_uit model [°C] | CFD [°C] | Status |
|---|---|---|---|
| D1 | 16,26 | 16,5 | ✅ |
| D3 | 10,20 | 12,0 | ✅ |
| D4 | 7,68 | 6,5 | ✅ |

**Ventecdak** (tab. 2.5.3; U10 = 3,5 m/s, U_ej = 1 m/s, c = 2 m; model (proefschrift); U ± 0,03 m/s, p ± 3 % of ± 0,05 Pa)

| z [m] | U_ref [m/s] | onderdruk p_ej [Pa] | overdruk p_over [Pa] |
|---|---|---|---|
| 15 | 2,20 (2,20) ✅ | −0,64 (−0,64) ✅ | 2,38 (2,37) ✅ |
| 20 | 2,87 (2,86) ✅ | −1,47 (−1,46) ✅ | 4,04 (4,01) ✅ |
| 25 | 3,25 (3,25) ✅ | −2,14 (−2,12) ✅ | 5,20 (5,18) ✅ |
| 30 | 3,53 (3,52) ✅ | −2,69 (−2,68) ✅ | 6,12 (6,09) ✅ |
| 35 | 3,74 (3,74) ✅ | −3,18 (−3,16) ✅ | 6,88 (6,85) ✅ |
| 40 | 3,92 (3,91) ✅ | −3,61 (−3,58) ✅ | 7,54 (7,50) ✅ |
| 45 | 4,06 (4,06) ✅ | −3,99 (−3,97) ✅ | 8,12 (8,07) ✅ |
| 50 | 4,19 (4,19) ✅ | −4,34 (−4,32) ✅ | 8,64 (8,59) ✅ |

**Thermische trek, vereenvoudiging proefschrift** (§3.5.5.4/5; 10 verd., ρ0 = 1,293, T0 = 273 K; ± 0,2 Pa)

| Positie | Model [Pa] | Referentie [Pa] | Status |
|---|---|---|---|
| zomer voet | 7,49 | 7,5 (proefschrift) | ✅ |
| winter voet | −14,02 | −14,0 (proefschrift) | ✅ |
| winter top, schacht 18 °C ¹ | 30,33 | 30,3 (SPEC §5.4) | ✅ |
| winter top, conventie proefschrift ² | 16,31 | 16,3 (proefschrift) | ✅ |

**Zonneschoorsteen** (referentie 20 °C, 400 W/m², PT-glas, B 3,6 m, D 0,65 m, w 1,5 m/s; η ∈ [0,60; 0,68], ΔT/verd ∈ [0,66; 0,80] K)

| Verdiepingen | η [–] | ΔT/verd [K] |
|---|---|---|
| 4 | 0,660 ✅ | 0,742 ✅ |
| 6 | 0,656 ✅ | 0,740 ✅ |
| 8 | 0,653 ✅ | 0,738 ✅ |
| 10 | 0,650 ✅ | 0,736 ✅ |
| 14 | 0,644 ✅ | 0,732 ✅ |

| Case | Grootheid | Model | Proefschrift | Tolerantie | Status |
|---|---|---|---|---|---|
| Extreem 32 °C / 840 W/m², PS-glas, 14 verd. | t_glas,max | 59,0 °C | ≈ 60 °C | ± 3 K | ✅ |
| idem | t_wand,max | 75,1 °C | ≈ 73 °C | ± 4 K | ✅ |
| Testopstelling 15-12-2009 (730 W/m², 0,55 °C) | t_uit | 33,9 °C | 32,1 °C (meting) | ± 2,5 K | ✅ |

¹ Maatgevend (besluit opdrachtgever 6-10-2026): neutrale zone volgens SPEC §5.4, toevoerschacht t.o.v. de buitenlucht.
² Alleen ter vergelijking: het proefschrift rekent de toevoerschacht t.o.v. de cascadekolom; zie afwijking #11.

Opmerkingen bij de validatie:
- De cascade voorspelt bij B1 (27 °C, 52 %) een 1,3 K hogere uittredetemperatuur dan gemeten en een iets lager
  vochtgehalte; bij de andere metingen is het verschil < 0,6 K. De drukopbouw wordt tot 1,2 Pa overschat
  (meetreferentie laboratoriumhal ≈ 20 °C).
- Ware grootte: D3 (5 °C) komt 1,8 K lager uit dan de CFD — binnen de tolerantie van 2 K, maar het grootste verschil.
- Voor grove sproeispectra (s1–s7) wijkt de tool af van tabel 3.5.2/1 van het proefschrift (afwijking #1).

## 7. Standaardgebouw, alle weersituaties

8 verdiepingen à 3,5 m, 1000 m² AVO per laag, 40 320 m³/h, zonneschoorsteen zuid (B 11,5 m, D 0,65 m),
Fulljet-sproeier, terreinklasse 6. P_pomp = sproei- + bronpomp.

| Weersituatie | Modus | RW/L | t uit cascade [°C] | Q_cascade [kW] | Q_na [kW] | RV ruimte [%] | Φ gevel [W/m²] | t_zs [°C] | Q_zs [kW] | p_over / p_ej [Pa] | min. marge toevoer / afvoer [Pa] | P_vent [kW] | P_pomp [kW] | COP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ontwerp zomer | koelen | 0,85 | 17,0 | −184 | 0 | 65 | 400 | 31,1 | 81 | 6,1 / −2,7 | 67,4 / −14,8 | 0,22 | 5,18 | 36 |
| Gemiddelde zomerdag | koelen | 0,30 | 16,8 | −54 | 3 | 62 | 400 | 30,8 | 78 | 6,3 / −2,8 | 12,0 / −11,7 | 0,17 | 1,83 | 29 |
| Hittegolf 25-07-2019 | koelen | 1,16 | 17,0 | −253 | 0 | 66 | 490 | 31,3 | 85 | 4,4 / −1,7 | 95,6 / −24,5 | 0,36 | 7,05 | 36 |
| Benauwd 12-08-2020 | koelen | 0,98 | 17,0 | −214 | 0 | 66 | 574 | 32,9 | 106 | 4,4 / −1,7 | 78,6 / −18,1 | 0,26 | 5,97 | 36 |
| Voorjaar 15-03-2023 | verwarmen | 0,90 | 9,8 | 163 | 111 | 55 | 895 | 33,7 | 170 | 4,8 / −1,9 | 74,2 / −9,1 | 0,13 | 5,54 | — |
| Tussenseizoen | verwarmen | 0,90 | 11,8 | 59 | 84 | 62 | 150 | 22,9 | 25 | 6,5 / −2,9 | 76,0 / −13,5 | 0,20 | 5,52 | — |
| Gemiddelde winterdag | verwarmen | 0,90 | 9,9 | 158 | 111 | 55 | 80 | 21,7 | 9 | 8,7 / −4,3 | 75,7 / −12,7 | 0,19 | 5,53 | — |
| Zonnige winterdag | verwarmen | 0,90 | 8,4 | 232 | 131 | 51 | 730 | 31,3 | 137 | 5,0 / −2,0 | 69,6 / −9,6 | 0,14 | 5,54 | — |
| Koude-inval 13-02-2021 | verwarmen | 0,90 | 7,8 | 368 | 140 | 49 | 708 | 29,9 | 118 | 5,1 / −2,0 | 63,0 / −9,9 | 0,15 | 5,55 | — |
| Ontwerp winter | verwarmen | 0,90 | 7,2 | 396 | 148 | 47 | 0 | 20,0 (dicht) | −14 | 14,3 / −8,3 | 69,8 / −7,1 | 0,10 | 5,55 | — |
| Storm Eunice 18-02-2022 | verwarmen | 0,90 | 10,8 | 115 | 98 | 58 | 184 | 23,2 | 30 | 89,6 / −73,4 | 160,3 / 56,7 | 0,00 | 5,54 | — |
| Windstil, bewolkt | koelen | 0,30 | 16,8 | −54 | 3 | 62 | 120 | 26,6 | 22 | 0,3 / −0,0 | 6,1 / −16,8 | 0,25 | 1,83 | 29 |

Wat dit laat zien:
- De **hydraulische trek** (≈ 90 Pa bij 8 lagen) domineert de toevoer: er moet bijna altijd gesmoord worden.
  Met RW/L = 0,3 en weinig wind blijft 6–12 Pa marge over; met variant A1 (cascade uit) is een hulpventilator nodig.
- De **afvoer** komt bij 8 lagen meestal 7–25 Pa tekort (zonneschoorsteen + ejector < verliezen incl. FiWiHEx);
  de hulpventilator vraagt 0,1–0,4 kW. In de winter hebben de bovenste lagen het minste trek (shuntkolom).
- Bij **storm** worden over- en onderdruk zo groot dat de kleppen fors moeten smoren.
- De cascade haalt 17 °C ook bij de **hittegolf** (RW/L ≈ 1,16), maar de ruimte-RV komt in de zomer boven 60 %.

## 8. Bronnen

**Primair**
- Bronsema, B. (2013). *Earth, Wind & Fire – Natuurlijke Airconditioning*. Proefschrift TU Delft (promotie
  7 juni 2013; promotoren P.G. Luscuere, A.P.J.M. Verheijen). Eburon, Delft. ISBN 978-90-5972-762-5.
  https://repository.tudelft.nl/islandora/object/uuid:d181a9f2-2123-4de1-8856-cd7da74e8268

**Gebruikte methoden en data**
- ASHRAE (2017). *Handbook – Fundamentals*, hoofdstuk 1 Psychrometrics.
- Ranz, W.E. & Marshall, W.R. (1952). Evaporation from drops. *Chemical Engineering Progress* 48(3): 141–146; 48(4): 173–180.
- Schiller, L. & Naumann, A. (1933). Über die grundlegenden Berechnungen bei der Schwerkraftaufbereitung. *Z. VDI* 77: 318–320.
- Gunn, R. & Kinzer, G.D. (1949). The terminal velocity of fall for water droplets in stagnant air. *Journal of Meteorology* 6: 243–248.
- Churchill, S.W. & Usagi, R. (1972). A general expression for the correlation of rates of transfer and other phenomena. *AIChE Journal* 18(6): 1121–1128.
- Colebrook, C.F. (1939). Turbulent flow in pipes… *J. Inst. Civil Engineers* 11: 133–156; Swamee, P.K. & Jain, A.K. (1976). *J. Hydraulics Div. ASCE* 102(5): 657–664.
- van Hooff, T., Blocken, B., Aanen, L. & Bronsema, B. (2011). A venturi-shaped roof for wind-induced natural ventilation of buildings. *Building and Environment* 46(9): 1797–1807.
- Blocken, B., van Hooff, T., Aanen, L. & Bronsema, B. (2011). Computational analysis of the performance of a venturi-shaped roof for natural ventilation. *Computers & Fluids* 48(1): 202–213.
- Wieringa, J. & Rijkoort, P.J. (1983). *Windklimaat van Nederland*. KNMI / Staatsuitgeverij.
- Erbs, D.G., Klein, S.A. & Duffie, J.A. (1982). Estimation of the diffuse radiation fraction for hourly, daily and monthly-average global radiation. *Solar Energy* 28(4): 293–302.
- Hay, J.E. & Davies, J.A. (1980). Calculation of the solar radiation incident on an inclined surface. *Proc. First Canadian Solar Radiation Data Workshop*, 59–72; Duffie, J.A. & Beckman, W.A. (2013). *Solar Engineering of Thermal Processes*, 4e druk, Wiley, §2.16.
- NOAA Global Monitoring Laboratory. *General Solar Position Calculations*. https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- NEN-EN 16798-1:2019 — ventilatiedebieten categorie I–III.
- Besluit bouwwerken leefomgeving (Bbl), art. 4.122 lid 2. https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/nieuwbouw/rijksregels/ventilatie/
- ISSO-publicaties 51/53/57 (2017) — basis-ontwerpbuitentemperatuur −10 °C.
- KNMI — uurgegevens station 260 De Bilt (presets). https://www.daggegevens.knmi.nl/klimatologie/uurgegevens
- KNMI (2024). *Vijf jaar na het nationale hitterecord van 40,7 ℃*. https://www.knmi.nl/over-het-knmi/nieuws/vijf-jaar-na-het-nationale-hitterecord-van-40-7
- Open-Meteo.com — Forecast API, KNMI-modellen (HARMONIE-AROME), CC BY 4.0. https://open-meteo.com/en/docs/knmi-api

NEN 5060 (referentieklimaatjaren) wordt alleen genoemd: de data zijn auteursrechtelijk beschermd en worden niet meegeleverd.

## 9. Open punten

Afgehandeld:
- **Thermische trek bovenin (afwijking #11).** De opdrachtgever heeft op 6-10-2026 bevestigd dat SPEC §5.4
  maatgevend is (+30,3 Pa bij −10 °C met een toevoerschacht van 18 °C).
- **Live-weer op GitHub Pages.** Mapping, foutafhandeling, time-out en cache zijn getest met de voorbeeldrespons;
  op 6-10-2026 heeft de opdrachtgever "Weer van nu in De Bilt" op de live site getest tegen de echte Open-Meteo-API:
  werkt.

Nog open (bewuste vereenvoudigingen, kandidaat voor een volgende versie):
- **Massastroom zonneschoorsteen (P3).** Overgenomen uit het prototype; een massabehoudende formulering verlaagt
  t_uit tot 0,26 K (Q gelijk). Kandidaat voor een volgende versie, samen met een nieuw orakel.
- **Luchtvochtigheid in de schoorsteen.** De dichtheid in de schoorsteen wordt (zoals in het prototype) met x_e
  berekend i.p.v. x_ruimte. In de zomer is het verschil verwaarloosbaar; bij vorst is de afvoerlucht ≈ 6 g/kg
  vochtiger dan de buitenlucht en wordt de trek daardoor ≈ 1 Pa onderschat (8 lagen, open schoorsteen).
- **Fase 6 (optioneel, SPEC §13).** Dagverloop uit de uurverwachting en een modus "vrij stromend" (debiet uit
  drukevenwicht) zijn niet gebouwd.
