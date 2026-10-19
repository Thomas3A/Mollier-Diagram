# Mollier h,x-diagram

Interactief **Mollier h,x-diagram** (en psychrometrisch diagram) voor het ontwerpen en controleren van
luchtbehandelingsprocessen. Drie werkwijzen:

1. **Processen** — stap voor stap: eerst debiet en begintoestand, dan processen kiezen en invullen
   (verwarmen, koelen, mengen, WTW, …) en direct toestanden, vermogens en waterdebieten aflezen.
2. **LBK samenstellen** — een luchtbehandelingskast component voor component opbouwen: een bestaande LBK
   (met capaciteiten, om scenario's te testen) of een nieuw ontwerp vanuit de eisen aan de toevoerlucht.
3. **Energieverbruik** — de geselecteerde LBK uur voor uur doorrekenen over een klimaatjaar (KNMI De Bilt),
   met weekpatroon, bedrijf buiten kantooruren en resultaten per maand.

De app start altijd met een leeg diagram; de vorige sessie blijft herstelbaar.

Geen build-stap, geen server: statische HTML + JavaScript. Werkt ook offline (D3 is meegeleverd).

**Live:** https://thomas3a.github.io/Mollier-Diagram/

## Functies

**Diagram**
- Klassiek Mollier h,x-diagram met scheve coördinaten: verticaal (h − 2501·x)/1,006, dus waaierende
  isothermen, rechte isenthalpen en geknikte isothermen in het **mistgebied**.
- Omschakelbaar naar het psychrometrisch (ASHRAE/Carrier) diagram — toets `M`.
- Lagen aan/uit: RH-lijnen φ, isenthalpen, isothermen, natteboltemperatuur, dichtheid ρ / specifiek volume v,
  mistgebied, randmaatstaf Δh/Δx, dampspanningsschaal, waarden bij punten.
- Statusbalk met t, x, φ, h, t_nat, t_dauw, ρ en p_w onder de cursor, met hulplijnen door het punt.
- Zoomen (Ctrl/⌘ + scroll, knijpen), verschuiven, *passend maken* en instelbaar bereik met voorinstellingen.
- Punten slepen (beginpunt, vrije punten, mengstroom, retourlucht); dubbelklik voegt een punt toe.

**Processen** (elke stap rekent live door; foutieve stappen worden gemarkeerd, de keten loopt door)

| Categorie    | Processen |
|--------------|-----------|
| Verwarmen    | naar t, met ΔT, met vermogen, naar h, naar RH |
| Koelen       | ideale koeler (dauwpuntknik + condensatie), **koelbatterij met ADP en bypassfactor**, koelen & ontvochtigen naar t/RH (ADP en BF afgeleid) |
| Bevochtigen  | adiabatisch (rendement, RH, x of t), stoom (RH, x, Δx, kg/h), waterverneveling met watertemperatuur |
| Ontvochtigen | isotherm, sorptiewiel (h constant) |
| Mengen       | tweede luchtstroom via aandeel, m³/h of kg/h — droge-luchtmassastroom neemt toe |
| WTW          | sensibel (platen/twin-coil) en enthalpiewiel, met retourlucht |
| Overig       | ruimtebelasting (Q_s + vochtproductie), ventilatoropwarming (Δp, η), vrij punt |

**Resultaten**
- Tabel met alle toestanden (t, x, RH, h, t_nat, t_dauw, ρ, v, p_w, ṁ, V) en processen
  (Δt, Δx, Δh, Q_s, Q_l, Q, water, SHR, Δh/Δx).
- Kerngetallen: verwarmings-, koel- en WTW-vermogen, bevochtigings- en ontvochtigingsdebiet, eindpunt.
- Beginpunt via elk paar: t+RH, t+x, t+t_nat, t+t_dauw, t+h, h+x, x+RH, h+RH, t_nat+RH.
- Luchtdruk uit hoogte of direct in kPa.

**Werken**
- Leeg beginnen: stap 1 is het luchtdebiet en de begintoestand; het procesformulier (stap 2) wordt pas
  actief als punt 1 in het diagram staat. *Bestand → Vorige sessie herstellen* haalt het laatste werk terug.
- Scenario's met eigen kleur, naam en zichtbaarheid (dupliceren, verwijderen).
- Ongedaan maken / opnieuw (Ctrl+Z / Ctrl+Y); alles wordt automatisch in de browser bewaard.
- **Delen via link** (project gecomprimeerd in de URL), project opslaan/openen als JSON.
- Export: PNG, SVG (vector), CSV (Excel-vriendelijk: `;` en decimale komma in NL), afdrukken/PDF.
- Nederlands en Engels, licht en donker thema, bruikbaar op telefoon en tablet.
- Projecten uit de vorige versie worden automatisch overgenomen.

## LBK samenstellen

Tweede weergave (schakelaar in de topbalk): een **luchtbehandelingskast stap voor stap samenstellen**.

- **Bestaande LBK** (capaciteit per batterij/bevochtiger; vermogens worden daarop begrensd en de tool laat zien
  of de eisen worden gehaald) of **nieuw ontwerp** (onbegrensd: de tool berekent de benodigde vermogens;
  *Vermogens vastleggen* neemt ze +10 % over en rekent verder als bestaande LBK).
- **Stap 1–4:** luchtdebiet (toevoer en retour), eisen aan de toevoerlucht (vast of buitentemperatuur-
  gecompenseerd, min./max. vochtgehalte, retourlucht), componenten aan de toevoerzijde in luchtrichting en de
  retour-/afvoerzijde. Componenten: filter, WTW (platenwisselaar, twin-coil, thermisch wiel, sorptiewiel, met
  vorstbeveiliging en optioneel indirect adiabatisch koelen), mengkamer (vast of regelend), verwarmer
  (naar setpoint of voorverwarmer), koeler (bypassfactor en ADP, ontvochtigen tot x_max), bevochtiger
  (stoom of adiabatisch), ventilator (Δp, η, deellastexponent) en geluiddemper. Volgorde wijzigen, aan/uit,
  dupliceren; *Voorstel op basis van de eisen* zet een standaard-LBK neer.
- **Resultaat bij winter- en zomerontwerpcondities:** kerngetallen (vermogens, SFP, WTW), adviezen,
  een **LBK-schema** met puntnummers en toestanden, het **Mollier-diagram** (beide condities, met een
  comfortzone die je met een knop aan/uit zet en waarvan je de grenzen instelt) en tabellen met
  toestanden en vermogens per component. *Open in Processen* zet de procesketen als scenario's in het diagram.
- Meerdere LBK's per project (varianten vergelijken), alles in opslaan, delen en ongedaan maken.

## Energieverbruik

Derde weergave, alleen actief als er een LBK is samengesteld:

- **Weekpatroon** van 7 × 24 uurblokken met bezetting (standaard werkdagen 8–17 uur met 80 %): klikken of slepen
  om te schilderen, dag-/uurkoppen vullen een rij of kolom, snelle voorinstellingen.
- **Bedrijfsvoering:** debiet volgt de bezetting (met minimum) of constant; **buiten kantooruren**: uit,
  basisventilatie (volledig behandeld of alleen vorstvrij) of zomernachtventilatie.
- **Klimaatjaar:** energiejaar, ontwerpjaren T5 en T1, stresstestwinters 1978/79 en 1962/63
  (reconstructie NEN 5060:2018 uit KNMI De Bilt, geen officiële NEN-data) en de werkelijke jaren 1951–2025.
- **Resultaten:** warmte, koude, bevochtiging en ventilatoren per maand (gestapelde kolommen in kWh of €),
  tabellen per maand en per component, belastingduurkromme, uren waarin de eisen niet worden gehaald,
  eindenergie (gas, elektriciteit, warmte, water) en kosten volgens opwekking en tarieven, en een vergelijking
  van alle LBK's.
- Rekenmethode: [`docs/lbk/METHODE.md`](docs/lbk/METHODE.md); klimaatdata: [`docs/klimaat/README.md`](docs/klimaat/README.md).

## Earth, Wind & Fire

Vierde weergave (schakelaar in de topbalk of toets `E`): een fysisch onderbouwde **momentopname van het
Earth, Wind & Fire-concept** (Ventecdak, klimaatcascade, zonneschoorsteen) voor een kantoorgebouw in
Nederland, naar B. Bronsema (2013), *Earth, Wind & Fire – Natuurlijke Airconditioning*, proefschrift TU Delft.

- **Standaard staat het 8-laags kantoor uit het proefschrift ingevuld** (8 × 1000 m² AVO, 40 320 m³/h); alle
  gebouw- en systeemparameters zijn aanpasbaar, met bron, zinvol bereik en de badge *aanname* waar het
  proefschrift geen waarde geeft.
- **Weer:** 12 realistische Nederlandse weersituaties (ontwerpcondities en echte KNMI-uren De Bilt),
  handmatige invoer en **“Weer van nu in De Bilt”** (KNMI HARMONIE-AROME via Open-Meteo, geen sleutel nodig).
- **Resultaten:** luchtbehandeling in de cascade (automatische water/luchtfactor), drukopbouw door wind,
  hydraulische en thermische trek, zonneschoorsteen en FiWiHEx, drukbalans per verdieping (smoren of
  hulpventilator), pomp- en ventilatorvermogens, COP en comfortcontrole.
- **Visualisatie:** schematische doorsnede (kleur = temperatuur, geanimeerde luchtweg en druppels, nummering
  1–9 zoals de conceptschets), cascadeprofiel, drukbalans met opbouw, zonneschoorsteen, energie,
  tabel per verdieping, vergelijking van alle weersituaties en een mini-Mollier met de procesketen.
- **Koppeling:** “Open in Mollier-diagram” zet de procesketen als scenario in het Mollier-diagram, met het
  nieuwe procestype *klimaatcascade*. EWF-invoer gaat mee in opslaan, delen (`#p=`) en ongedaan maken.
- **Methode & bronnen** in de app (met live validatietabel) en uitgebreid in [`docs/ewf/METHODE.md`](docs/ewf/METHODE.md);
  de specificatie staat in [`docs/ewf/SPEC.md`](docs/ewf/SPEC.md), de referentie-implementatie in
  `docs/ewf/ewf_prototype.py`.

Quasi-stationair ontwerpmodel ter verkenning; geen vervanging voor CFD, windtunnelonderzoek of dynamische
gebouwsimulatie. Weergegevens: Open-Meteo.com (CC BY 4.0), model KNMI HARMONIE-AROME — modelwaarde, geen meting.

## Rekenmethode

ASHRAE Handbook – Fundamentals 2017, hoofdstuk 1:
verzadigingsdampdruk boven water en ijs volgens Hyland-Wexler (eq. 5–6), dauwpunt door inversie
(Newton-Raphson), natteboltemperatuur eq. 33/35, specifiek volume en dichtheid eq. 26–28,
luchtdruk uit hoogte eq. 3. Vermogens: Q = ṁ_L · Δh met ṁ_L de droge-luchtmassastroom; bij koelen met
condensatie gaat de enthalpie van het condensaat eraf: Q = ṁ_L · [(h₁ − h₂) − (x₁ − x₂) · h_w(t₂)] (ASHRAE).
Loopt de rechte lijn van een koelbatterij naar het ADP door het mistgebied (zeer vochtige intrede), dan
slaan de druppels neer als condensaat en treedt de lucht verzadigd uit bij dezelfde temperatuur.
Stoombevochtiging gebruikt Δh/Δx = 2501 + 1,86 · t_stoom (Mollier-conventie; ≈ 0,4 % boven de
stoomtabel bij 100 °C, effect op t₂ ≈ 0,05 K).

De rekenkern is getest tegen **PsychroLib** (de ASHRAE-referentie-implementatie) over −30…60 °C,
5…100 % RH en twee drukken: afwijking in x, h, v en ρ < 1·10⁻⁹, natteboltemperatuur < 0,002 K.

Bedoeld als engineering-hulpmiddel; controleer kritische ontwerpen met gevalideerde software.

## Lokaal draaien

Open `index.html` in een moderne browser, of start een lokale server:

```bash
npm start        # http://localhost:8080
npm test         # rekenkern-, proces-, LBK-, klimaat- en EWF-tests (Node 18+)
```

## Bestanden

| Bestand                  | Inhoud |
|--------------------------|--------|
| `index.html`             | Pagina-opbouw |
| `css/app.css`            | Stijl (licht/donker, responsief, print) |
| `js/psychro.js`          | Rekenkern vochtige lucht (ASHRAE 2017, incl. mistgebied) |
| `js/processes.js`        | Processtappen, scenario-doorrekening, vermogens |
| `js/chart.js`            | Mollier- en psychrometrisch diagram (SVG/D3), zoom, slepen, export |
| `js/i18n.js`             | Teksten NL/EN en getalnotatie |
| `js/app.js`              | Toestand, formulieren, tabellen, geschiedenis, opslaan en delen, weergaveschakelaar |
| `js/ewf/physics.js`      | EWF-fysica: wind/Ventecdak, klimaatcascade, zonneschoorsteen, trek, wrijving (geen DOM) |
| `js/ewf/solar.js`        | Zonnestand (NOAA), Erbs, Hay-Davies, invalshoekcorrectie (geen DOM) |
| `js/ewf/model.js`        | Standaardgebouw, invoerschema, weerpresets, `simulate()`, validatie (geen DOM) |
| `js/ewf/weather.js`      | “Weer van nu” via Open-Meteo (KNMI HARMONIE-AROME) |
| `js/ewf/schematic.js`    | Schematische doorsnede (SVG) |
| `js/ewf/charts.js`       | EWF-grafieken (D3) |
| `js/ewf/view.js`         | EWF-weergave: panelen, KPI's, meldingen, tabbladen |
| `css/ewf.css`            | Stijl EWF-weergave |
| `js/lbk/engine.js`       | LBK-rekenkern: componenten, regeling per uur, ontwerpcondities, jaarberekening, eindenergie (geen DOM) |
| `js/lbk/climate.js`      | Klimaatjaren laden (lazy) en omrekenen naar T en x per uur |
| `js/lbk/view.js`         | Weergave LBK samenstellen: zijbalk, kerngetallen, adviezen, Mollier-diagram, tabellen |
| `js/lbk/schematic.js`    | LBK-schema (SVG) |
| `js/lbk/energy.js`       | Weergave Energieverbruik: weekpatroon, instellingen, grafieken en tabellen |
| `js/lbk/texts.js`        | Teksten LBK en energie (NL/EN) |
| `css/lbk.css`            | Stijl LBK- en energieweergave |
| `data/klimaat/`          | Klimaatdata KNMI De Bilt (referentiejaren en 1951–2025, als script verpakte JSON) |
| `docs/lbk/`, `docs/klimaat/` | Rekenmethode LBK en herkomst klimaatdata |
| `scripts/klimaat/`       | Reproductie van de klimaatjaren (Python) en `wrap-json.js` |
| `docs/ewf/`              | Specificatie, rekenmethode en validatie, referentie-implementatie (Python) |
| `vendor/d3.min.js`       | D3 v7.9.0 (ISC-licentie) |
| `test/`                  | Tests, PsychroLib-referentiewaarden, EWF-orakel, weer-fixture, LBK- en klimaattests |

## GitHub Pages

De site wordt door GitHub Pages geserveerd vanuit de root van `main` (statische bestanden plus `.nojekyll`).
Elke push of merge naar `main` publiceert automatisch; de workflow *Tests* draait `npm test` bij elke push.
