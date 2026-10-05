# Mollier h,x-diagram

Interactief **Mollier h,x-diagram** (en psychrometrisch diagram) voor het ontwerpen en controleren van
luchtbehandelingsprocessen. Kies een beginpunt, voeg processtappen toe en lees direct toestanden,
vermogens en waterdebieten af — met een echt scheefhoekig Mollier-diagram, live voorvertoning en
meerdere scenario's (bijv. zomer en winter) in één diagram.

Geen build-stap, geen server: statische HTML + JavaScript. Werkt ook offline (D3 is meegeleverd).

**Live:** https://thomas3a.github.io/Mollier-Diagram/

## Functies

**Diagram**
- Klassiek Mollier h,x-diagram met scheve coördinaten: verticaal (h − 2501·x)/1,006, dus waaierende
  isothermen, rechte isenthalpen en geknikte isothermen in het **mistgebied**.
- Omschakelbaar naar het psychrometrisch (ASHRAE/Carrier) diagram — toets `M`.
- Lagen aan/uit: RH-lijnen φ, isenthalpen, isothermen, natteboltemperatuur, dichtheid ρ / specifiek volume v,
  mistgebied, comfortzone, randmaatstaf Δh/Δx, dampspanningsschaal, waarden bij punten.
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
- Scenario's met eigen kleur, naam en zichtbaarheid (dupliceren, verwijderen).
- Ongedaan maken / opnieuw (Ctrl+Z / Ctrl+Y); alles wordt automatisch in de browser bewaard.
- **Delen via link** (project gecomprimeerd in de URL), project opslaan/openen als JSON.
- Export: PNG, SVG (vector), CSV (Excel-vriendelijk: `;` en decimale komma in NL), afdrukken/PDF.
- Nederlands en Engels, licht en donker thema, bruikbaar op telefoon en tablet.
- Projecten uit de vorige versie worden automatisch overgenomen.

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
npm test         # rekenkern- en procestests (Node 18+)
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
| `js/app.js`              | Toestand, formulieren, tabellen, geschiedenis, opslaan en delen |
| `vendor/d3.min.js`       | D3 v7.9.0 (ISC-licentie) |
| `test/`                  | Tests en PsychroLib-referentiewaarden |

## GitHub Pages

De site wordt door GitHub Pages geserveerd vanuit de root van `main` (statische bestanden plus `.nojekyll`).
Elke push of merge naar `main` publiceert automatisch; de workflow *Tests* draait `npm test` bij elke push.
