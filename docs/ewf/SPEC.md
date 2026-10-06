# Earth, Wind & Fire-module voor de Mollier-tool — bouwspecificatie voor Claude Code

| | |
|---|---|
| **Repo** | `thomas3a/Mollier-Diagram` (GitHub Pages: https://thomas3a.github.io/Mollier-Diagram/) |
| **Opdracht** | Voeg een tweede weergave **“Earth, Wind & Fire”** toe naast het Mollier-diagram: een fysisch onderbouwde simulatie van het EWF-concept (Ventecdak, Klimaatcascade, Zonneschoorsteen) voor een kantoorgebouw in Nederland, met realistische weersituaties, “weer van nu in De Bilt”, visualisatie volgens de conceptschets en bronvermelding. |
| **Gebruikers** | Adviseurs installatietechniek (W-installaties, klimaat). Technisch mag, helder moet. |
| **Taal** | UI Nederlands (standaard) + Engels via bestaande `i18n.js`. Code-identifiers Engels, commentaar Nederlands (zoals de bestaande code). |
| **Bron** | B. Bronsema (2013), *Earth, Wind & Fire – Natuurlijke Airconditioning*, proefschrift TU Delft. Formule- en paragraafnummers in dit document verwijzen daarnaar (bijv. “3.2.15/6”, “§4.5.11”). |
| **Bijlagen** | `docs/ewf/ewf_prototype.py` (referentie-implementatie / testorakel), `test/fixtures/ewf-oracle.json` (uitkomsten orakel), `test/fixtures/openmeteo-current-debilt.json` (voorbeeldrespons weer-API). |
| **Versie** | 1.0 — 6 oktober 2026 |

---

## 0. Lees dit eerst — werkafspraken

1. **Lees dit hele document voordat je code schrijft.** Lees daarna `README.md`, `js/psychro.js`, `js/processes.js`, `js/chart.js` (klasse-API), de structuur van `js/app.js`, `js/i18n.js`, de tokens in `css/app.css` en `test/*.test.js`.
2. **Het proefschrift zit niet in de repo** (382 pagina’s, © auteur, “alle rechten voorbehouden”). Alles wat je nodig hebt staat hier. Neem **geen figuren of lange tekstpassages** uit het proefschrift over; teken een eigen schema (§8.5) en verwijs met formulenummers.
3. **Fysica bij twijfel: volg `ewf_prototype.py`.** Dat script is gevalideerd tegen de metingen in het proefschrift (§12). Je JavaScript moet binnen de toleranties van §12 dezelfde getallen geven. Draai het met `python3 docs/ewf/ewf_prototype.py`.
4. **Geen build-stap, geen nieuwe dependencies, geen frameworks.** Vanilla JS (ES2020), D3 v7 staat al in `vendor/`. Alles draait statisch op GitHub Pages en offline (behalve de weer-API).
5. **Rekenkern zonder DOM**, als UMD-module zoals `psychro.js`, zodat `node --test` hem kan laden. UI-code apart.
6. **Werk in fasen (§13).** Na elke fase: `npm test` groen, handmatig controleren met `npm start`, commit met duidelijke boodschap. **Bestaande functionaliteit en tests mogen niet breken** (inclusief deellinks `#p=…`, opslaan/openen, ongedaan maken, thema’s, de verborgen huisstijl).
7. Laat de spec een keuze open, kies dan de eenvoudigste oplossing die bij de bestaande code past en leg de keuze vast in `docs/ewf/METHODE.md`.

---

## 1. Doel en reikwijdte

**Wel**
- Quasi-stationaire **momentopname** van het complete EWF-systeem voor één weersituatie: luchtbehandeling in de klimaatcascade, drukopbouw (wind, hydraulische en thermische trek), zonneschoorsteen (temperaturen, warmte-oogst, trek), drukbalans per verdieping, benodigde hulpventilatie, pomp- en ventilatorvermogens, COP.
- **Gebouwparameters als invoer** (verdiepingen, m², hoogte, bezetting, lasten, afmetingen van de EWF-onderdelen). **Standaard staat een gebruikelijk kantoorgebouw ingevuld**, zodat er direct een simulatie te zien is (§7).
- **Weersituaties**: een lijst realistische Nederlandse situaties (ontwerpcondities en echte KNMI-uren, §6.3), handmatige invoer, en een knop **“Weer van nu in De Bilt”** (KNMI HARMONIE-AROME via Open-Meteo, §6.2).
- **Visualisatie** volgens de conceptschets uit het proefschrift (fig. 1.3/1): schematische doorsnede met kleuren per temperatuur, stromingspijlen, waarden per onderdeel (§8.5). Daarnaast grafieken (cascadeprofiel, drukbalans, zonneschoorsteen, Mollier).
- **Koppeling met het bestaande Mollier-diagram** (§9) en **bronvermelding** in de app (§8.9, §11).

**Niet (in deze versie)**
- Geen jaarsimulatie of dynamisch gebouwmodel (geen transmissie, geen thermische massa). Een dagverloop op basis van de uurverwachting is optioneel (fase 6).
- Geen CFD, geen ontwerp van luchtkanalen per ruimte, geen windturbines of PV-opbrengst (hoofdstuk 5 van het proefschrift) — hooguit een vermelding.
- Geen KNMI-API met eigen sleutel in de browser (§6.2, §14).

---

## 2. Het concept in het kort (voor de UI-teksten en het schema)

Legenda zoals in fig. 1.3/1 van het proefschrift (gebruik dezelfde nummering in het schema):

| Nr | Onderdeel | Functie |
|---|---|---|
| 1 | **Overdrukruimte** (in het Ventecdak) | Vangt buitenlucht aan de loefzijde via dakoverstekken en kleppen; winddruk (Cp ≈ 0,8) geeft overdruk. |
| 2 | **Verblijfsruimten** | Kantoorverdiepingen; toevoer via toevoerschacht (verdringingsventilatie), restlast via klimaatplafonds. |
| 3 | **Shuntkanaal** | Verzamelt afgezogen lucht van alle verdiepingen en voert die omlaag naar de voet van de zonneschoorsteen, zodat elke verdieping ongeveer dezelfde onderdruk ziet (§4.1.11). |
| 4 | **FiWiHEx-installatie** | Dunne-draad-warmtewisselaar bovenaan de zonneschoorsteen: zonnewarmte → water → WKO (§4.5.8.2). |
| 5 | **Hulpventilator(en)** | In de cascade (toevoer) en bij de FiWiHEx (afvoer); vullen tekorten aan natuurlijke drijvende kracht aan. |
| 6 | **Venturi-ejector** | Uitmonding van de afvoer in de keel van het Ventecdak; wind geeft onderdruk (Cp < 0). |
| 7 | **Recirculatieklep** | Weekend/buiten bedrijfstijd: recirculatie via shunt (warmte-oogst zonder ventilatie). |
| 8 | **Warmteopslag (WKO)** | Koude bron (≈ 12 °C) voor het cascadewater; warme bron voor geoogste zonnewarmte. |
| 9 | **Technische ruimte** | Waterbassin onder de cascade, sproeipomp, warmtewisselaar met het bronsysteem. |
| — | **Klimaatcascade** | Bouwkundige schacht; sproeiers bovenin versproeien water van ≈ 13 °C; druppels koelen/drogen (zomer) of verwarmen/bevochtigen (winter) de lucht en leveren door hun gewicht neerwaartse druk (“hydraulische trek”). |
| — | **Zonneschoorsteen / zonnefaçade** | Beglaasde schacht op de zonzijde; zon verwarmt de afvoerlucht → thermische trek + warmte-oogst. |
| — | **Ventecdak** | Dakopbouw met gebogen bovendak (“pseudo-venturi”): overdruk voor de toevoer, onderdruk voor de afvoer. |

**Luchtweg.** Buiten → (1) → klimaatcascade (omlaag) → bassin (9) → toevoerschacht (omhoog) → verdiepingen (2) → gang/atrium → shuntkanaal (3, omlaag) → zonneschoorsteen (omhoog) → FiWiHEx (4) → venturi-ejector (6) → buiten.

**Twee principes die het rekenmodel bepalen:**
- **Het gebouw is een neutrale zone** (§3.5.5.2): de druk in de verblijfsruimten is gelijk aan de buitendruk op dezelfde hoogte. Toevoer en afvoer worden daarom **elk afzonderlijk** in drukbalans gebracht; overdruk aan de toevoerkant kan een tekort aan de afvoerkant niet compenseren.
- **Het debiet wordt constant geregeld** (§2.5.5, §3.5.5.8, §4.5.5): de tool rekent met het ontwerpdebiet en bepaalt per verdieping of de natuurlijke drijvende krachten volstaan. Een **overschot** wordt met kleppen weggesmoord, een **tekort** door een hulpventilator aangevuld (met elektrisch vermogen).

---

## 3. Bestaande code en integratieregels

| Bestand | Wat erin zit | Wat je doet |
|---|---|---|
| `index.html` | Topbalk, zijbalk, diagramkaart, resultaten, dialogen; laadt scripts in volgorde `d3 → psychro → processes → i18n → chart → app`. | Weergaveschakelaar in de topbalk toevoegen; container voor de EWF-weergave; nieuwe scripts **na** `chart.js` en **vóór** `app.js` laden (of laat `app.js` de EWF-view initialiseren — kies wat het netst is). |
| `js/psychro.js` | Rekenkern vochtige lucht, ASHRAE 2017 (Hyland-Wexler), mistgebied. API: `state, fromPair, satHumRatio, xFromTRh, enthalpy, specificVolume, …`. | **Hergebruiken** voor alle psychrometrie in de EWF-kern. Niets wijzigen, behalve als je een kleine helper toevoegt (bijv. `satVapPresLiquid(t)` voor onderkoeld water) — dan met test. |
| `js/processes.js` | Procescatalogus `TYPES`, `computeScenario`. Elke stap geeft `{state, path, info}`. | Fase 5: nieuw procestype `cascade` (§9.3). |
| `js/chart.js` | Klasse voor Mollier- en psychrometrisch diagram (SVG, D3), `configure(opts)`, `setData(data)`. | **Hergebruiken** voor een mini-Mollier in de EWF-weergave (tweede instantie). |
| `js/i18n.js` | `nl` en `en` objecten, `t(key, vars)`, `fmt`, `parseNum`. | Alle nieuwe teksten onder `ewf.*` in **beide** talen. |
| `js/app.js` | Toestand (`project`), geschiedenis, opslag (`localStorage`), deellink (`#p=` + deflate), export, events. IIFE. | Minimale uitbreiding: `project.ewf` (§10), weergaveschakelaar, een klein publiek koppelvlak (bijv. `window.MollierApp = { t, fmt, change, toast, getProject, addScenario }`) zodat de EWF-view kan meedoen met opslag/ongedaan maken. Refactor niet meer dan nodig. |
| `css/app.css` | Tokens op `:root`, donker via `prefers-color-scheme` én `[data-theme="dark"]`, huisstijl-variant. | Nieuwe stijl in `css/ewf.css` met **dezelfde tokens**; alles werkt in licht, donker en de verborgen huisstijl. |
| `test/` | `node:test`, PsychroLib-referentie. | Nieuwe tests `test/ewf-*.test.js` (§12). |
| `.github/workflows/test.yml` | `npm test` op Node 22. | Ongewijzigd; nieuwe tests draaien automatisch mee. |

---

## 4. Architectuur van de nieuwe module

```
js/ewf/
  physics.js     UMD  → root.EwfPhysics   wind/Ventecdak, cascade, zonneschoorsteen, trek, wrijving   (geen DOM)
  solar.js       UMD  → root.EwfSolar     zonnestand, Erbs, Hay-Davies, g(θ)                          (geen DOM)
  model.js       UMD  → root.EwfModel     standaardgebouw, presets, simulate(), simulateAll()         (geen DOM)
  weather.js     browser + Node-testbaar  Open-Meteo ophalen en mappen, cache                          (fetch injecteerbaar)
  schematic.js   browser                  SVG-doorsnede (§8.5)
  charts.js      browser                  D3-grafieken (§8.6)
  view.js        browser                  formulieren, KPI's, tabbladen, koppeling met app.js
css/ewf.css
docs/ewf/SPEC.md (dit document), METHODE.md (door jou te schrijven), ewf_prototype.py
test/ewf-physics.test.js, ewf-solar.test.js, ewf-model.test.js, ewf-weather.test.js
test/fixtures/ewf-oracle.json, openmeteo-current-debilt.json
```

**Kern-API (SI-eenheden intern: °C, Pa, kg/kg, kg/s, m³/s, W; de UI rekent om):**

```js
EwfPhysics.windAtHeight(U10, z, { z0, d })                         // m/s
EwfPhysics.cpEjector(Uej, Uref, c)                                 // { cp, warning }
EwfPhysics.ventecdak({ U10, zRoof, qExh, aEjector, rho, c, cpIn, z0, d })
    // → { Uref, qDyn, pOver, pEj, cpEj, Uej, warnings[] }
EwfPhysics.dropTerminal(d, t, p)                                   // m/s
EwfPhysics.cascade({ H, Ac, mDa, tIn, xIn, mW, tWIn, d30, d32, p, w0 = 10, N = 400, active = true })
    // → { t, x, rh, tw, Q, dpHydr, dpAero, profile:[{z,t,x,rh,tw,wd,rho}], mEvap, wAir, tRes, balanceErr, warnings[] }
EwfPhysics.cascadeAutoRwl({ ...zoals cascade, tTarget, rwlMin = 0.3, rwlMax = 1.2 })  // → { rwl, warning }
EwfPhysics.stackDraft(profile, rhoOutside)                         // Σ g·Δz·(ρ_kolom − ρ_e)  [Pa]
EwfPhysics.chimney({ H, B, D, q, tIn, tE, xE, phiBeam, phiDiff, theta, g, U, R, f1, f2, epsW, epsGl,
                     Uwall, tBack, angleCorr = true, p })
    // → { tOut, Q, eta, dpTh, w, tGlassMax, tWallMax, profile:[{z,t,tgl,tw}] }
EwfPhysics.frictionDp(L, Dh, w, rho, eps = 0.010, nu = 1.6e-5)     // Pa

EwfSolar.sunPosition(dateUTC, lat, lon)                            // { alt, az (0 = zuid, + = west), doy }
EwfSolar.onSurface({ ghi, dni?, dhi?, alt, az, doy, surfAz, tilt = 90, albedo = 0.2 })
    // → { beam, diffuse, theta }   (Erbs als dni/dhi ontbreken, Hay-Davies-transpositie)
EwfSolar.gAngleFactor(thetaDeg)                                    // g(θ)/g(0)

EwfModel.DEFAULTS, EwfModel.PRESETS, EwfModel.GLASS, EwfModel.SPRAY
EwfModel.simulate(building, weather, options)   // → resultaatobject (§5.11)
EwfModel.simulateAll(building, presets)         // → rijen voor de vergelijkingstabel (§8.7)

EwfWeather.fetchCurrent({ lat, lon, surfAz, fetchImpl = fetch, signal })  // → Promise<weather>
EwfWeather.mapOpenMeteo(json, { surfAz })                                  // puur, testbaar met fixture
```

**Prestatie-eis:** één `simulate()` inclusief automatische RW/L-regeling < 30 ms op een gemiddelde laptop; `simulateAll()` (12 presets) < 400 ms. Herberekenen bij invoer **met debounce (≈ 150 ms)**; nooit de hoofdthread langer dan 50 ms blokkeren.

---

## 5. Rekenmodel

### 5.0 Conventies

- **Hoogte z**: 0 = maaiveld/voet van cascade en schoorsteen; boven = positief. Gebouwhoogte `H = n_verd · h_verd`. Cascade actief over `H` (sproeiers bovenaan), zonneschoorsteen over `H`.
- **Druk**: alle drukken zijn **relatief t.o.v. de statische buitendruk op dezelfde hoogte** [Pa]. Positief = overdruk.
- **Dichtheid** altijd uit `ρ = p/(R_da·T·(1 + 1,607858·x))·(1 + x)` (ASHRAE eq. 11/28, gelijk aan `psychro.js`); buitenluchtdichtheid `ρ_e` constant over de hoogte (luchtdrukgradiënt verwaarloosd).
- **Luchtdruk p**: uit het weer (Open-Meteo `surface_pressure`) of 101 325 Pa.
- **Debiet**: ventilatiedebiet `q_v` [m³/s] gedefinieerd bij ρ_ref = 1,20 kg/m³ (lucht van ≈ 20 °C). Droge-luchtmassastroom `ṁ_da = q_v·1,20/(1 + x_e)`. Afvoerdebiet = toevoerdebiet (gebouw in balans).
- **Water/luchtfactor** `RW/L = ṁ_w / ṁ_da` (§3.1.8).
- **Zonazimut en gevelazimut**: 0° = zuid, −90° = oost, +90° = west, ±180° = noord (zelfde conventie als Open-Meteo).
- Elke berekende waarde die op een **aanname** berust (geen bron in het proefschrift) staat als zodanig in de UI (badge “aanname”, zie §7).

### 5.1 Gebouw en ventilatiedebiet

```
AVO        = n_verd · AVO_verd                         afdelingsvloeroppervlak (NEN 2580)
BVO        = AVO · f_BVO                               (alleen informatief; f_BVO = 1,5 — case study §7.2.2: 3700/2480)
n_pers     = AVO · bezettingsdichtheid                 standaard 0,10 p/m² AVO (10 m²/p, §3.1.7.2)
q_v [dm³/s]= n_pers · q_p + AVO · q_B                  NEN-EN 16798-1, cat. II: q_p = 7 dm³/s·p, q_B = 0,7 dm³/(s·m²) (laag-emitterend)
```
- Met de standaardwaarden: 1,4 dm³/(s·m²) ≈ 5 m³/(m²·h) — precies het uitgangspunt van het proefschrift (§3.5.1.1, §4.5.2).
- Keuzelijst categorie × emissieklasse volgens NEN-EN 16798-1 (dezelfde waarden als tabel 3.5.1/1 van het proefschrift):

  | Categorie | q_p [dm³/s·p] | q_B zeer laag-emitterend | q_B laag-emitterend | q_B niet laag-emitterend [dm³/(s·m²)] |
  |---|---|---|---|---|
  | I | 10 | 0,5 | 1,0 | 2,0 |
  | **II** (standaard) | **7** | 0,35 | **0,7** | 1,4 |
  | III | 4 | 0,2 | 0,4 | 0,8 |

  Plus optie “handmatig debiet [m³/h]”.
- **Bbl-controle**: `q_v ≥ n_pers · 6,5 dm³/s` (Bbl art. 4.122 lid 2, kantoorfunctie). Zo niet: waarschuwing.

### 5.2 Wind en Ventecdak (hoofdstuk 2)

**Windprofiel** (2.1.1, 2.5.1–2.5.3). De KNMI-windsnelheid op 10 m in open terrein (z0 = 0,03 m) is de “potentiële windsnelheid” U10. Mesowind op 60 m en lokaal profiel:
```
U_meso = U10 · ln(60/0,03) / ln(10/0,03)            (= 1,309 · U10)
U(z)   = U_meso · ln((z − d)/z0) / ln(60/z0)        met (z − d) ≥ z0
```
Terreinklasse (Davenport, tabel 2.1.1) als keuzelijst: 4 “ruwweg open” z0 = 0,1, d = 0 · 5 “ruw” 0,25, d = 0 · **6 “zeer ruw” 0,5, d = 10 m (standaard, CFD/windtunnel in het proefschrift)** · 7 “gesloten” 1,0, d = 10 · 8 “stadskern” 2,0, d = 15 (d voor klasse 7–8 is een aanname). Waarschuwing als `z_dak < d + 5 m` (log-profiel onbetrouwbaar).
Controle: met z0 = 0,5 en d = 10 volgt `U(z) = 0,273·U10·ln((z−10)/0,5)` — formule 2.5.3.

**Referentiehoogte** `z_dak = H + Δz_dak` (standaard Δz_dak = 4 m: techniekverdieping 3,7 m, fig. 2.2.2, aanname). `U_ref = U(z_dak)`, `q_dyn = ½·ρ_e·U_ref²`.

**Overdruk inlaat** (2.1.4, §2.5.3): `p_over = Cp_in · q_dyn`, Cp_in = 0,8 (windtunnel, §2.4.3). Drukverlies van rooster/gelijkrichter/kleppen < 5 % → verwaarloosd (§2.5.3).

**Onderdruk venturi-ejector** (2.3.1/2.3.2, CFD gevalideerd in de windtunnel):
```
U_ej = q_v / A_ej                                   A_ej = q_v,ontwerp / U_ej,ontwerp (standaard U_ej,ontwerp = 1,0 m/s)
c = 1 m:  Cp_ej = 0,5374·ln(U_ej/U_ref) + 0,6381    (2.3.1)
c = 2 m:  Cp_ej = 0,2913·ln(U_ej/U_ref) + 0,0151    (2.3.2, standaard; ook gebruikt in §2.5 en de case study)
p_ej = Cp_ej · q_dyn                                (negatief = zuigend)
```
Geldigheidsgebied `0,1 ≤ U_ej/U_ref ≤ 0,8` (tabel 2.4.1): daarbuiten de grenswaarde gebruiken en waarschuwen. Bij `U_ref < 0,05 m/s`: p_ej = 0. Let op: bij c = 1 m wordt Cp positief voor U_ej/U_ref ≥ 0,3 (ejector werkt dan tégen). Ventecdak zonder geleideschoepen is **windrichtingonafhankelijk** (§2.2.4 NB) — windrichting is alleen informatief.

### 5.3 Klimaatcascade (hoofdstuk 3)

**Geometrie.** `A_c = q_v / w_c` (standaard w_c = 2,0 m/s, §3.2.15.3, §3.5.2.2; zinvol bereik 1,0–2,5 m/s). Vierkante schacht, zijde `√A_c`. Actieve hoogte `H_c = H` (optie: sproeiers lager, §3.3.10).

**Sproeispectrum.** Invoer via keuzelijst `EwfModel.SPRAY`:

| Sleutel | Omschrijving | d30 [mm] | d32 [mm] | Bron |
|---|---|---|---|---|
| `fulljet` (**standaard**) | Fulljet 3/4GG-3050, 0,5 bar — sproeier uit de testopstelling | 1,048 | 1,317 | §3.4.10.1 |
| `s1` … `s10` | Spectra 1–10 (koeltorenspectrum, telkens 10 % kleiner) | 4,01 … 0,40 | 5,14 … 0,51 | tabel 3.2.3/2 |
| `custom` | Eigen d30/d32 | — | — | — |

Tabel 3.2.3/2 volledig (d10, d20, d30, d32 in mm): s1 2,95/3,55/4,01/5,14 · s2 2,65/3,19/3,61/4,62 · s3 2,36/2,84/3,21/4,11 · s4 2,06/2,48/2,81/3,60 · s5 1,77/2,13/2,41/3,08 · s6 1,47/1,77/2,01/2,57 · s7 1,18/1,42/1,61/2,05 · s8 0,88/1,06/1,20/1,54 · s9 0,59/0,71/0,80/1,03 · s10 0,29/0,35/0,40/0,51.
Beginsnelheid druppels w0 = 10 m/s (≈ 0,5 bar voordruk, §3.2.4); invoerbaar 4–15 m/s.

**Celmodel (gelijkstroom, van boven naar beneden).** Implementeer exact zoals `cascade()` in het prototype. N = 400 cellen, Δz = H_c/N, expliciete stap per cel in deze volgorde:

```
w_a  = ṁ_da·(1 + x_in) / (ρ(t_in, x_in)·A_c)               luchtsnelheid, constant verondersteld
start: t = t_in, x = x_in, t_w = t_w,in, ṁ_w = RW/L·ṁ_da, w_d = w0
per cel:
  ρ_a, μ (Sutherland), λ = 0,0241·(T/273,15)^0,81, D_v = 0,926/p[kPa]·T^2,5/(T+245)·1e-6    (3.2.7/3)
  w_r  = w_d − w_a                                         relatieve druppelsnelheid
  Δt   = Δz / w_d                                          verblijftijd in de cel
  C_d  = 24/Re·(1 + 0,15·Re^0,687) (Re<1000), anders 0,44    Re = ρ_a·|w_r|·d30/μ    (3.2.4/3)
  a    = g·(1 − ρ_a/ρ_w) − ¾·(ρ_a/ρ_w)·C_d·w_r·|w_r| / d30                           (3.2.4/4)
  w_d' = max(w_d + a·Δt, w_a + 0,05)
  Δp_hydr += (ṁ_w/A_c)·g·Δt                                gewicht van het zwevende water   (3.2.15/3–6)
  Δp_aero += (ṁ_w/A_c)·(w_d − w_d')                        ALLEEN informatief (zie 5.10)    (3.2.15/2)
  A    = 6·(ṁ_w/ρ_w)·Δt / d32                              druppeloppervlak in de cel (Sauter)
  Re   = |w_r|·d32/ν,  Pr = 0,71,  Sc = ν/D_v
  h_c  = (2 + 0,6·Pr^⅓·Re^½)·λ/d32                         Ranz-Marshall                 (3.2.6/1)
  β    = (2 + 0,6·Sc^⅓·Re^½)·D_v/d32                       idem stofoverdracht           (3.2.7/1)
  ρ_v,a = p_w(x)/(R_v·T),  ρ_v,s = p_ws,water(t_w)/(R_v·T_w)   (boven vloeibaar water, ook < 0 °C)
  ṁ_ev = β·A·(ρ_v,s − ρ_v,a)                               + verdamping / − condensatie  (3.2.2/3)
  Q_s  = h_c·A·(t_w − t)                                   voelbaar naar de lucht        (3.2.2/2)
  t   += (Q_s + ṁ_ev·c_p,v·(t_w − t)) / (ṁ_da·(c_p,da + c_p,v·x))
  x   += ṁ_ev/ṁ_da
  t_w −= (Q_s + ṁ_ev·r(t_w)) / (ṁ_w·c_w),   r(t) = 2 501 000 − 2 369·t  [J/kg]
  ṁ_w −= ṁ_ev;   w_d = w_d'
  als x > x_s(t): isenthalpisch naar verzadiging (mist), het overschot gaat naar ṁ_w
  bewaar profielpunt {z, t, x, rh, t_w, w_d, ρ}
na de laatste cel:
  Q = ṁ_da·(h_uit − h_in)                                  [W], + = lucht verwarmd
  balanceErr = (Q + ṁ_w,uit·c_w·t_w,uit − ṁ_w,in·c_w·t_w,in) / |Q|      moet < 1e-3 zijn
```
Constanten: g = 9,81; ρ_w = 999; c_w = 4186; c_p,da = 1006; c_p,v = 1860; R_da = 287,042; R_v = 461,5 (SI).
Wandwarmteoverdracht wordt verwaarloosd (aandeel 3–5 %, §3.5.2.3; geïsoleerde schacht = adiabaat, §3.2.10).

**Regeling en seizoensbedrijf** (§3.5.3, §3.5.6, variant A):

| Situatie | Water | RW/L | Na de cascade |
|---|---|---|---|
| **Koelen**: θ_e > t_toe,koel (17 °C) | t_w,koel = 13 °C (koude bron 12 °C + 1 K, §3.1.7.4) | **automatisch** in [0,3; 1,2] zodat t_uit = 17 °C (bisectie, N = 200 tijdens het zoeken, daarna N = 400) | Ligt t_uit bij RW/L = 0,3 al onder 17 °C → naverwarmen tot 17 °C. Haalt RW/L = 1,2 geen 17 °C → waarschuwing “setpoint niet haalbaar”. |
| **Verwarmen/bevochtigen**: θ_e ≤ 17 °C | 13 °C bij θ_e ≥ 0 °C, **15 °C** bij θ_e < 0 °C (case D4) | **0,9** vast (vorstbeveiliging, §3.4.8, §3.5.5.7) | Naverwarming buiten de cascade tot t_toe,verw = 18 °C (§3.5.6.6). |
| **Variant A1** (optie, tussenseizoen) | cascade uit (droge schacht) | 0 | Geen behandeling, **geen hydraulische trek** → hulpventilator (§3.5.6.4/8). |

Alle drempels en temperaturen zijn invoer (paneel “Klimaatcascade”). Handmatige RW/L is ook mogelijk.

**Waarschuwingen cascade:** θ_e < 0 °C en RW/L < 0,5 → “ijsvorming waarschijnlijk” (§3.4.8); laagste waterdruppeltemperatuur < 0,5 °C → “bevriezingsrisico bovenin”; t_w,in > 20 °C → “legionella-risico; de cascade is alleen intrinsiek veilig bij lage watertemperatuur” (§3.6.3); d32 < 0,5 mm → “risico op meevoeren van aerosolen” (§3.2.14); RV uit < 90 % → ter info (zeldzaam).

### 5.4 Toevoerzijde: drukbalans per verdieping (§3.5.5)

Thermische trek **altijd door integratie over het berekende profiel**, nooit met het rekenkundig gemiddelde (§3.3.10):
```
Δp_th,kc = Σ_cellen g·Δz·(ρ_profiel − ρ_e)                              (generalisatie van 3.5.5/1–6)
P_voet   = p_over + Δp_hydr + Δp_th,kc                                   druk aan de voet van de cascade
P_k      = P_voet − g·z_k·(ρ_toe − ρ_e) − Δp_toe,ontwerp                 verdieping k, z_k = (k − ½)·h_verd
```
- `ρ_toe`: dichtheid van de toevoerlucht in de schacht (na eventuele naverwarming).
- `Δp_toe,ontwerp`: drukverlies van het lagedruk-verdeelsysteem inclusief roosters, standaard **25 Pa** (proefschrift: 20–30 Pa, §3.5.5.7).
- `P_k > 0` → **smoren** met kleppen (toon Pa per verdieping); `P_k < 0` → **tekort**; de hulpventilator in de cascade wordt gedimensioneerd op de slechtste verdieping: `Δp_vent,toe = max(0, −min_k P_k)`.

Controle met de vereenvoudigde formule van het proefschrift (3.5.5/5–6, ρ0 = 1,293, T0 = 273 K, 10 verdiepingen à 3,5 m): zomer 28 → 17 °C met gemiddeld 22,5 °C in de cascade → +7,5 Pa aan de voet, −0,3 Pa bovenin; winter −10 → +6,5 °C (gemiddeld −1,75 °C) → −14,0 Pa aan de voet, met toevoerschacht op 18 °C +16,3 Pa bovenin (§3.5.5.4/5). Je generieke functie moet deze getallen reproduceren als je dezelfde aannames invoert (test §12).

### 5.5 Ruimte

```
t_ruimte   = t_ruimte,zomer (25 °C, type BETA, §3.1.5, §3.5.1.2) bij koelen; t_ruimte,winter (21 °C, tab. 7.4.4) bij verwarmen
G_vocht    = n_pers · aanwezigheid · 65 g/h                                  (§3.1.7.2)
x_ruimte   = x_toe + G_vocht/ṁ_da
Q_vent     = ṁ_da·(c_p,da + c_p,v·x_toe)·(t_ruimte − t_toe)                  basiskoeling (+) of -verwarming (−) door de ventilatielucht
Q_int      = q_int · AVO · aanwezigheid                                     q_int = 35 W/m² AVO (tab. 7.4.4)
Q_rest     = Q_int − Q_vent                                                 restlast voor klimaatplafonds (+ koelen)
```
Comfortcontrole: **RV_ruimte ≤ 60 %** en **x_ruimte ≤ 12 g/kg** (§3.1.5.5, ASHRAE 55, NEN-EN 15251) — anders oranje waarschuwing. *Verwacht gedrag*: bij de ontwerp-zomerconditie komt RV_ruimte rond 65 % uit; de cascade met 13 °C water droogt minder dan het conceptontwerp in tabel 3.1.7/3 aanneemt (de metingen B1 bevestigen dit, §3.4.10.4). Toon dat eerlijk. In winterbedrijf: waarschuw bij RV_ruimte > 45 % bij θ_e < 0 °C (condensrisico, §3.5.6.3).

### 5.6 Afvoerzijde: shunt, zonneschoorsteen, FiWiHEx (hoofdstuk 4)

**Instroom** zonneschoorsteen: `t_in = t_ruimte + ΔT_strat` (ΔT_strat standaard 0 K, invoerbaar). Luchtsnelheid `w_zs = q_v/(B·D)`.

**Straling op het glas.** Splits in direct (beam) en diffuus+grond, met invalshoek θ op het glasvlak (§6.4).
```
S = R · g · (Φ_beam · k(θ) + Φ_diff · 0,874)           doorgelaten straling per m² bruto glas [W/m²]
k(θ) = g(θ)/g(0),  g(θ) = −2,173e−6·θ³ + 1,387e−4·θ² − 2,415e−3·θ + 0,6747  (θ in graden; fig. 4.2.2, WIS, HR++)
0,874 = hemisferisch gemiddelde van k(θ) (isotrope diffuse straling)
```
Bij vaste gevelstraling uit het proefschrift (referentie 400 W/m², testdag 730 W/m²) geldt de conventie van het proefschrift: **geen** invalshoekcorrectie (`angleCorr = false`, S = R·g·Φ).

**Driekennodenmodel per segment** (4.2.5/13–15, gemarcheerd van voet naar top, 4 segmenten per verdieping). Onbekenden per segment: glastemperatuur θ_gl, absorbertemperatuur θ_w, uittredende luchttemperatuur θ_uit; θ_m = ½(θ_in,seg + θ_uit). Iteratief oplossen (Gauss-Seidel met demping ½, tot 1e−7 K):
```
U*      = 1/(1/U_glas − 0,13)                                   glasbinnenoppervlak → buitenlucht (R_si = 0,13)
B_str   = 0,872·B + 1,6·D,   B_conv = B + 2·D                   schijnbare breedtes zijwanden (4.2.5.3)
ε_res   = 1/(1/ε_w + 1/ε_gl − 1),  h_str = 4·ε_res·σ·T_gem³      (4.2.5/4–7), ε_gl = 0,87
h_c     = [ (1,5·|Δθ|^⅓)³ + (7,65·w)³ ]^⅓                       Churchill-Usagi menging van vrije (4.2.4/4) en
                                                                gedwongen convectie (4.2.4/9); apart voor glas en wand
knoop 1 (glas):    B·U*·(θ_gl − θ_e) + B·h_c,gl·(θ_gl − θ_m) = f1·S·B + B_str·h_str·(θ_w − θ_gl)
knoop 3 (wand):    f2·S·B = B_conv·h_c,w·(θ_w − θ_m) + B_str·h_str·(θ_w − θ_gl) + B·U_wand·(θ_w − θ_achter)
knoop 2 (lucht):   ṁ·c_p·(θ_uit − θ_in,seg) = Δz·[B·h_c,gl·(θ_gl − θ_m) + B_conv·h_c,w·(θ_w − θ_m)]
```
f1 = 0,25 (geabsorbeerd in binnenruit), f2 = 0,75 (absorber), gemeten in de testopstelling (§4.2.2). θ_achter = t_ruimte.
Uitvoer: θ-profielen, `Q_zs = Σ ṁ·c_p·Δθ`, rendement `η = Q_zs/(R·B·H·Φ_totaal)` (4.5.6/1), `t_glas,max`, `t_wand,max`, thermische trek `Δp_th,zs = Σ g·Δz·(ρ_e − ρ_zs)` (4.2.6/1, geïntegreerd).
Waarschuwing `t_glas,max > 80 °C` → “gehard glas nodig of bypass-beveiliging” (§4.1.4, §4.5.11.6).

**Kantelpunt** (§4.5.6.8): is `Q_zs ≤ 0` (verlies groter dan opbrengst), dan is de **zonneschoorsteen dicht** en wordt via het shuntkanaal direct naar het dak afgezogen; de thermische trek is dan die van een kolom op ruimtetemperatuur (§5.7). Toon status “schoorsteen dicht (kantelpunt)”.

**Zonnefaçade** (optie): zelfde model met andere standaardwaarden (lage w, bijv. 0,2–0,5 m/s, B = gevelbreedte, D = 0,65 m). Bij lage w domineert de vrije convectie vanzelf in de mengformule.

**FiWiHEx** (§4.5.8.2) — eenvoudig model, **aannames** gemarkeerd: `Q_hr = ε·ṁ_da·c_p·max(0, t_top − t_w,in)`, ε = 0,7, t_w,in = 20 °C (KT-buffer/WKO), drukverlies 10 Pa. `t_top = t_zs,uit` (open) of `t_ruimte` (dicht). Toon: geoogste zonnewarmte (Q_zs) en FiWiHEx-opbrengst (incl. ruimtewarmte) apart. Zomer: warmte → warme bron; winter: direct bruikbaar.

**Drukverliezen afvoer** (§4.2.7):
```
Δp_ext      = 5 Pa  (roosters/overstroom/atrium, §4.2.7.7)
Δp_shunt(z) = frictionDp(z, Dh_sh, w_sh, ρ)  met w_sh = 1,0 m/s, vierkante doorsnede q_v/w_sh (aanname vorm)
Δp_U        = ζ_U·½ρ·w_sh²,  ζ_U = 0,5  (U-bocht met leidschoepen, §4.2.7.8)
Δp_zs       = frictionDp(H, Dh_zs, w_zs, ρ),  Dh = 2BD/(B+D) (4.2.4/2), wandruwheid 10 mm (fig. 4.2.7/1)
Δp_dyn      = ½ρ·w_zs²  (uitstroomverlies, §4.2.7.3)
λ expliciet volgens 4.2.7/3 (Swamee-Jain-vorm van Colebrook-White): λ = 0,25/[log10(ε/(3,72·D_h) + 5,74/Re^0,901)]²,  ν = 1,6e−5 m²/s
```

### 5.7 Afvoerzijde: drukbalans per verdieping

Hydrostatica langs de luchtweg (van rooster op hoogte z_k, omlaag door de shunt, omhoog door de schoorsteen, naar de ejector):
```
schoorsteen open:  A_k = Δp_th,zs + g·z_k·(ρ_ruimte − ρ_e) − p_ej − (Δp_ext + Δp_shunt(z_k) + Δp_U + Δp_zs + Δp_FiWiHEx + Δp_dyn)
schoorsteen dicht: A_k = g·(H − z_k)·(ρ_e − ρ_ruimte) − p_ej − (dezelfde verliesposten als hierboven)
```
(Vereenvoudiging bij “dicht”: de verliesposten blijven gelijk; zo doet het prototype het ook.)
- De term `g·z_k·(ρ_ruimte − ρ_e)` is de shuntkolom: in de winter (ruimte warmer dan buiten) kost het omlaag voeren trek, in de zomer levert het iets op. Gevolg: in de winter hebben de **bovenste** verdiepingen het minste trek — fysisch correct; laat het zien.
- `A_k > 0` → smoren (klep aan voet/top, §4.5.5); `A_k < 0` → hulpventilator bij de FiWiHEx, gedimensioneerd op `max(0, −min_k A_k)`.

### 5.8 Hulpventilatoren, pompen, energie

```
P_vent    = q_v·(Δp_vent,toe + Δp_vent,af) / (η_v·η_m),  η_v·η_m = 0,85·0,90           (4.5.11/1, 3.5.5/7)
q_w       = RW/L·ṁ_da/ρ_w
h_pomp    = H_c + p_sproeier/(ρ_w·g) + R_leiding·(H_c + 10 m)/(ρ_w·g) + Δp_lokaal/(ρ_w·g)
            p_sproeier = 50 kPa, R_leiding = 100 Pa/m, Δp_lokaal = 1 kPa, (H_c + 10 m) leidinglengte = aanname
P_sproei  = ρ_w·g·h_pomp·q_w / η_p,   η_p = 0,75                                        (3.5.4/1–3, §3.5.4.2)
P_bron    = |Q_cascade|/(c_w·ΔT_bron)/ρ_w · 15 kPa / 0,75,  ΔT_bron = max(1 K, |t_w,uit − t_w,in|)   (§3.5.4.3)
COP       = |Q_koel| / (P_sproei + P_bron)       alleen in koelbedrijf                   (3.5.4/4)
```
Referentievergelijking (optioneel tonen, “conventionele LBK volgens case study”): ventilatorvermogen `q_v · 2,64 kW/(m³/s)` (SFP bij 900 + 600 Pa, §7.5.2.2) en koelvermogen elektrisch `|Q_koel|/3,0` (luchtgekoelde koelmachine, §7.5.2.3).

### 5.9 Controles en waarschuwingen

- Energiebalans cascade (lucht + water) `|balanceErr| < 0,1 %` — toon in “Methode” als groen vinkje met de waarde.
- Massabalans water: `ṁ_w,uit = ṁ_w,in − ṁ_ev,netto` (exact).
- Alle waarschuwingen als `{ code, level: 'info'|'warn'|'error', vars }` → vertaald via i18n. Lijst minimaal: setpoint niet haalbaar · ijsvorming · bevriezing bovenin · legionella · aerosolen · RV ruimte te hoog · condensrisico winter · glastemperatuur > 80 °C · schoorsteen dicht (info) · ejector buiten geldigheid · windprofiel onbetrouwbaar · Bbl-debiet niet gehaald · invoer buiten zinvol bereik (§7).

### 5.10 Afwijkingen van en inconsistenties in het proefschrift (bewuste keuzes)

| # | Proefschrift | Probleem | Keuze in deze tool |
|---|---|---|---|
| 1 | Druppeloppervlak 3.2.5/7: `A ∝ q·t·d32²/d30³` | Correct is `n·π·d20²` = `6V/d32`. Met d32 i.p.v. d20 is het oppervlak (d32/d20)² ≈ 2× te groot. | `A = 6V/d32` (Sauter). Gevalideerd tegen de metingen (§12). Gevolg: voor grove spectra (s1–s7) voorspelt de tool een hogere uittredetemperatuur dan tabel 3.5.2/1. Vermeld dit in “Methode”. |
| 2 | Eindsnelheid 3.2.4/6: `w = 1,7411·d10 + 0,1623` | Tegenstrijdig met fig. 3.2.4/2 en met Gunn & Kinzer (1949): 1 mm → ±4 m/s, niet 1,9. | Krachtenevenwicht met C_d(Re) (3.2.4/4) en een impulsvergelijking vanaf w0. |
| 3 | CWC zonneschoorsteen: 7,65·w (4.2.4/9) én 6,5·w (§4.5.11.2) | Twee waarden onder hetzelfde nummer. | 7,65·w, gemengd met vrije convectie (Churchill-Usagi); parameter instelbaar. |
| 4 | Knoopvergelijkingen 4.2.5/13–15 | Drukfouten in termen/tekens; verlies binnenwand ontbreekt in knoop 3 maar staat wel in 4.5.6/2. | Correcte energiebalansen zoals in §5.6. |
| 5 | Aerodynamische trek 3.2.15/2 | In de metingen niet aantoonbaar (§3.2.15.2); de gemeten drukopbouw is hydraulisch + thermisch (§12: < 1,5 Pa verschil). | Niet in de drukbalans; wel als informatieve waarde (“theoretisch maximum”). |
| 6 | Thermische trek met gemiddelde temperatuur (3.5.5/x) | Profiel is sterk niet-lineair (§3.3.10). | Integratie over het profiel. |
| 7 | Tabel 3.3.9/2 | Watervolumestroom 2,42 m³/h vs massastroom 15,2 kg/s. | Rekenen met RW/L × ṁ_da. |
| 8 | Case study §7.5.3: “koelcapaciteit 200 kW” bij 12 400 m³/h | Past niet bij Δh ≈ 15 kJ/kg (≈ 60 kW). | Niet gebruiken als validatie. |
| 9 | 3.5.5/3: constante 12 120 | Gaat uit van 3,5 m verdiepingshoogte en ρ0·T0. | Generieke hydrostatica; 12 120 alleen in de test. |
| 10 | Tabel 3.1.7/3: x = 13,3 g/kg bij 28 °C/55 % (tekst: 13,1) | Afronding. | Altijd `psychro.js` (ASHRAE). |

### 5.11 Resultaatobject van `simulate()`

```js
{
  inputs: { building, weather },                         // genormaliseerd, SI
  derived: { H, AVO, BVO, nPers, qV, mDa, Ac, sideC, zRoof, aEj },
  mode: 'cool' | 'heat' | 'off',                         // 'off' = variant A1
  outdoor: state,                                        // psychro.state()
  ventec: { Uref, qDyn, pOver, pEj, cpEj, Uej },
  cascade: { rwl, mW, tWIn, tWOut, out: state, Q, dpHydr, dpAero, dpTh, profile[], balanceErr, mEvap },
  reheat: { Q, out: state },                             // Q = 0 als niet nodig
  supply: state, room: state,
  loads: { Qvent, Qint, Qrest, Gmoist },
  chimney: { open, tIn, tOut, Q, eta, dpTh, w, tGlassMax, tWallMax, profile[], S },
  fiwihex: { Q, tAfter },
  pressure: {
    supply: [{ floor, z, available, throttle, deficit, parts:{ pOver, dpHydr, dpThCascade, dpShaft, loss } }],
    exhaust:[{ floor, z, available, throttle, deficit, parts:{ dpThChimney, dpShunt, pEj, losses } }],
    fanSupplyPa, fanExhaustPa
  },
  power: { Pfan, Pspray, Psource, COP, ref: { PfanConv, PcoolConv } },
  mollier: { states:[…], steps:[…] },                    // §9
  warnings: [{ code, level, vars }]
}
```

---

## 6. Weer

### 6.1 Invoervelden (paneel “Weer”)

Bron (segmentknop): **Weersituatie** (preset) · **Nu in De Bilt** · **Handmatig**. Velden (alle bewerkbaar; bij bewerken springt de bron naar “Handmatig”):

| Veld | Eenheid | Opmerking |
|---|---|---|
| Buitentemperatuur θ_e | °C | |
| Relatieve vochtigheid | % | Toon x, dauwpunt en h als afgeleide (via `psychro.js`). |
| Luchtdruk | hPa | Standaard 1013,25. |
| Windsnelheid U10 | m/s | Potentiële wind op 10 m (KNMI-definitie). Toon ook Beaufort (tabel 2.1.2). |
| Windrichting | ° | Informatief (Ventecdak richtingonafhankelijk). |
| Globale straling (horizontaal) GHI | W/m² | |
| Datum + tijd | lokale tijd | Voor de zonnestand. |
| Straling op zonneschoorsteen | W/m² | **Berekend** (standaard) of **handmatig** (vinkje; dan zonder invalshoekcorrectie, conventie proefschrift). |
| Bron en tijdstempel | — | Bijv. “KNMI HARMONIE-AROME via Open-Meteo · 12:00 (15-min gemiddelde)”. |

### 6.2 Knop “Weer van nu in De Bilt”

**Bron:** Open-Meteo Forecast API met het **KNMI-model** (`models=knmi_seamless`: HARMONIE-AROME Nederland 2 km, aangevuld met Europa 5,5 km en ECMWF). Geen API-sleutel, CORS `Access-Control-Allow-Origin: *` (getest 6-10-2026), data CC BY 4.0. “Current” = 15-minutenwaarde van het model; straling = gemiddelde over de voorafgaande 15 minuten.

```
https://api.open-meteo.com/v1/forecast
  ?latitude=52.10&longitude=5.18                          (KNMI-station 260 De Bilt)
  &current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,
           wind_direction_10m,wind_gusts_10m,cloud_cover,shortwave_radiation,direct_radiation,
           diffuse_radiation,direct_normal_irradiance,global_tilted_irradiance,is_day
  &tilt=90&azimuth={gevelazimut zonneschoorsteen, 0 = zuid}
  &models=knmi_seamless&wind_speed_unit=ms&timezone=Europe%2FAmsterdam
```
Voorbeeldrespons: `test/fixtures/openmeteo-current-debilt.json`.

**Mapping** (`EwfWeather.mapOpenMeteo`): `t = temperature_2m`, `rh = relative_humidity_2m`, `p = surface_pressure·100`, `U10 = wind_speed_10m`, `dir = wind_direction_10m`, `ghi = shortwave_radiation`, `dni = direct_normal_irradiance`, `dhi = diffuse_radiation`, `gti = global_tilted_irradiance`. Straling op de schoorsteen: `beam = dni·cos θ` (θ uit eigen zonnestand op het tijdstip `current.time`), `diffuse = max(0, gti − beam)`. Ontbreekt `gti` of `dni`: bereken met §6.4.

**Gedrag:** knop met laadstatus; time-out 8 s (`AbortController`); cache 10 min (sessie); fout → toast “Weer ophalen mislukt — vorige waarden behouden” en geen crash; offline-detectie. Een optie “Locatie” (lat/lon of keuzelijst van een paar KNMI-stations) mag, De Bilt is standaard. Toon verplicht de bronvermelding *“Weergegevens: Open-Meteo.com (CC BY 4.0), model KNMI HARMONIE-AROME — modelwaarde, geen meting”*.

**Waarom niet de KNMI Data Platform API (EDR, 10-minutenwaarnemingen)?** Die vereist een persoonlijke API-sleutel (die zou openbaar in de pagina staan) en geeft geen CORS-header (preflight 204 zonder `Access-Control-Allow-Origin`, getest 6-10-2026). Niet implementeren zonder eigen proxy.

### 6.3 Weersituaties (presets)

Locatie De Bilt (52,10° N, 5,18° O). Echte uren komen uit **KNMI uurgegevens station 260** (uurvak HH = (HH−1)…HH UT; straling Q [J/cm²] / 0,36 = W/m²); tijd = midden van het uurvak. Waarden met * zijn aannames.

| id | Naam (NL) | θ_e °C | RV % | U10 m/s | Straling | Tijd (UTC) | Bron / toelichting |
|---|---|---|---|---|---|---|---|
| `ontwerp_zomer` | Ontwerp zomer | 28,0 | 55 | 3,5 | **gevel 400 W/m²** (vast) | — | Ontwerpconditie cascade §3.1.7.2, case D1; Ventecdak-ontwerpwind §2.5.4; referentiestraling §4.2.3 |
| `gem_zomer` | Gemiddelde zomerdag | 20,0 | 80 | 3,5 | gevel 400 (vast) | — | Case D2/B2, §3.5.3; referentieconditie zonneschoorsteen §4.2.3 |
| `hitte_2019` | Hittegolf 25-07-2019 (De Bilt 37,5 °C max) | 37,1 | 29 | 3,0 | GHI 728 | 2019-07-25 13:30 | KNMI uur 14 |
| `benauwd_2020` | Benauwde zomerdag 12-08-2020 | 31,3 | 44 | 3,0 | GHI 706 | 2020-08-12 12:30 | KNMI uur 13 (x ≈ 12,6 g/kg: hoge latente last) |
| `voorjaar_2023` | Zonnige voorjaarsdag 15-03-2023 | 8,1 | 51 | 3,0 | GHI 617 | 2023-03-15 11:30 | KNMI uur 12 |
| `tussen` | Tussenseizoen | 10,1 | 99 | 3,5 | gevel 150* (vast) | — | Meting B4 §3.4.5 |
| `gem_winter` | Gemiddelde winterdag | 5,0 | 90 | 4,0* | gevel 80* (vast) | — | Case D3 |
| `zon_winter` | Zonnige winterdag | 0,55 | 80* | 3,0* | **gevel 730 W/m²** (vast) | — | Testdag 15-12-2009, §4.4.5.2 |
| `koude_2021` | Koude-inval 13-02-2021 | −7,0 | 75 | 3,0 | GHI 217 | 2021-02-13 08:30 | KNMI uur 9 |
| `ontwerp_winter` | Ontwerp winter | −10,0 | 90 | 5,0* | gevel 0 (vast) | — | Case D4; ISSO 51/53/57: basis-ontwerpbuitentemperatuur −10 °C |
| `storm_2022` | Storm Eunice 18-02-2022 | 11,0 | 56 | 13,0 | GHI 175 | 2022-02-18 14:30 | KNMI uur 15 (windstoten 27 m/s) |
| `windstil` | Windstil, bewolkt | 20,0 | 80 | 0,8* | gevel 120* (vast) | — | Toont werking hulpventilatoren |

Luchtdruk presets 1013,25 hPa. Elke preset heeft in de UI een korte uitleg (tooltip) met de bron. Presets zonder tijdstip gebruiken de vaste gevelstraling uit de tabel; alleen voor de zonnestand in het schema geldt dan 12:00 zonnetijd op een representatieve datum (zomer 21-07, tussenseizoen 21-03, winter 21-12).

### 6.4 Zonnestraling op de gevel (presets met GHI, handmatige invoer)

1. **Zonnestand**: NOAA “General Solar Position Calculations” (Spencer-reeks voor declinatie en tijdsvereffening). Uitvoer hoogte α en azimut (0 = zuid, + = west).
2. **Splitsing** GHI → DNI/DHI met **Erbs, Klein & Duffie (1982)**; k_t = GHI/(G_0·sin α), G_0 = 1367·(1 + 0,033·cos(2π·doy/365)), k_t ≤ 0,8. Onder α < 5° alles diffuus (splitsing onbetrouwbaar).
3. **Transpositie** naar het verticale vlak met **Hay & Davies (1980)** (Duffie & Beckman §2.16): beam `DNI·cos θ`, circumsolair `DHI·A_i·cos θ/sin α`, isotroop `DHI·(1 − A_i)·(1 + cos β)/2`, grond `GHI·ρ_g·(1 − cos β)/2`, A_i = DNI/G_0, β = 90°, ρ_g = 0,2.
4. Invalshoekcorrectie van de g-waarde zoals §5.6.

---

## 7. Standaardgebouw en invoervelden

Het standaardgebouw is het **8-laags model uit het proefschrift** (CFD ware grootte, tabel 3.3.9/1–2; 1000 m² AVO per laag; 5 m³/(m²·h)). Zo zijn de cases D1–D4 direct vergelijkbaar. Bereik = zinvol bereik; daarbuiten oranje waarschuwing, geen blokkade.

| Groep | Veld | Standaard | Bereik | Bron |
|---|---|---|---|---|
| Gebouw | Aantal verdiepingen | **8** | 4–20 | ≥ 4 lagen à 3,5 m nodig (§1.3.6); 4–20 in tabellen h3 |
| | Verdiepingshoogte | 3,5 m | 3,0–4,5 | §1.3.6 |
| | AVO per verdieping | 1000 m² | 100–5000 | §3.5.2.1 |
| | BVO/AVO | 1,5 | 1,2–2,0 | case study §7.2.2 |
| | Bezettingsdichtheid | 0,10 p/m² AVO | 0,03–0,25 | §3.1.7.2 |
| | Aanwezigheid | 90 % | 50–100 | tab. 7.4.4 (10 % afwezig) |
| | Interne warmtelast | 35 W/m² AVO | 10–80 | tab. 7.4.4 |
| | Vochtproductie | 65 g/(h·p) | 40–100 | §3.1.7.2 |
| | Ruimtetemperatuur zomer / winter | 25 / 21 °C | 20–28 / 18–23 | §3.5.1.2, tab. 7.4.4 |
| | Max. RV ruimte / max. x | 60 % / 12 g/kg | — | §3.1.5.5 |
| Ventilatie | Methode | NEN-EN 16798-1 cat. II, laag-emitterend | — | §3.5.1.1 |
| | Toevoertemperatuur koelen / verwarmen | 17 / 18 °C | 14–20 | §3.1.7, §3.5.6.6 |
| Klimaatcascade | Luchtsnelheid | 2,0 m/s | 1,0–2,5 | §3.5.2.2 |
| | Sproeispectrum | Fulljet 3/4GG-3050 (d30 1,048, d32 1,317 mm) | — | §3.4.10.1 |
| | Beginsnelheid druppels | 10 m/s | 4–15 | §3.2.4 |
| | RW/L regeling | automatisch, 0,3–1,2; winter 0,9 | 0,2–1,6 | §3.5.3, §3.4.8 |
| | Watertemperatuur koelen / verwarmen / vorst | 13 / 13 / 15 °C | 8–20 | §3.1.7.4, case D4 |
| | Variant A1 (uit in tussenseizoen) | uit | — | §3.5.6.4 |
| Ventecdak | Terreinklasse | 6 “zeer ruw” (z0 0,5 m, d 10 m) | 4–8 | §2.5.2, §2.5.7 |
| | Δz dak boven bovenste vloer | 4 m* | 2–8 | fig. 2.2.2 (aanname) |
| | Cp inlaat | 0,8 | 0,5–0,9 | §2.4.3 |
| | Hoogte bovenkanaal c | 2 m (formule 2.3.2) | 1 of 2 | §2.3.4 |
| | Ontwerpsnelheid ejector | 1,0 m/s | 0,5–2,5 | §2.5.3 |
| Zonneschoorsteen | Type | zonneschoorsteen (optie: zonnefaçade) | — | §4.1 |
| | Oriëntatie | zuid (0°) | −180…180 | §4.1.8 |
| | Breedte B / diepte D | 11,5 m / 0,65 m (→ w ≈ 1,5 m/s) | B 1–60, D 0,25–1,5 | §4.2.8.1 (D ≥ 0,65 voor reiniging), §4.5.4 |
| | Glas | Planitherm Total low-E: g 0,70, U 1,32 | presets + eigen | tab. 4.1.4, testopstelling |
| | Netto/bruto glas R | 0,95 | 0,8–1,0 | §4.2.8.1 |
| | Absorber ε_w | 0,05 (spectraal selectief, Mirotherm) | 0,05–0,95 | tab. 4.2.5 |
| | U binnenwand | 0,25 W/(m²·K) | 0,1–1,0 | testopstelling R = 4,25 (§4.4.1.2) |
| | f1 / f2 | 0,25 / 0,75 | — | §4.2.2 |
| Afvoer & drukverlies | Δp toevoersysteem (ontwerp) | 25 Pa | 5–80 | §3.5.5.7 |
| | Δp extern afzuig | 5 Pa | 1–30 | §4.2.7.7 |
| | Snelheid shunt / ζ U-bocht | 1,0 m/s / 0,5 | — | §4.2.7.8 |
| | Wandruwheid schachten | 10 mm | 1–20 | fig. 4.2.7/1 |
| | FiWiHEx: Δp / ε / t_water | 10 Pa* / 0,7* / 20 °C* | — | aanname |
| Geavanceerd | Cellen cascade | 400 | 100–2000 | — |
| | Pompaannames | 50 kPa · 100 Pa/m · 1 kPa · η 0,75 · bron 15 kPa | — | §3.5.4.2–3 |
| | Ventilatorrendement | 0,85 × 0,90 | — | §4.5.11.8 |
| | ΔT stratificatie afzuig | 0 K | 0–4 | — |

Glaspresets (tab. 4.1.4, §4.5.6.4): Planitherm Solar 4/15/4 argon (g 0,75, U 1,10) · **Planitherm Total low-E (0,70; 1,32)** · blank dubbel glas (0,70; 3,00).

Knop **“Standaard herstellen”** per paneel en voor alles.

---

## 8. Gebruikersinterface

### 8.1 Navigatie
- Segmentknop in de topbalk: **Mollier-diagram | Earth, Wind & Fire** (stijl als de bestaande `#chart-type`-knop). Sneltoets `E` schakelt (nog niet in gebruik). De bestaande diagram-sneltoetsen (`M`, `F`, `+`, `-`, `0`, `Delete`) werken alleen in de Mollier-weergave; Ctrl+Z/Y en `?` in beide.
- Weergave in `prefs.view` (localStorage) én in de URL als query `?view=ewf` (pushState). **Raak het hash-formaat `#p=…` van deellinks niet aan.**
- De bestaande topbalk (projectnaam, ongedaan maken, bestand, delen, taal, thema, help) blijft voor beide weergaven werken.

### 8.2 Layout (hergebruik `.layout`, `.sidebar`, `.panel`, `.card`)
- **Zijbalk** (inklapbare panelen): Weer · Gebouw · Ventilatie · Klimaatcascade · Ventecdak · Zonneschoorsteen · Afvoer & drukverlies · Geavanceerd.
- **Inhoud**: KPI-rij → kaart met de **schematische doorsnede** (groot) → kaart met tabbladen: *Cascadeprofiel · Drukbalans · Zonneschoorsteen · Mollier · Energie · Per verdieping · Alle weersituaties · Methode & bronnen*.
- Mobiel (< 900 px): zijbalk boven, schema schaalt (viewBox), tabellen horizontaal scrollbaar binnen hun kaart; geen horizontale paginascroll.

### 8.3 Invoerpanelen
- Elk veld: label, eenheid, standaardwaarde, bereik, tooltip met de bron (paragraaf in het proefschrift of norm). Aannames krijgen een kleine badge “aanname”.
- Afgeleide waarden direct onder het veld in de stijl van `.hint` (bijv. “q_v = 40 320 m³/h · ṁ = 13,27 kg/s · doorsnede cascade 2,37 × 2,37 m”).
- Getalnotatie via `fmt`/`parseNum` (NL: decimale komma).

### 8.4 KPI-kaarten (rij boven het schema)
1. **Toevoer**: t en RV uit de cascade, toevoertemperatuur na naverwarming.
2. **Cascade**: koel-/verwarmvermogen (kW), RW/L en waterdebiet (m³/h), drukopbouw (hydraulisch + thermisch, Pa).
3. **Drukbalans toevoer**: kleinste marge (Pa) → groen “smoren x Pa” of rood “hulpventilator x Pa”.
4. **Drukbalans afvoer**: idem.
5. **Zonneschoorsteen**: t_uit, Q_zs (kW), η, trek (Pa), status open/dicht.
6. **Elektrisch**: pompen + ventilatoren (kW), COP cascade.
7. **Ruimte**: RV en x, met comfortstatus.

### 8.5 Schematische doorsnede (de visualisatie)

Volg de **opbouw van de conceptschets fig. 1.3/1** (eigen tekening, eigen stijl, geen kopie):

```
            ☀ zon (hoogte/azimut, Φ op gevel)                         
 🎐 U10 →      ╭──────────────── Ventecdak (bovendak, afgeplatte ellips) ───────────────╮
 ─────→     ↗   keel: windpijlen ⟶   ▲ 6 venturi-ejector (afvoer omhoog in de keel)    ↘ ⟶
 ┌─overstek─┬──────────────────────────────┬──────────┬───────────────────┬─overstek─┐
 │          │ 1 overdrukruimte   (5)       │    7     │ (5)  4 FiWiHEx  ▓▓ │          │
 │          ├────┬────┬──────────────────────────────────────┬────┬───────┤          │
 │          │ KC │ TS │ verdieping n   → → → ·· ← ← ←         │ SH │  ZS ↑ │ ← zonnestralen
 │          │ ░↓ │ ↑→ │ verdieping …                          │ ↓  │  ▒ ↑  │
 │          │ ░↓ │ ↑→ │ verdieping 1   (2 verblijfsruimten)   │ ↓  │  ▒ ↑  │
 ═══════════╪════╧════╧══════════════════════════════════════╧════╧═══════╪══════════ maaiveld
            │ 9 technische ruimte: bassin ≋, sproeipomp ◎, wisselaar ⇄           │
            └──────────┬───────────────────────────────────┬─────────────────┘
                       8 WKO: koude bron (blauw)            warme bron (rood)
 KC = klimaatcascade · TS = toevoerschacht · SH = shuntkanaal · ZS = zonneschoorsteen/-façade
```

Eisen:
- **Schaal**: het werkelijke aantal verdiepingen (4–20) tekenen; boven 12 lagen de laaghoogte comprimeren. Schachtbreedtes proportioneel aan de berekende afmetingen (met een minimum voor leesbaarheid). Toon de cascade aan de gevel “ter wille van de duidelijkheid” (zoals het proefschrift, voetnoot 5) met een tekstje dat hij in werkelijkheid meestal inpandig zit.
- **Kleur = temperatuur**, één doorlopende divergerende schaal voor het hele schema (bijv. −10…50 °C, blauw–wit–rood, kleurenblind-veilig, met legenda): cascade als verticale gradiënt volgens het **berekende profiel**, zonneschoorsteen idem, toevoer-, ruimte-, afvoer- en buitenluchtvlakken in hun eigen temperatuur. Werkt in licht en donker thema.
- **Stroming**: pijlen langs de hele luchtweg; dikte ∝ debiet; geanimeerde streepjes waarvan de snelheid ∝ luchtsnelheid. In de cascade vallende druppels (cirkeltjes), snelheid ∝ berekende druppelsnelheid, aantal ∝ RW/L. Windpijlen links en in de keel van het Ventecdak, lengte ∝ U_ref. Zonnestralen naar de schoorsteen, dikte/helderheid ∝ Φ en hoek ≈ zonnehoogte. Ventilatoricoon (5) draait alleen als die hulpventilator nodig is; kleppen tonen standen (open/smoren).
- **Labels met live waarden** bij: buitenlucht (t, RV, U10), overdrukruimte (p_over), sproeiers (t_w,in, RW/L), voet cascade (t, RV, t_w,uit, Δp), elke verdieping (t_ruimte, RV; badges toevoer/afvoer-marge in Pa met kleurstatus), shunt, top schoorsteen (t, Q_zs), FiWiHEx (Q_hr), ejector (p_ej), WKO (koud/warm, kW).
- **Interactie**: hover/tap op een onderdeel → tooltip met de belangrijkste waarden + formulereferentie; klik → het bijbehorende invoerpaneel opent en scrolt in beeld. Toetsenbord-focusbaar.
- **Statusbadges** bovenin het schema: “Hulpventilator toevoer 120 W”, “Smoren afvoer 18 Pa”, “Schoorsteen dicht (kantelpunt)”, “Bevriezingsrisico”, “RV ruimte 65 %”.
- **Animatie**: knop pauze/afspelen; standaard uit bij `prefers-reduced-motion`. Gebruik `requestAnimationFrame` of CSS; geen herrendering van het hele SVG per frame.
- **Legenda** met de nummers 1–9 (zie §2), dezelfde nummers in het schema.
- Export: knop “Schema als SVG/PNG” (hergebruik de bestaande exportroutine indien mogelijk).

### 8.6 Grafieken (D3, stijl en kleuren afgestemd op `chart.js`)
1. **Cascadeprofiel** — verticale as hoogte (top boven); lijnen t_lucht en t_water (°C), op een tweede as x (g/kg) en RV (%). Markeer de sproeihoogte. Vergelijkbaar met fig. 3.5.2/1. Tooltip per hoogte.
2. **Drukbalans** — per verdieping horizontale balken: beschikbare toevoermarge en afvoermarge (Pa), nul-as in het midden, rood bij tekort. Onder de grafiek een **opbouwtabel** voor de geselecteerde verdieping (standaard bovenste en onderste): toevoer = p_over + Δp_hydr + Δp_th,kc − schachtkolom − verliezen; afvoer = Δp_th,zs + shuntkolom − p_ej − verliezen.
3. **Zonneschoorsteen** — verticale as hoogte; lijnen θ_glas, θ_lucht, θ_wand; stippellijn 80 °C (ongehard glas). Vergelijkbaar met fig. 4.5.11/1.
4. **Mollier** — mini-instantie van de bestaande grafiekklasse met de EWF-procesketen (§9.1), plus knop “Open in Mollier-diagram”.
5. **Energie** — kW-balken: cascade (koelen/verwarmen), naverwarming, zonnewarmte, FiWiHEx, pompen, ventilatoren; daarnaast de referentie “conventionele LBK” (§5.8).
6. **Per verdieping** — tabel: verdieping, z, t_toe, toevoermarge, smoren/tekort, afvoermarge, smoren/tekort. CSV-export via de bestaande CSV-functie (`;`, decimale komma in NL).

### 8.7 “Alle weersituaties”
Tabel met per preset één rij (draai `simulateAll`): modus, RW/L, t uit cascade, RV uit, Q_cascade, Q_naverwarming, RV ruimte, Φ gevel, t_zs, Q_zs, trek zs, p_over, p_ej, min. marge toevoer/afvoer, P_vent, P_pomp, COP, en een kolom met waarschuwingsiconen. Sorteerbaar; klik op een rij laadt die preset. CSV-export. Dit is voor adviseurs de snelste manier om het seizoensgedrag te zien — maak hem duidelijk.

### 8.8 Waarschuwingen
Compacte lijst onder de KPI’s (info/oranje/rood), vertaald, met een link “waarom?” naar de uitleg in “Methode & bronnen”.

### 8.9 Methode & bronnen (in de app)
Tabblad met: korte modelbeschrijving per onderdeel; de vergelijkingen met formulenummers; **alle aannames**; tabel 5.10 (afwijkingen); een **validatietabel die live wordt berekend** (B1–B5 tegen de metingen, D1/D3/D4 tegen CFD, Ventecdak-tabel 2.5.3) met groen/oranje status; de literatuurlijst (§11); disclaimer: *“Quasi-stationair ontwerpmodel ter verkenning; geen vervanging voor CFD, windtunnelonderzoek of dynamische gebouwsimulatie. Validatie op basis van schaalproeven (Bronsema 2013).”* Schrijf dezelfde inhoud uitgebreider in `docs/ewf/METHODE.md`.

### 8.10 Overig
- Volledig NL/EN (`ewf.*`-sleutels); geen hardgecodeerde teksten in JS.
- Licht/donker/huisstijl via tokens; contrast WCAG AA.
- Toegankelijkheid: labels gekoppeld aan inputs, `aria-live` voor de KPI-rij, SVG met `<title>`/`<desc>`, toetsenbordbediening.
- Printweergave (`@media print`): schema + KPI’s + tabel per verdieping op één A4-liggend.
- Help-dialoog uitbreiden met een sectie EWF.

---

## 9. Koppeling met het Mollier-diagram

### 9.1 Procesketen in `result.mollier`
Toestanden: **1 buitenlucht → 2 uit cascade → 3 toevoer (na naverwarming) → 4 ruimte/afzuig → 5 top zonneschoorsteen → 6 na FiWiHEx.** Stappen met pad:
- 1→2: het **berekende cascadeprofiel** als pad (gekromde lijn in het h,x-diagram — het proefschrift tekent dit “gemakshalve” recht, §3.1.7.6).
- 2→3: verwarmen bij constante x (alleen als Q_naverwarming > 0).
- 3→4: ruimtebelasting (Q_vent, G_vocht).
- 4→5: verwarmen bij constante x (zonneschoorsteen).
- 5→6: voelbaar koelen bij constante x (FiWiHEx).
Lever deze in de datastructuur die `chart.setData()` verwacht (kijk naar wat `computeScenario` teruggeeft) zodat de mini-Mollier direct werkt.

### 9.2 “Open in Mollier-diagram”
Maakt of werkt het scenario **“EWF – {naam weersituatie}”** bij in `project.scenarios`: beginpunt = buitenlucht (t, RV), debiet = q_v, stappen met bestaande procestypen (vrij punt / verwarmen naar t / ruimtebelasting / koelen) óf, na fase 5, het nieuwe type `cascade`. Daarna naar de Mollier-weergave schakelen. Via `change()` zodat ongedaan maken werkt.

### 9.3 Nieuw procestype `cascade` in `processes.js` (fase 5)
Categorie `cool` (of een nieuwe categorie `ewf` met eigen icoon). Parameters: hoogte H [m], luchtsnelheid [m/s], RW/L [–], watertemperatuur [°C], sproeispectrum, beginsnelheid. `apply()` roept `EwfPhysics.cascade` aan met ṁ uit het scenario en geeft `{ state, path: profiel, info: { tWOut, dpHydr, Q } }`. In Node: `require('./ewf/physics.js')` in de UMD-factory. Teksten in `i18n.js`. Test toevoegen.

---

## 10. Opslag, delen en ongedaan maken
- `project.ewf = { building: {…}, weather: { source: 'preset'|'live'|'manual', presetId, values: {…}, fetchedAt }, options: {…} }`. `normalize()` vult ontbrekende velden met `EwfModel.DEFAULTS`; oude projecten zonder `ewf` krijgen de standaard.
- EWF-wijzigingen lopen via het bestaande `change()`-mechanisme → ongedaan maken/opnieuw, automatisch opslaan, deellink en JSON-export nemen EWF mee.
- Weer-API-respons niet in het project zelf opslaan, alleen de gemapte waarden + tijdstempel.

---

## 11. Bronvermelding (in de app en in METHODE.md)

**Primair**
- Bronsema, B. (2013). *Earth, Wind & Fire – Natuurlijke Airconditioning*. Proefschrift TU Delft (promotie 7 juni 2013; promotoren P.G. Luscuere, A.P.J.M. Verheijen). Eburon, Delft. ISBN 978-90-5972-762-5. https://repository.tudelft.nl/islandora/object/uuid:d181a9f2-2123-4de1-8856-cd7da74e8268

**Gebruikte methoden en data**
- ASHRAE (2017). *Handbook – Fundamentals*, hoofdstuk 1 Psychrometrics (al gebruikt in `psychro.js`).
- Ranz, W.E. & Marshall, W.R. (1952). Evaporation from drops. *Chemical Engineering Progress* 48(3): 141–146; 48(4): 173–180.
- Schiller, L. & Naumann, A. (1933). Über die grundlegenden Berechnungen bei der Schwerkraftaufbereitung. *Z. VDI* 77: 318–320. (Weerstandswet; in het proefschrift als Wallis 1969.)
- Gunn, R. & Kinzer, G.D. (1949). The terminal velocity of fall for water droplets in stagnant air. *Journal of Meteorology* 6: 243–248. (Controle eindsnelheid.)
- Churchill, S.W. & Usagi, R. (1972). A general expression for the correlation of rates of transfer and other phenomena. *AIChE Journal* 18(6): 1121–1128.
- Colebrook, C.F. (1939). Turbulent flow in pipes… *J. Inst. Civil Engineers* 11: 133–156; Swamee, P.K. & Jain, A.K. (1976), *J. Hydraulics Div. ASCE* 102(5): 657–664.
- van Hooff, T., Blocken, B., Aanen, L. & Bronsema, B. (2011). A venturi-shaped roof for wind-induced natural ventilation of buildings: wind tunnel and CFD evaluation of different design configurations. *Building and Environment* 46(9): 1797–1807.
- Blocken, B., van Hooff, T., Aanen, L. & Bronsema, B. (2011). Computational analysis of the performance of a venturi-shaped roof for natural ventilation: venturi-effect versus wind-blocking effect. *Computers & Fluids* 48(1): 202–213.
- Wieringa, J. & Rijkoort, P.J. (1983). *Windklimaat van Nederland*. KNMI / Staatsuitgeverij. (Ruwheidsklassen Davenport, potentiële wind.)
- Erbs, D.G., Klein, S.A. & Duffie, J.A. (1982). Estimation of the diffuse radiation fraction for hourly, daily and monthly-average global radiation. *Solar Energy* 28(4): 293–302.
- Hay, J.E. & Davies, J.A. (1980). Calculation of the solar radiation incident on an inclined surface. *Proc. First Canadian Solar Radiation Data Workshop*, 59–72; Duffie, J.A. & Beckman, W.A. (2013). *Solar Engineering of Thermal Processes*, 4e druk, Wiley, §2.16.
- NOAA Global Monitoring Laboratory. *General Solar Position Calculations*. https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- NEN-EN 16798-1:2019 — Energieprestatie van gebouwen, ventilatie, binnenmilieu-parameters (ventilatiedebieten cat. I–III).
- Besluit bouwwerken leefomgeving (Bbl), art. 4.122 lid 2 — 6,5 dm³/s per persoon voor kantoorfunctie. https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/nieuwbouw/rijksregels/ventilatie/
- ISSO-publicaties 51/53/57 (2017) — basis-ontwerpbuitentemperatuur −10 °C.
- KNMI — uurgegevens station 260 De Bilt (presets). https://www.daggegevens.knmi.nl/klimatologie/uurgegevens
- KNMI (2024). *Vijf jaar na het nationale hitterecord van 40,7 ℃* — De Bilt 37,5 °C op 25-07-2019. https://www.knmi.nl/over-het-knmi/nieuws/vijf-jaar-na-het-nationale-hitterecord-van-40-7
- Open-Meteo.com — Forecast API, KNMI-modellen (HARMONIE-AROME), CC BY 4.0. https://open-meteo.com/en/docs/knmi-api

In de UI: een compacte bronregel onder elke grafiek (bijv. “Model: Bronsema 2013 §3.2; Ranz & Marshall 1952”) en de volledige lijst in “Methode & bronnen”. NEN 5060 (referentieklimaatjaren) wordt alleen genoemd: de data zijn auteursrechtelijk beschermd en worden niet meegeleverd.

---

## 12. Tests en validatie

Nieuwe testbestanden met `node:test` (zoals de bestaande). Laad de UMD-modules met `require`. Gebruik `test/fixtures/ewf-oracle.json` voor de regressiewaarden (gegenereerd met het prototype; bij twijfel opnieuw genereren met `python3 docs/ewf/ewf_prototype.py`, dat schrijft `ewf-oracle.json` in de werkmap).

### 12.1 Validatie tegen metingen en proefschrift (fysica)

| Test | Invoer | Verwacht | Tolerantie |
|---|---|---|---|
| Eindsnelheid druppels vs Gunn & Kinzer | d = 0,5 / 1 / 1,5 / 2 / 3 mm, 20 °C | 2,06 / 4,03 / 5,40 / 6,49 / 8,06 m/s | ± 10 % |
| **Cascade testopstelling** (tab. 3.4.7): H = 5,5 m, A = 1 m², d30 = 1,048 mm, d32 = 1,317 mm, w0 = 10 m/s, N = 400, p = 101 325 Pa; ṁ_da = V·ρ(t,x)/(1+x) | B1: 27,34 °C/51,88 %, 1789 m³/h, 0,673 kg/s, 12,85 °C | t_uit 16,85 °C · t_w,uit 15,11 · x 11,64 g/kg | t ± 1,5 K; t_w ± 0,5 K; x ± 1,0 g/kg |
| | B2: 20,00/77,73, 1832, 0,674, 13,03 | 15,21 · 14,37 · 10,87 | t ± 1,0 K; t_w ± 0,5; x ± 1,0 |
| | B4: 10,08/99,0, 1836, 0,670, 12,83 | 11,60 · 12,13 · 8,38 | idem |
| | B3: 5,32/95,27, 1836, 0,674, 13,10 | 9,54 · 11,00 · 7,15 | idem |
| | B5: −3,70/57,48, 1807, 0,674, 12,93 | 5,78 · 8,50 · 5,39 | idem |
| Drukopbouw testopstelling | Δp_hydr + Σg·Δz·(ρ_profiel − ρ(20 °C, 8 g/kg)) (meetreferentie = laboratoriumhal ≈ 20 °C) | 5,81 / 6,18 / 7,17 / 8,44 / 9,77 Pa | ± 1,5 Pa |
| Energiebalans cascade | alle cases | `|balanceErr|` | < 1e−3 |
| **Ware grootte vs CFD** (tab. 3.3.9/2): H = 28 m, 40 000 m³/h, w = 2 m/s, p = 100 kPa | D1: 28/55, water 13, RW/L 1,17 | 16,5 °C (CFD), RV ≈ 100 % | ± 2,0 K |
| | D3: 5/90, 13, 1,07 | 12,0 °C | ± 2,0 K |
| | D4: −10/90, 15, 1,00 | 6,5 °C | ± 2,0 K |
| **Ventecdak tab. 2.5.3**: U10 = 3,5, U_ej = 1, c = 2, ρ = 1,229 | z = 15/20/25/30/35/40/45/50 m | U_ref 2,20/2,86/3,25/3,52/3,74/3,91/4,06/4,19; onderdruk −0,64/−1,46/−2,12/−2,68/−3,16/−3,58/−3,97/−4,32; overdruk 2,37/4,01/5,18/6,09/6,85/7,50/8,07/8,59 Pa | U ± 0,03 m/s; p ± 3 % of ± 0,05 Pa |
| Thermische trek, proefschrift-vereenvoudiging | 10 verd., ρ0 = 1,293, T0 = 273 K | +7,5 Pa (zomer voet), −14,0 Pa (winter voet), +16,3 Pa (winter top, schacht 18 °C) | ± 0,2 Pa |
| **Zonneschoorsteen referentie**: 20 °C, 400 W/m² (vast), PT-glas, B 3,6, D 0,65, w 1,5, t_in 21 °C | 4–14 verd. | η 0,61–0,63 (fig. 4.5.6/1); ΔT/verd ≈ 0,72 K (4.2.8/6) | η ∈ [0,60; 0,68]; ΔT/verd ∈ [0,66; 0,80] |
| Zonneschoorsteen extreem | 32 °C, 840 W/m², PS-glas, 14 verd., t_in 24 | glas max ≈ 60 °C, wand max ≈ 73 °C (§4.5.11.3) | glas ± 3 K; wand ± 4 K |
| Testopstelling zonneschoorsteen 15-12-2009 | H 11, B 2,0, D 0,25, R 0,83, U_glas 1,58, U_wand 0,235, q 0,5 m³/s, 730 W/m², θ_e 0,55, t_in 20,92 | t_uit gemeten 32,1 °C | ± 2,5 K |

### 12.2 Regressie tegen het prototype (implementatie)
Vergelijk met `ewf-oracle.json`: cascade testopstelling (`tOut`, `twOut`, `xOut`, `dpHydr`), ware grootte, Ventecdak-tabel, schoorsteenreferentie, en **alle 12 presets op het standaardgebouw** (`rwl`, `tCascadeOut`, `Qcascade`, `dpHydr`, `dpThCascade`, `tChimneyOut`, `Qchimney`, `dpChimney`, `pOver`, `pEj`, `supplyMargin[]`, `exhaustMargin[]`, `Pspray`, `COP`). Toleranties: temperaturen ± 0,3 K; drukken ± 1,0 Pa of ± 3 %; vermogens ± 3 %; RW/L ± 0,03. Kleine verschillen door andere luchteigenschappen of p_ws boven ijs/water zijn acceptabel binnen deze marges.

Kernwaarden ter controle (standaardgebouw, ontwerp zomer 28 °C/55 %): q_v = 40 320 m³/h; ṁ_da = 13,27 kg/s; A_c = 5,60 m²; RW/L ≈ 0,85 → t_uit 17,0 °C / 99 %; Q_cascade ≈ −184 kW; Δp_hydr ≈ 88 Pa; Δp_th,kc ≈ 9,9 Pa; toevoermarge 78 (vl. 1) … 67 Pa (vl. 8) → smoren; afvoermarge ≈ −15 … −12 Pa → hulpventilator ≈ 0,22 kW; P_sproei ≈ 4,95 kW; COP ≈ 36; RV ruimte ≈ 65 % (waarschuwing).

### 12.3 Overige tests
- `solar`: zonnestand De Bilt (52,10 N; 5,18 O) 21-06 12:00 UTC: hoogte 61,1° (± 0,5°), azimut ≈ +9° (west van zuid); 21-12 12:00 UTC: hoogte 14,3° (± 0,5°). Erbs: k_t-grenzen; Hay-Davies: vlak loodrecht op de zon bij helder weer → beam ≈ DNI.
- `weather`: `mapOpenMeteo(fixture)` geeft t 15,7 · RV 92 · p 101 890 Pa · U10 1,4 · GHI 173 · GTI 135,1 en een plausibele beam/diffuus-splitsing (som = GTI ± 1 W/m²). Een mislukte fetch (gemockt) gooit geen onafgevangen fout.
- `model`: monotonie (meer RW/L → lagere t_uit in koelbedrijf; meer verdiepingen → meer Δp_hydr; meer Φ → hogere t_zs), invoer buiten bereik geeft waarschuwing en geen NaN, `simulate()` < 30 ms.
- Bestaande tests blijven groen.

---

## 13. Fasering en acceptatiecriteria

| Fase | Inhoud | Klaar als |
|---|---|---|
| **1 Rekenkern** | `physics.js`, `solar.js`, `model.js` (DEFAULTS, PRESETS, SPRAY, GLASS, `simulate`, `simulateAll`) + tests §12.1–12.3 | `npm test` groen; alle validatietests binnen tolerantie; `docs/ewf/METHODE.md` met validatietabel |
| **2 Weergave + invoer** | Weergaveschakelaar, zijbalkpanelen, KPI-rij, waarschuwingen, i18n NL/EN, opslag/deellink/ongedaan maken (`project.ewf`) | Standaardgebouw toont direct resultaten; wisselen tussen weergaven behoudt alles; deellink reproduceert de EWF-toestand |
| **3 Visualisatie** | Schematische doorsnede (§8.5) + grafieken (§8.6) + tabel per verdieping | Schema volgt de luchtweg en nummering 1–9, kleuren/animaties kloppen met de resultaten, licht/donker/mobiel/print ok, reduced-motion gerespecteerd |
| **4 Weer** | Presets met bron, “Weer van nu in De Bilt”, handmatig; “Alle weersituaties”-tabel | Live-knop werkt op GitHub Pages; foutafhandeling getest; bronvermelding zichtbaar |
| **5 Mollier + documentatie** | Mini-Mollier, “Open in Mollier-diagram”, procestype `cascade`, tab “Methode & bronnen” met live validatie, README-sectie EWF + bestandentabel | Procesketen zichtbaar in beide diagrammen; README bijgewerkt |
| **6 Optioneel** | Dagverloop vandaag/morgen uit de uurverwachting (`hourly=…&models=knmi_seamless`, quasi-stationair per uur) met grafieken; modus “vrij stromend” (debiet uit drukevenwicht i.p.v. constant) | Alleen als 1–5 af en stabiel zijn |

Lever per fase een korte samenvatting in de commit/PR-beschrijving: wat is gedaan, welke keuzes, openstaande punten.

---

## 14. Niet doen / valkuilen
- **Geen** figuren, tabellen of lange passages uit het proefschrift in de repo (auteursrecht). Formulenummers en korte feitelijke waarden met bronvermelding zijn prima.
- **Geen** KNMI EDR/Open Data API met sleutel in de browser; **geen** andere CDN’s of trackers.
- **Niet** formule 3.2.4/6 en het oppervlak van 3.2.5/7 zoals gedrukt gebruiken (§5.10).
- **Niet** de aerodynamische trek in de drukbalans optellen.
- **Niet** met rekenkundig gemiddelde temperaturen de thermische trek berekenen.
- **Niet** het `#p=`-deellinkformaat breken of de bestaande projectstructuur incompatibel maken.
- **Geen** stille fouten: elke onmogelijke toestand → waarschuwing met uitleg, geen NaN in de UI.
- **Niet** afronden in de kern; afronden pas bij weergave.
- Houd `simulate()` puur (geen globale toestand, geen DOM), zodat tests en de vergelijkingstabel betrouwbaar zijn.

---

## Bijlage A — Symbolen

| Symbool | Betekenis | Eenheid |
|---|---|---|
| θ_e, t_e | buitentemperatuur | °C |
| x | vochtgehalte | kg/kg (UI g/kg) |
| h | enthalpie per kg droge lucht | J/kg (UI kJ/kg) |
| ṁ_da | droge-luchtmassastroom | kg/s |
| q_v | ventilatiedebiet bij 1,20 kg/m³ | m³/s (UI m³/h) |
| RW/L | water/luchtfactor ṁ_w/ṁ_da | – |
| d30, d32 | volume- resp. Sauter-gemiddelde druppeldiameter | m (UI mm) |
| w_a, w_d, w_r | luchtsnelheid, absolute en relatieve druppelsnelheid | m/s |
| Δp_hydr | hydraulische trek (gewicht zwevend water) | Pa |
| Δp_th | thermische trek | Pa |
| U10, U_ref | potentiële wind op 10 m, wind op dakhoogte | m/s |
| Cp | winddrukcoëfficiënt | – |
| Φ | zonnestraling op het glas | W/m² |
| g, U | zontoetredingsfactor, warmtedoorgangscoëfficiënt glas | –, W/(m²·K) |
| η | thermisch rendement zonneschoorsteen | – |
| A_k | drukmarge verdieping k (+ smoren, − tekort) | Pa |

## Bijlage B — Uitvoer van het prototype (standaardgebouw, zonneschoorsteen zuid)

```
preset                                 modus     RW/L  t_toe  RV_uit  Q_cas   Q_na  RV_rm  Φgevel  t_zs   Q_zs  trek_zs  p_od  p_ej  min Δp_toe  min Δp_af  P_vent  P_pomp  COP
Ontwerp zomer 28 °C / 55 %             koelen    0.85   17.0     99    -184      0    65     400  31.1     81     0.0   6.1  -2.7       67.4      -14.8    0.22    4.95   36
Gemiddelde zomerdag 20 °C / 80 %       koelen    0.30   16.8     95     -54      3    62     400  30.8     78     8.6   6.3  -2.8       12.0      -11.7    0.17    1.75   29
Hittegolf 25-07-2019 De Bilt           koelen    1.16   17.0    100    -253      0    66     490  31.3     85    -9.2   4.4  -1.7       95.6      -24.5    0.36    6.75   36
Benauwde zomerdag 12-08-2020           koelen    0.98   17.0     99    -214      0    66     574  32.9    106    -2.5   4.4  -1.7       78.6      -18.1    0.26    5.71   36
Zonnige voorjaarsdag 15-03-2023        verwarmen 0.90    9.8    100     163    111    55     895  33.7    170    22.0   4.8  -1.9       74.2       -9.1    0.13    5.30    —
Tussenseizoen 10 °C / 99 %             verwarmen 0.90   11.8    100      59     84    62     150  22.9     25    13.7   6.5  -2.9       76.0      -13.5    0.20    5.27    —
Gemiddelde winterdag 5 °C / 90 %       verwarmen 0.90    9.9    100     158    111    55      80  21.7      9    19.3   8.7  -4.3       75.7      -12.7    0.19    5.29    —
Zonnige winterdag (testdag 15-12-2009) verwarmen 0.90    8.4    100     232    131    51     730  31.3    137    30.2   5.0  -2.0       69.6       -9.6    0.14    5.30    —
Koude-inval 13-02-2021 09:30           verwarmen 0.90    7.8    100     368    140    49     708  29.9    118    39.5   5.1  -2.0       63.0       -9.9    0.15    5.31    —
Ontwerp winter −10 °C / 90 %           verwarmen 0.90    7.2    100     397    148    47       0  20.0    -14    38.2  14.3  -8.3       69.8       -7.1    0.10    5.31    —
Storm Eunice 18-02-2022                verwarmen 0.90   10.8    100     115     98    58     184  23.2     30    12.8  89.6 -73.4      160.3       56.7    0.00    5.29    —
Windstil, bewolkt 20 °C                koelen    0.30   16.8     95     -54      3    62     120  26.6     22     6.4   0.3  -0.0        6.1      -16.8    0.25    1.75   29
(Q in kW, drukken in Pa, P in kW; t_zs = uittrede zonneschoorsteen; Q_zs < 0 → schoorsteen dicht)
```

Wat de adviseur hieruit leest (en wat de UI zichtbaar moet maken):
- De **hydraulische trek** (≈ 90 Pa bij 8 lagen) domineert de toevoer: er moet bijna altijd gesmoord worden. Met RW/L = 0,3 en weinig wind blijft er nog 6–12 Pa marge over; met variant A1 (cascade uit) is een hulpventilator nodig.
- De **afvoer** komt bij 8 lagen meestal 7–25 Pa tekort (zonneschoorsteen + ejector < verliezen incl. FiWiHEx); de hulpventilator vraagt maar 0,1–0,4 kW. In de winter hebben de bovenste lagen het minste trek (shuntkolom).
- Bij **storm** worden over- en onderdruk zo groot dat de kleppen fors moeten smoren.
- De cascade haalt 17 °C ook bij de **hittegolf** (RW/L ≈ 1,16), maar de ruimte-RV komt in de zomer boven 60 %: de droging is beperkt.
