/**
 * texts.js — teksten voor "LBK samenstellen" en "Energieverbruik" (NL en EN), via I18N.extend().
 */
(function (root) {
    'use strict';
    const I = root.I18N;
    if (!I || !I.extend) return;

    I.extend('nl', {
        lbk: {
            empty: {
                title: 'Stel een luchtbehandelingskast samen',
                text: 'Bouw de LBK stap voor stap op in luchtrichting: buitenlucht → filter → WTW → batterijen → bevochtiger → ventilator → toevoer. De tool regelt elk component naar de eisen aan de toevoerlucht en toont het resultaat in een schema, het Mollier-diagram en tabellen. Daarna reken je in de tab Energieverbruik een heel jaar door.',
                existing: 'Bestaande LBK doorrekenen', existingSub: 'Componenten met hun capaciteit: test scenario’s en zie of de eisen worden gehaald.',
                design: 'Nieuwe LBK ontwerpen', designSub: 'Vanuit de eisen aan de toevoerlucht: de tool berekent de benodigde vermogens.',
                example: 'Of start met een voorbeeld-LBK'
            },
            panel: {
                units: 'LBK’s', flow: '1 · Luchtdebiet', req: '2 · Eisen toevoerlucht', comps: '3 · Componenten — toevoerzijde',
                ret: '4 · Retour- en afvoerzijde', design: 'Ontwerpcondities'
            },
            unit: {
                add: 'Nieuw', addExisting: 'Bestaande LBK', addDesign: 'Nieuw ontwerp', name: 'Naam LBK', color: 'Kleur',
                dup: 'Dupliceren', del: 'Verwijderen', confirmDel: 'LBK "{name}" verwijderen?', newName: 'LBK {n}',
                copy: '{name} (kopie)', max: 'Maximaal {n} LBK’s per project.'
            },
            mode: {
                existing: 'Bestaande LBK', design: 'Nieuw ontwerp',
                hintExisting: 'Vul per component de capaciteit in (0 = onbegrensd). De vermogens worden daarop begrensd; de tool laat zien of de eisen worden gehaald.',
                hintDesign: 'De vermogens zijn onbegrensd: de tool berekent wat elk component bij de ontwerpcondities moet kunnen leveren.'
            },
            f: {
                flow: 'Toevoerdebiet', retFlow: 'Retourdebiet', supMode: 'Toevoertemperatuur',
                t: 'Toevoertemperatuur', tWin: 'Toevoer winter', tSum: 'Toevoer zomer', tOutWin: 'Winter bij T_buiten ≤', tOutSum: 'Zomer bij T_buiten ≥',
                xMinOn: 'Bevochtigen tot minimaal', xMaxOn: 'Ontvochtigen tot maximaal', xMin: 'x_min toevoer', xMax: 'x_max toevoer',
                retTWin: 'Retour winter', retTSum: 'Retour zomer', dx: 'Vochtlast ruimte Δx', dT: 'Buitentemperatuur', dRh: 'RV buiten'
            },
            o: { supMode: { const: 'Vast', comp: 'Gecompenseerd' } },
            flowHint: 'ṁ = {m} kg/s droge lucht (ρ = 1,2 kg/m³) · retour {r} m³/h',
            rhHint: '≈ {rh} % RV bij {t} °C',
            compHint: 'Winter → zomer lineair tussen beide buitentemperaturen; de retourtemperatuur volgt dezelfde overgang.',
            retHead: 'Retourlucht uit de ruimte',
            retHint: 'x_retour = x_toevoer + Δx zolang er bezetting is.',
            designHint: 'NL-praktijk: winter −10 °C / 90 %, zomer 28 °C / 50 %. Volle bezetting en 100 % debiet.',
            comp: {
                filter: 'Filter', hr: 'WTW', mix: 'Mengkamer', heater: 'Verwarmer', cooler: 'Koeler', humid: 'Bevochtiger',
                fan: 'Ventilator', silencer: 'Geluiddemper'
            },
            name: {
                hr: { plate: 'Platenwisselaar', runaround: 'Twin-coil (WTW-batterijen)', wheel: 'Thermisch wiel', sorption: 'Sorptiewiel' },
                heater: { pre: 'Voorverwarmer', main: 'Verwarmer', reheat: 'Naverwarmer' },
                humid: { steam: 'Stoombevochtiger', adiabatic: 'Adiabatische bevochtiger' },
                fan: { sup: 'Toevoerventilator', ret: 'Retourventilator' },
                mix: { fixed: 'Mengkamer', econ: 'Mengkamer (regelend)' },
                filter: { sup: 'Filter', ret: 'Retourfilter' },
                silencer: { sup: 'Geluiddemper', ret: 'Geluiddemper' }
            },
            hint: {
                filter: 'Alleen drukverlies (gemiddeld tussen begin- en eindweerstand). Telt mee in het ventilatorvermogen.',
                hr: 'Moduleert (bypass/toerental) tot het setpoint en regelt terug als de afvoerlucht onder de vorstgrens zou komen (droge afvoertemperatuur). In de zomer koude-terugwinning als het buiten warmer is dan retour.',
                mix: 'Recirculatie van retourlucht vóór de WTW. Regelend: meer recirculatie bij warmte- of koudevraag, 100 % buitenlucht als dat gunstig is.',
                heater: 'Verwarmt naar het toevoer-setpoint min de ventilatoropwarming erna, of naar een vast setpoint (voorverwarmer). Vóór een adiabatische bevochtiger levert hij ook de verdampingswarmte.',
                cooler: 'Bypassfactor-model: uittrede op de rechte lijn intrede → apparaatdauwpunt (ADP). Koelt naar het setpoint en ontvochtigt zo nodig tot x_max; een naverwarmer erna brengt de lucht weer op temperatuur.',
                humid: 'Bevochtigt tot x_min. Stoom: Δh/Δx = h van de stoom (100 °C). Adiabatisch: langs de natteboltemperatuur, begrensd door het rendement; de verwarmer ervóór levert de warmte.',
                fan: 'P = q_v · Δp / η · (q/q_n)^n. Interne weerstand van alle componenten aan deze zijde telt mee; alle elektrische energie wordt warmte in de luchtstroom.',
                silencer: 'Alleen drukverlies.'
            },
            fc: {
                dp: 'Drukverlies', kind: 'Uitvoering', eta: 'Temperatuurrendement', etaX: 'Vochtrendement', frost: 'Vorstgrens afvoer',
                iec: 'Indirect adiabatisch koelen (afvoerzijde)', iecEta: 'Rendement bevochtiging afvoer', ctrl: 'Regeling', share: 'Recirculatie',
                shareMax: 'Max. recirculatie', role: 'Functie', tSet: 'Setpoint', qMax: 'Capaciteit', bf: 'Bypassfactor', adpMin: 'Min. ADP (koudwater)',
                dehum: 'Ontvochtigen tot x_max', cap: 'Capaciteit', dpExt: 'Externe druk', n: 'Deellastexponent n', pos: 'Positie', etaAdia: 'Rendement'
            },
            tip: {
                dp: 'Drukverlies over het component bij ontwerpdebiet.', eta: 'Temperatuurrendement aan de toevoerzijde bij gelijke debieten (NEN-EN 308).',
                etaX: 'Vochtrendement: aandeel van het verschil in vochtgehalte dat wordt overgedragen.',
                frost: 'Wordt de droge afvoertemperatuur lager, dan regelt de WTW terug (platenwisselaar typisch 0…+3 °C; wielen en twin-coil nauwelijks).',
                iec: 'Bevochtig de afvoerlucht vóór de WTW in de zomer; de koudere afvoerlucht koelt via de WTW de toevoerlucht (geen vocht in de toevoer).',
                share: 'Aandeel retourlucht in het toevoerdebiet. Regelend: dit is het maximum (minimaal buitenluchtaandeel = 100 % − dit).',
                qMax: 'Maximaal vermogen van de batterij. 0 = onbegrensd.', cap: 'Maximale bevochtigingscapaciteit. 0 = onbegrensd.',
                bf: 'Aandeel lucht dat de lamellen „mist” (typisch 0,05–0,15). Lager = dieper koelen bij hetzelfde ADP.',
                adpMin: 'Laagste oppervlaktetemperatuur die de koeler haalt: ≈ koudwatertemperatuur + 1 K (6/12 °C → ±7 °C). Begrenst de ontvochtiging.',
                n: 'P ∝ (q/q_n)^n bij deellast: 2 bij drukregeling in het kanaal, 3 zonder (affiniteitswet).',
                pos: 'Vóór de WTW: de ventilatorwarmte gaat via de WTW terug de toevoer in. Na de WTW: die warmte gaat naar buiten.',
                tSet: 'Vast setpoint, bijv. 5 °C als vorstbeveiliging van de batterijen erna.'
            },
            o2: {
                kind: { plate: 'Platenwisselaar', runaround: 'Twin-coil', wheel: 'Thermisch wiel', sorption: 'Sorptiewiel (enthalpie)', steam: 'Stoom', adiabatic: 'Adiabatisch' },
                ctrl: { fixed: 'Vast aandeel', econ: 'Regelend' },
                role: { main: 'Naar toevoertemperatuur', pre: 'Vast setpoint (voorverwarmer)' },
                pos: { after: 'Na de WTW', before: 'Vóór de WTW' }
            },
            zeroIsFree: '0 = onbegrensd',
            act: { up: 'Omhoog', down: 'Omlaag', toggle: 'Aan/uit', dup: 'Dupliceren', del: 'Verwijderen', edit: 'Bewerken' },
            add: 'Toevoegen in luchtrichting', addRet: 'Toevoegen aan de retourzijde',
            single: 'Er kan maar één {name} in de LBK.', maxComps: 'Maximaal {n} componenten.',
            propose: 'Voorstel op basis van de eisen', proposeConfirm: 'De huidige componenten vervangen door een voorstel?',
            proposed: 'Voorstel samengesteld — pas het gerust aan.',
            compsEmpty: 'Nog geen componenten. Begin bij de buitenlucht en voeg ze toe in luchtrichting, bijvoorbeeld filter → WTW → koeler → verwarmer → ventilator.',
            retEmpty: 'Nog niets aan de retourzijde. Een retourventilator is nodig voor de WTW en mengkamer; zijn vermogen telt mee in het energieverbruik.',
            kpi: {
                heat: 'Verwarming', cool: 'Koeling', humid: 'Bevochtiging', fans: 'Ventilatoren', hr: 'WTW', supply: 'Toevoerlucht',
                need: 'benodigd', cap: 'capaciteit {v}', lat: 'waarvan latent {v} kW', steam: 'stoom {v} kW', water: 'water, adiabatisch',
                sfp: 'SFP toevoer {v} · SFP{c}', hrWin: 'winter · η {eta} %', hrFrost: 'winter · η {eta} % (vorstbeveiliging)',
                ok: 'eisen gehaald', nok: 'eisen niet gehaald', summer: 'zomer {v}'
            },
            cond: { win: 'Winter', sum: 'Zomer', label: '{name} {t} °C / {rh} %' },
            schema: {
                title: 'LBK-schema', out: 'Buitenlucht', sup: 'Toevoer', ret: 'Retour', exh: 'Afvoer',
                hint: 'Klik op een component om het te bewerken. Getallen bij de ontwerpconditie die rechtsboven is gekozen.',
                recirc: 'recirculatie {v} %'
            },
            chart: { title: 'Mollier-diagram · ontwerpcondities', toProc: 'Open in Processen', toProcDone: 'Scenario’s „{a}” en „{b}” staan nu in de weergave Processen.', hover: 'Beweeg over het diagram of een punt om de luchttoestand af te lezen.' },
            tab: { states: 'Toestanden', comps: 'Componenten & vermogens', csv: 'CSV' },
            col: { point: 'Punt', where: 'Positie', comp: 'Component', q: 'Q', water: 'Water', status: 'Status', cap: 'Capaciteit', need: 'Benodigd', dp: 'Δp', elec: 'P_el' },
            st: { ok: 'in orde', capped: 'op capaciteit', frost: 'vorstbeveiliging', off: 'uitgeschakeld', idle: 'niet actief' },
            row: { out: 'Buitenlucht', after: 'na {name}', ret: 'Retourlucht', exh: 'Afvoerlucht', sup: 'Toevoer' },
            fix: 'Vermogens vastleggen (+10 %)', fixTitle: 'Neem de benodigde vermogens (+10 % marge) over als capaciteit en reken verder als bestaande LBK.',
            fixed: 'Capaciteiten vastgelegd; de LBK wordt nu doorgerekend als bestaande LBK.',
            toEnergy: 'Energieverbruik berekenen',
            w: {
                empty: 'Voeg links componenten toe om de LBK op te bouwen.',
                noFan: 'Er is geen toevoerventilator: zonder ventilator stroomt er niets.',
                hrNoRet: 'De WTW heeft een retourdebiet nodig.',
                noRetFan: 'Geen retourventilator: het retourdebiet wordt verondersteld, maar zijn energie telt niet mee.',
                noReheat: 'De koeler ontvochtigt, maar er staat geen verwarmer ná de koeler: de toevoerlucht wordt te koud.',
                humidIdle: 'Er is een bevochtiger, maar bevochtigen staat uit bij de eisen (stap 2).',
                steamBeforeHeater: 'De stoombevochtiger staat vóór de verwarmer: koude lucht neemt weinig vocht op (max. 95 % RV).',
                adiaNoHeater: 'Een adiabatische bevochtiger heeft een verwarmer ervóór nodig die de verdampingswarmte levert.',
                coolNoDehum: 'Ontvochtigen staat uit bij de eisen: de koeler koelt alleen naar het temperatuursetpoint.',
                tLow: '{cond}: toevoerlucht {v} K te koud.', noHeater: '{cond}: toevoerlucht {v} K te koud — voeg een verwarmer toe.',
                tHigh: '{cond}: toevoerlucht {v} K te warm.', noCooler: '{cond}: toevoerlucht {v} K te warm — er is geen koeler.',
                xLow: '{cond}: vochtgehalte {v} g/kg te laag.', noHumid: '{cond}: vochtgehalte {v} g/kg te laag — er is geen bevochtiger.',
                xHigh: '{cond}: vochtgehalte {v} g/kg te hoog.', noDehum: '{cond}: vochtgehalte {v} g/kg te hoog — ontvochtigen vraagt een koeler.',
                frost: '{cond}: vorstbeveiliging WTW actief, rendement teruggeregeld tot {v} %.',
                ok: 'De toevoerlucht haalt de eisen bij beide ontwerpcondities.',
                capped: ' Op capaciteit: {names}.'
            },
            en: {
                locked: 'Stel eerst een LBK samen in de tab LBK samenstellen; daarna reken je hier het jaarverbruik uit.', lockedBtn: 'Naar LBK samenstellen',
                panel: { unit: 'LBK', ops: 'Bedrijfsvoering', climate: 'Klimaatjaar', gen: 'Opwekking', tariffs: 'Tarieven (project)' },
                edit: 'Bewerken', unitSum: '{mode} · {flow} m³/h · {n} componenten',
                f: {
                    control: 'Debietregeling', minFlow: 'Min. debiet', off: 'Buiten kantooruren', offFlow: 'Debiet', ecoT: 'Min. toevoertemperatuur',
                    nightFlow: 'Debiet', nightTMin: 'Niet onder T_buiten', nightTrig: 'Na een dag met T_max ≥',
                    climate: 'Klimaatjaar', heat: 'Warmteopwekking', etaHeat: 'Rendement (bovenwaarde)', etaDistrict: 'Distributierendement',
                    etaElec: 'Rendement', scop: 'SCOP', seer: 'SEER koelmachine', steam: 'Stoombevochtiger', etaSteam: 'Rendement stoomopwekking',
                    elec: 'Elektriciteit', gas: 'Aardgas', heatT: 'Warmte', water: 'Water'
                },
                o: {
                    control: { vav: 'Volgt bezetting', cav: 'Constant' },
                    off: { off: 'LBK uit', vent: 'Basisventilatie, volledig behandeld', eco: 'Basisventilatie, alleen vorstvrij', night: 'Zomernachtventilatie' },
                    heat: { boiler: 'HR-ketel (aardgas)', hp: 'Warmtepomp', district: 'Stadsverwarming', elec: 'Elektrisch' },
                    steam: { elec: 'Elektrisch', gas: 'Gasgestookt' }
                },
                controlHint: {
                    vav: 'Tijdens bedrijfsuren: debiet = max(min. debiet, bezetting). Ventilatorvermogen ∝ debiet^n.',
                    cav: 'In elk uur met bezetting > 0 draait de LBK op 100 % debiet.'
                },
                offHint: {
                    off: 'Uren met 0 % bezetting: ventilatoren uit, geen behandeling, geen energie.',
                    vent: 'Uren met 0 % bezetting: gereduceerd debiet met dezelfde eisen aan de toevoerlucht (zonder vochtlast in de ruimte).',
                    eco: 'Uren met 0 % bezetting: gereduceerd debiet, WTW actief, verwarmen alleen tot de minimumtemperatuur; geen koeling of bevochtiging.',
                    night: 'Na een warme dag ’s nachts ventileren met koele buitenlucht (WTW in bypass, geen behandeling). Alleen het ventilatorverbruik wordt gerekend; het koeleffect op het gebouw valt buiten dit model.'
                },
                climate: {
                    groupRef: 'Referentiejaren (reconstructie NEN 5060:2018)', groupKnmi: 'Werkelijke jaren KNMI De Bilt (alleen temperatuur)',
                    energie: 'Energiejaar — langjarig gemiddeld (jaarverbruik)', T5: 'Ontwerpjaar T5 — gemiddelde winter', T1: 'Ontwerpjaar T1 — strenge winter',
                    winter1979: 'Stresstest strenge winter 1978/79 (≈ 1× per 25 jaar)', winter1963: 'Stresstest extreme winter 1962/63 (≈ 1× per eeuw)',
                    year: '{y}', yearRec: '{y} — stresstest', loadKnmi: 'Werkelijke jaren laden (2,3 MB)…',
                    loading: 'Klimaatdata laden…', loadFail: 'Klimaatdata konden niet worden geladen.',
                    note: 'Reconstructie op basis van KNMI De Bilt; geen officiële NEN 5060-data.',
                    stats: 'T gem. {tg} °C · T min {tmin} °C · koudste week {kw} °C · {gd} graaddagen (18 °C)',
                    approx: 'Werkelijk jaar: alleen de temperatuur is gemeten. Het vochtgehalte is benaderd met het energiejaar, dus latente koeling en bevochtiging zijn indicatief.',
                    advice: 'Energiejaar voor het jaarverbruik; T1 en de stresstestwinters om te zien hoe vaak de LBK tekortschiet.'
                },
                sched: {
                    title: 'Weekpatroon — bezetting per uur',
                    hint: 'Klik of sleep over de uurblokken om de gekozen bezetting te schilderen. De dag- en uurkoppen vullen een hele dag of hetzelfde uur van alle dagen. Blokken met 0 % gelden als buiten kantooruren.',
                    brush: 'Bezetting', custom: 'Eigen waarde', presets: 'Snel invullen',
                    preset: { office: 'Kantoor 8–17 · 80 %', long: 'Lang open 7–19 · 100 %', always: '24/7 · 100 %', clear: 'Alles leeg' },
                    days: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'],
                    daysLong: ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
                    summary: '{h} bedrijfsuren per week · gemiddelde bezetting {m} % · {y} bedrijfsuren in dit klimaatjaar',
                    cell: '{day} {h}:00–{h2}:00 · {v} %', fillDay: 'Hele {day} vullen', fillHour: '{h}:00–{h2}:00 op alle dagen vullen'
                },
                kpi: {
                    heat: 'Warmte', cool: 'Koude', humid: 'Bevochtiging', fans: 'Ventilatoren', cost: 'Kosten', hours: 'Bedrijfsuren',
                    gas: '{v} m³ gas', elec: '{v} kWh elektrisch', gj: '{v} GJ', water: '{v} m³ water', peak: 'piek {v} kW',
                    costSub: 'per jaar, excl. btw', hoursSub: '{v} uur met bezetting', fansSub: 'gemiddeld {v} kW'
                },
                warn: {
                    unmetTLow: '{n} bedrijfsuren met te koude toevoerlucht (capaciteit of samenstelling).',
                    unmetTHigh: '{n} bedrijfsuren met te warme toevoerlucht.',
                    unmetXLow: '{n} bedrijfsuren onder x_min.', unmetXHigh: '{n} bedrijfsuren boven x_max.',
                    capped: '{name}: {n} uur op capaciteit.', frost: 'WTW: {n} uur vorstbeveiliging actief.',
                    none: 'De toevoerlucht haalt de eisen in alle bedrijfsuren.'
                },
                chart: {
                    title: 'Energie per maand', thermal: 'Thermisch (kWh)', cost: 'Kosten (€)',
                    months: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
                    monthsLong: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
                    total: 'Totaal'
                },
                series: { heat: 'Verwarming', cool: 'Koeling', humid: 'Bevochtiging', fans: 'Ventilatoren' },
                tab: { months: 'Per maand', comps: 'Per component', duration: 'Belastingduurkromme', compare: 'Vergelijk LBK’s', method: 'Methode' },
                col: {
                    month: 'Maand', heat: 'Warmte', cool: 'Koude', coolLat: 'w.v. latent', humidKg: 'Bevochtiging', steam: 'Stoom', fans: 'Ventilatoren',
                    rec: 'WTW warmte', recCool: 'WTW koude', hours: 'Uren', unmet: 'Uren tekort', cost: 'Kosten', unit: 'LBK', comp: 'Component',
                    pos: 'Toegevoerd', neg: 'Onttrokken', water: 'Water', elec: 'Elektrisch', peak: 'Piek', capped: 'Uren op cap.'
                },
                duration: { title: 'Belastingduurkromme: uurvermogen gesorteerd van hoog naar laag', x: 'uren per jaar', y: 'vermogen [kW]', heat: 'Verwarming', cool: 'Koeling' },
                compare: {
                    run: 'Alle LBK’s doorrekenen', busy: 'Rekenen…',
                    note: 'Zelfde weekpatroon, klimaatjaar en tarieven; per LBK de eigen samenstelling, bedrijfsvoering en opwekking.'
                },
                computing: 'Rekenen…',
                method: {
                    h1: 'Uur voor uur', p1: 'Elk uur van het klimaatjaar (8760 uur, MET zonder zomertijd) wordt de LBK doorgerekend met de buitentemperatuur en het vochtgehalte van dat uur. Het weekpatroon bepaalt de bezetting en daarmee het debiet; uren met 0 % volgen de instelling “buiten kantooruren”. Het jaar loopt van 1 januari en begint op de echte weekdag (referentiejaren: maandag).',
                    h2: 'Regeling per component', p2: 'WTW moduleert tot het setpoint met vorstbeveiliging op de droge afvoertemperatuur; mengkamer vast of regelend; verwarmer naar het toevoer-setpoint minus de ventilatoropwarming erna; koeler met bypassfactor en apparaatdauwpunt, ontvochtigt tot x_max; bevochtiger tot x_min; ventilatoren P = q_v·Δp/η·(q/q_n)^n. Bestaande LBK: vermogens begrensd op de capaciteit, tekorten tellen als uren tekort.',
                    h3: 'Eindenergie en kosten', p3: 'Warmte: HR-ketel m³ = Q / (η · 9,77 kWh/m³, bovenwaarde), warmtepomp kWh = Q / SCOP, stadsverwarming GJ = Q · 0,0036 / η. Koude: kWh = Q / SEER. Stoom: (h_stoom − h_water) per kg / η. Water: stoom + adiabatisch + indirect adiabatisch. Kosten zonder btw en vastrecht.',
                    h4: 'Niet in dit model', p4: 'Opwarm- en afkoeltijd van het gebouw, ruimtebelastingen (de retourlucht is een opgegeven toestand), regeltechnische schommelingen, filtervervuiling over het jaar, feestdagen en zomertijd. Bedoeld voor vergelijking van varianten en een orde van grootte van het verbruik.'
                },
                csvName: 'energie'
            }
        },
        help: {
            lbk: 'LBK samenstellen',
            lbk1: 'Kies Bestaande LBK (capaciteiten invullen en scenario’s testen) of Nieuw ontwerp (de tool berekent de benodigde vermogens).',
            lbk2: 'Leg het debiet en de eisen aan de toevoerlucht vast en voeg componenten toe in luchtrichting; met de pijltjes verander je de volgorde.',
            lbk3: 'Het schema, het Mollier-diagram en de tabellen tonen elke toestand bij winter- en zomerontwerpcondities, met adviezen als de eisen niet worden gehaald.',
            lbk4: 'Meerdere LBK’s per project: dupliceer een LBK om varianten te vergelijken. “Open in Processen” zet de procesketen als scenario’s in het diagram.',
            energy: 'Energieverbruik',
            en1: 'Alleen beschikbaar als er een LBK is samengesteld; kies welke LBK je doorrekent.',
            en2: 'Schilder het weekpatroon (7 × 24 uurblokken, standaard werkdagen 8–17 uur met 80 %) en kies wat de LBK buiten kantooruren doet.',
            en3: 'Kies een klimaatjaar (KNMI De Bilt): resultaten per maand voor verwarming, koeling, bevochtiging en ventilatoren, met eindenergie, kosten en uren met tekort.'
        }
    });

    I.extend('en', {
        lbk: {
            empty: {
                title: 'Assemble an air handling unit',
                text: 'Build the AHU step by step in airflow order: outdoor air → filter → heat recovery → coils → humidifier → fan → supply. Each component is controlled to meet the supply-air requirements and the result is shown in a schematic, the Mollier chart and tables. Then simulate a whole year in the Energy use tab.',
                existing: 'Analyse an existing AHU', existingSub: 'Components with their capacity: test scenarios and see whether the requirements are met.',
                design: 'Design a new AHU', designSub: 'Start from the supply-air requirements: the tool calculates the required capacities.',
                example: 'Or start with an example AHU'
            },
            panel: {
                units: 'AHUs', flow: '1 · Airflow', req: '2 · Supply-air requirements', comps: '3 · Components — supply side',
                ret: '4 · Return and exhaust side', design: 'Design conditions'
            },
            unit: {
                add: 'New', addExisting: 'Existing AHU', addDesign: 'New design', name: 'AHU name', color: 'Colour',
                dup: 'Duplicate', del: 'Delete', confirmDel: 'Delete AHU "{name}"?', newName: 'AHU {n}',
                copy: '{name} (copy)', max: 'At most {n} AHUs per project.'
            },
            mode: {
                existing: 'Existing AHU', design: 'New design',
                hintExisting: 'Enter the capacity of each component (0 = unlimited). Outputs are capped at it; the tool shows whether the requirements are met.',
                hintDesign: 'Capacities are unlimited: the tool calculates what each component must deliver at the design conditions.'
            },
            f: {
                flow: 'Supply airflow', retFlow: 'Return airflow', supMode: 'Supply temperature',
                t: 'Supply temperature', tWin: 'Supply winter', tSum: 'Supply summer', tOutWin: 'Winter at T_out ≤', tOutSum: 'Summer at T_out ≥',
                xMinOn: 'Humidify to at least', xMaxOn: 'Dehumidify to at most', xMin: 'x_min supply', xMax: 'x_max supply',
                retTWin: 'Return winter', retTSum: 'Return summer', dx: 'Room moisture gain Δx', dT: 'Outdoor temperature', dRh: 'Outdoor RH'
            },
            o: { supMode: { const: 'Fixed', comp: 'Compensated' } },
            flowHint: 'ṁ = {m} kg/s dry air (ρ = 1.2 kg/m³) · return {r} m³/h',
            rhHint: '≈ {rh} % RH at {t} °C',
            compHint: 'Winter → summer linearly between both outdoor temperatures; the return temperature follows the same transition.',
            retHead: 'Return air from the room',
            retHint: 'x_return = x_supply + Δx while occupied.',
            designHint: 'Dutch practice: winter −10 °C / 90 %, summer 28 °C / 50 %. Full occupancy and 100 % airflow.',
            comp: {
                filter: 'Filter', hr: 'Heat recovery', mix: 'Mixing box', heater: 'Heater', cooler: 'Cooler', humid: 'Humidifier',
                fan: 'Fan', silencer: 'Silencer'
            },
            name: {
                hr: { plate: 'Plate exchanger', runaround: 'Run-around coils', wheel: 'Thermal wheel', sorption: 'Sorption wheel' },
                heater: { pre: 'Preheater', main: 'Heater', reheat: 'Reheater' },
                humid: { steam: 'Steam humidifier', adiabatic: 'Adiabatic humidifier' },
                fan: { sup: 'Supply fan', ret: 'Return fan' },
                mix: { fixed: 'Mixing box', econ: 'Mixing box (modulating)' },
                filter: { sup: 'Filter', ret: 'Return filter' },
                silencer: { sup: 'Silencer', ret: 'Silencer' }
            },
            hint: {
                filter: 'Pressure drop only (average of initial and final resistance). Adds to the fan power.',
                hr: 'Modulates (bypass/speed) to the set point and backs off when the exhaust air would drop below the frost limit (dry exhaust temperature). In summer it recovers cold when it is warmer outside than the return air.',
                mix: 'Recirculation of return air ahead of the heat recovery. Modulating: more recirculation when heating or cooling is needed, 100 % outdoor air when that helps.',
                heater: 'Heats to the supply set point minus the fan heat downstream, or to a fixed set point (preheater). Ahead of an adiabatic humidifier it also supplies the heat of evaporation.',
                cooler: 'Bypass-factor model: the outlet lies on the straight line inlet → apparatus dew point (ADP). Cools to the set point and dehumidifies to x_max if needed; a reheater downstream brings the air back to temperature.',
                humid: 'Humidifies to x_min. Steam: Δh/Δx = steam enthalpy (100 °C). Adiabatic: along the wet bulb, limited by the efficiency; the heater upstream supplies the heat.',
                fan: 'P = q_v · Δp / η · (q/q_n)^n. The internal resistance of all components on this side is included; all electrical energy ends up as heat in the air.',
                silencer: 'Pressure drop only.'
            },
            fc: {
                dp: 'Pressure drop', kind: 'Type', eta: 'Temperature efficiency', etaX: 'Moisture efficiency', frost: 'Exhaust frost limit',
                iec: 'Indirect evaporative cooling (exhaust side)', iecEta: 'Exhaust humidifier efficiency', ctrl: 'Control', share: 'Recirculation',
                shareMax: 'Max. recirculation', role: 'Function', tSet: 'Set point', qMax: 'Capacity', bf: 'Bypass factor', adpMin: 'Min. ADP (chilled water)',
                dehum: 'Dehumidify to x_max', cap: 'Capacity', dpExt: 'External pressure', n: 'Part-load exponent n', pos: 'Position', etaAdia: 'Efficiency'
            },
            tip: {
                dp: 'Pressure drop across the component at design airflow.', eta: 'Supply-side temperature efficiency at balanced flows (EN 308).',
                etaX: 'Moisture efficiency: share of the humidity-ratio difference that is transferred.',
                frost: 'If the dry exhaust temperature would be lower, the heat recovery backs off (plate exchanger typically 0…+3 °C; wheels and run-around hardly at all).',
                iec: 'Humidify the exhaust air ahead of the heat recovery in summer; the colder exhaust cools the supply air through the exchanger (no moisture added to the supply).',
                share: 'Share of return air in the supply flow. Modulating: this is the maximum (minimum outdoor air = 100 % − this).',
                qMax: 'Maximum coil output. 0 = unlimited.', cap: 'Maximum humidifier capacity. 0 = unlimited.',
                bf: 'Share of air that “misses” the fins (typically 0.05–0.15). Lower = deeper cooling at the same ADP.',
                adpMin: 'Lowest surface temperature the cooler reaches: ≈ chilled water temperature + 1 K (6/12 °C → about 7 °C). Limits dehumidification.',
                n: 'P ∝ (q/q_n)^n at part load: 2 with duct pressure control, 3 without (affinity law).',
                pos: 'Before the heat recovery: the fan heat returns to the supply through the exchanger. After it: that heat is exhausted.',
                tSet: 'Fixed set point, e.g. 5 °C as frost protection for the coils downstream.'
            },
            o2: {
                kind: { plate: 'Plate exchanger', runaround: 'Run-around', wheel: 'Thermal wheel', sorption: 'Sorption wheel (enthalpy)', steam: 'Steam', adiabatic: 'Adiabatic' },
                ctrl: { fixed: 'Fixed share', econ: 'Modulating' },
                role: { main: 'To supply temperature', pre: 'Fixed set point (preheater)' },
                pos: { after: 'After heat recovery', before: 'Before heat recovery' }
            },
            zeroIsFree: '0 = unlimited',
            act: { up: 'Move up', down: 'Move down', toggle: 'On/off', dup: 'Duplicate', del: 'Delete', edit: 'Edit' },
            add: 'Add in airflow order', addRet: 'Add to the return side',
            single: 'An AHU can have only one {name}.', maxComps: 'At most {n} components.',
            propose: 'Proposal from the requirements', proposeConfirm: 'Replace the current components with a proposal?',
            proposed: 'Proposal assembled — feel free to adjust it.',
            compsEmpty: 'No components yet. Start at the outdoor air and add them in airflow order, for example filter → heat recovery → cooler → heater → fan.',
            retEmpty: 'Nothing on the return side yet. A return fan is needed for heat recovery and mixing; its power counts in the energy use.',
            kpi: {
                heat: 'Heating', cool: 'Cooling', humid: 'Humidification', fans: 'Fans', hr: 'Heat recovery', supply: 'Supply air',
                need: 'required', cap: 'capacity {v}', lat: 'of which latent {v} kW', steam: 'steam {v} kW', water: 'water, adiabatic',
                sfp: 'SFP supply {v} · SFP{c}', hrWin: 'winter · η {eta} %', hrFrost: 'winter · η {eta} % (frost protection)',
                ok: 'requirements met', nok: 'requirements not met', summer: 'summer {v}'
            },
            cond: { win: 'Winter', sum: 'Summer', label: '{name} {t} °C / {rh} %' },
            schema: {
                title: 'AHU schematic', out: 'Outdoor air', sup: 'Supply', ret: 'Return', exh: 'Exhaust',
                hint: 'Click a component to edit it. Values at the design condition selected top right.',
                recirc: 'recirculation {v} %'
            },
            chart: { title: 'Mollier chart · design conditions', toProc: 'Open in Processes', toProcDone: 'Scenarios “{a}” and “{b}” are now in the Processes view.', hover: 'Move over the chart or a point to read the air state.' },
            tab: { states: 'States', comps: 'Components & outputs', csv: 'CSV' },
            col: { point: 'Point', where: 'Position', comp: 'Component', q: 'Q', water: 'Water', status: 'Status', cap: 'Capacity', need: 'Required', dp: 'Δp', elec: 'P_el' },
            st: { ok: 'OK', capped: 'at capacity', frost: 'frost protection', off: 'switched off', idle: 'idle' },
            row: { out: 'Outdoor air', after: 'after {name}', ret: 'Return air', exh: 'Exhaust air', sup: 'Supply' },
            fix: 'Fix capacities (+10 %)', fixTitle: 'Take the required outputs (+10 % margin) as capacities and continue as an existing AHU.',
            fixed: 'Capacities fixed; the AHU is now analysed as an existing unit.',
            toEnergy: 'Calculate energy use',
            w: {
                empty: 'Add components on the left to build the AHU.',
                noFan: 'There is no supply fan: without a fan nothing flows.',
                hrNoRet: 'Heat recovery needs a return airflow.',
                noRetFan: 'No return fan: the return airflow is assumed, but its energy is not counted.',
                noReheat: 'The cooler dehumidifies but there is no heater after it: the supply air will be too cold.',
                humidIdle: 'There is a humidifier, but humidification is switched off in the requirements (step 2).',
                steamBeforeHeater: 'The steam humidifier is upstream of the heater: cold air takes up little moisture (max. 95 % RH).',
                adiaNoHeater: 'An adiabatic humidifier needs a heater upstream to supply the heat of evaporation.',
                coolNoDehum: 'Dehumidification is off in the requirements: the cooler only cools to the temperature set point.',
                tLow: '{cond}: supply air {v} K too cold.', noHeater: '{cond}: supply air {v} K too cold — add a heater.',
                tHigh: '{cond}: supply air {v} K too warm.', noCooler: '{cond}: supply air {v} K too warm — there is no cooler.',
                xLow: '{cond}: humidity ratio {v} g/kg too low.', noHumid: '{cond}: humidity ratio {v} g/kg too low — there is no humidifier.',
                xHigh: '{cond}: humidity ratio {v} g/kg too high.', noDehum: '{cond}: humidity ratio {v} g/kg too high — dehumidification needs a cooler.',
                frost: '{cond}: heat recovery frost protection active, efficiency reduced to {v} %.',
                ok: 'The supply air meets the requirements at both design conditions.',
                capped: ' At capacity: {names}.'
            },
            en: {
                locked: 'Build an AHU in the AHU builder tab first; then calculate its annual energy use here.', lockedBtn: 'Go to AHU builder',
                panel: { unit: 'AHU', ops: 'Operation', climate: 'Climate year', gen: 'Generation', tariffs: 'Tariffs (project)' },
                edit: 'Edit', unitSum: '{mode} · {flow} m³/h · {n} components',
                f: {
                    control: 'Airflow control', minFlow: 'Min. airflow', off: 'Outside office hours', offFlow: 'Airflow', ecoT: 'Min. supply temperature',
                    nightFlow: 'Airflow', nightTMin: 'Not below T_out', nightTrig: 'After a day with T_max ≥',
                    climate: 'Climate year', heat: 'Heat generation', etaHeat: 'Efficiency (gross CV)', etaDistrict: 'Distribution efficiency',
                    etaElec: 'Efficiency', scop: 'SCOP', seer: 'Chiller SEER', steam: 'Steam humidifier', etaSteam: 'Steam generation efficiency',
                    elec: 'Electricity', gas: 'Natural gas', heatT: 'Heat', water: 'Water'
                },
                o: {
                    control: { vav: 'Follows occupancy', cav: 'Constant' },
                    off: { off: 'AHU off', vent: 'Base ventilation, fully treated', eco: 'Base ventilation, frost-free only', night: 'Summer night ventilation' },
                    heat: { boiler: 'Condensing boiler (gas)', hp: 'Heat pump', district: 'District heating', elec: 'Electric' },
                    steam: { elec: 'Electric', gas: 'Gas-fired' }
                },
                controlHint: {
                    vav: 'During operating hours: airflow = max(min. airflow, occupancy). Fan power ∝ airflow^n.',
                    cav: 'In every hour with occupancy > 0 the AHU runs at 100 % airflow.'
                },
                offHint: {
                    off: 'Hours with 0 % occupancy: fans off, no treatment, no energy.',
                    vent: 'Hours with 0 % occupancy: reduced airflow with the same supply-air requirements (no room moisture gain).',
                    eco: 'Hours with 0 % occupancy: reduced airflow, heat recovery active, heating only to the minimum temperature; no cooling or humidification.',
                    night: 'After a warm day, ventilate at night with cool outdoor air (heat recovery bypassed, no treatment). Only the fan energy is counted; the cooling effect on the building is outside this model.'
                },
                climate: {
                    groupRef: 'Reference years (reconstruction of NEN 5060:2018)', groupKnmi: 'Actual years KNMI De Bilt (temperature only)',
                    energie: 'Energy year — long-term average (annual use)', T5: 'Design year T5 — average winter', T1: 'Design year T1 — severe winter',
                    winter1979: 'Stress test severe winter 1978/79 (≈ once in 25 years)', winter1963: 'Stress test extreme winter 1962/63 (≈ once a century)',
                    year: '{y}', yearRec: '{y} — stress test', loadKnmi: 'Load actual years (2.3 MB)…',
                    loading: 'Loading climate data…', loadFail: 'Climate data could not be loaded.',
                    note: 'Reconstruction based on KNMI De Bilt; not official NEN 5060 data.',
                    stats: 'T mean {tg} °C · T min {tmin} °C · coldest week {kw} °C · {gd} degree days (18 °C)',
                    approx: 'Actual year: only temperature was measured. Humidity is approximated from the energy year, so latent cooling and humidification are indicative.',
                    advice: 'Energy year for annual consumption; T1 and the stress-test winters to see how often the AHU falls short.'
                },
                sched: {
                    title: 'Weekly pattern — occupancy per hour',
                    hint: 'Click or drag over the hour blocks to paint the selected occupancy. Day and hour headers fill a whole day or the same hour on all days. Blocks at 0 % count as outside office hours.',
                    brush: 'Occupancy', custom: 'Custom value', presets: 'Quick fill',
                    preset: { office: 'Office 8–17 · 80 %', long: 'Long hours 7–19 · 100 %', always: '24/7 · 100 %', clear: 'Clear all' },
                    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                    summary: '{h} operating hours per week · mean occupancy {m} % · {y} operating hours in this climate year',
                    cell: '{day} {h}:00–{h2}:00 · {v} %', fillDay: 'Fill all of {day}', fillHour: 'Fill {h}:00–{h2}:00 on all days'
                },
                kpi: {
                    heat: 'Heat', cool: 'Cooling', humid: 'Humidification', fans: 'Fans', cost: 'Cost', hours: 'Operating hours',
                    gas: '{v} m³ gas', elec: '{v} kWh electric', gj: '{v} GJ', water: '{v} m³ water', peak: 'peak {v} kW',
                    costSub: 'per year, excl. VAT', hoursSub: '{v} occupied hours', fansSub: 'mean {v} kW'
                },
                warn: {
                    unmetTLow: '{n} operating hours with supply air too cold (capacity or composition).',
                    unmetTHigh: '{n} operating hours with supply air too warm.',
                    unmetXLow: '{n} operating hours below x_min.', unmetXHigh: '{n} operating hours above x_max.',
                    capped: '{name}: {n} hours at capacity.', frost: 'Heat recovery: {n} hours with frost protection active.',
                    none: 'The supply air meets the requirements in every operating hour.'
                },
                chart: {
                    title: 'Energy per month', thermal: 'Thermal (kWh)', cost: 'Cost (€)',
                    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                    total: 'Total'
                },
                series: { heat: 'Heating', cool: 'Cooling', humid: 'Humidification', fans: 'Fans' },
                tab: { months: 'Per month', comps: 'Per component', duration: 'Load duration curve', compare: 'Compare AHUs', method: 'Method' },
                col: {
                    month: 'Month', heat: 'Heat', cool: 'Cooling', coolLat: 'of which latent', humidKg: 'Humidification', steam: 'Steam', fans: 'Fans',
                    rec: 'HR heat', recCool: 'HR cold', hours: 'Hours', unmet: 'Hours short', cost: 'Cost', unit: 'AHU', comp: 'Component',
                    pos: 'Added', neg: 'Removed', water: 'Water', elec: 'Electric', peak: 'Peak', capped: 'Hours at cap.'
                },
                duration: { title: 'Load duration curve: hourly output sorted from high to low', x: 'hours per year', y: 'output [kW]', heat: 'Heating', cool: 'Cooling' },
                compare: {
                    run: 'Calculate all AHUs', busy: 'Calculating…',
                    note: 'Same weekly pattern, climate year and tariffs; each AHU with its own composition, operation and generation.'
                },
                computing: 'Calculating…',
                method: {
                    h1: 'Hour by hour', p1: 'Every hour of the climate year (8760 hours, CET without daylight saving) the AHU is simulated with that hour’s outdoor temperature and humidity ratio. The weekly pattern sets the occupancy and hence the airflow; hours at 0 % follow the “outside office hours” setting. The year starts on 1 January on its actual weekday (reference years: Monday).',
                    h2: 'Control per component', p2: 'Heat recovery modulates to the set point with frost protection on the dry exhaust temperature; mixing box fixed or modulating; heater to the supply set point minus the downstream fan heat; cooler with bypass factor and apparatus dew point, dehumidifies to x_max; humidifier to x_min; fans P = q_v·Δp/η·(q/q_n)^n. Existing AHU: outputs capped at capacity, shortfalls count as hours short.',
                    h3: 'Final energy and cost', p3: 'Heat: boiler m³ = Q / (η · 9.77 kWh/m³, gross CV), heat pump kWh = Q / SCOP, district heating GJ = Q · 0.0036 / η. Cooling: kWh = Q / SEER. Steam: (h_steam − h_water) per kg / η. Water: steam + adiabatic + indirect evaporative. Costs exclude VAT and standing charges.',
                    h4: 'Not in this model', p4: 'Building warm-up and cool-down, room loads (the return air is a given state), control fluctuations, filter fouling over the year, public holidays and daylight saving. Intended for comparing variants and an order of magnitude of the consumption.'
                },
                csvName: 'energy'
            }
        },
        help: {
            lbk: 'AHU builder',
            lbk1: 'Choose Existing AHU (enter capacities and test scenarios) or New design (the tool calculates the required capacities).',
            lbk2: 'Set the airflow and supply-air requirements and add components in airflow order; use the arrows to change the order.',
            lbk3: 'The schematic, Mollier chart and tables show every state at the winter and summer design conditions, with advice when requirements are not met.',
            lbk4: 'Several AHUs per project: duplicate one to compare variants. “Open in Processes” puts the process chain on the chart as scenarios.',
            energy: 'Energy use',
            en1: 'Only available once an AHU has been built; choose which AHU to simulate.',
            en2: 'Paint the weekly pattern (7 × 24 hour blocks, default weekdays 8–17 at 80 %) and choose what the AHU does outside office hours.',
            en3: 'Choose a climate year (KNMI De Bilt): monthly results for heating, cooling, humidification and fans, with final energy, cost and hours short.'
        }
    });
})(typeof self !== 'undefined' ? self : this);
