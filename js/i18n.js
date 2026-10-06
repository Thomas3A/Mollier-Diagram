/**
 * i18n.js — teksten Nederlands (standaard) en Engels.
 * Sleutels met punten; {naam} wordt vervangen door variabelen.
 */
(function (root) {
    'use strict';

    const nl = {
        app: {
            title: 'Mollier h,x-diagram',
            subtitle: 'Luchtbehandeling · processen · belastingen',
            footer: 'Berekeningen volgens ASHRAE Handbook – Fundamentals 2017 (Hyland-Wexler), gevalideerd tegen PsychroLib. Bedoeld als engineering-hulpmiddel; controleer kritische ontwerpen.'
        },
        tb: {
            undo: 'Ongedaan maken (Ctrl+Z)', redo: 'Opnieuw (Ctrl+Y)', file: 'Bestand', share: 'Delen',
            theme: 'Licht/donker', help: 'Help en sneltoetsen', lang: 'Switch to English', projectName: 'Projectnaam'
        },
        menu: {
            new: 'Nieuw project', example: 'Voorbeeldproject laden', open: 'Project openen (.json)…', save: 'Project opslaan (.json)',
            png: 'Diagram als PNG', svg: 'Diagram als SVG (vector)', csv: 'Tabellen als CSV (Excel)', print: 'Afdrukken / PDF'
        },
        chartType: { mollier: 'Mollier h,x', psychro: 'Psychrometrisch' },
        panel: {
            system: 'Systeem', scenarios: 'Scenario\'s', start: 'Beginpunt & luchtdebiet',
            add: 'Processtap toevoegen', edit: 'Processtap bewerken', steps: 'Processtappen'
        },
        sys: {
            pressureBy: 'Luchtdruk via', altitude: 'Hoogte', pressure: 'Druk', altitudeUnit: 'm',
            result: 'p = {p} kPa', resultAlt: 'p = {p} kPa · hoogte {z} m'
        },
        scn: {
            add: 'Nieuw', name: 'Naam', color: 'Kleur', visible: 'Tonen in diagram', duplicate: 'Dupliceren',
            delete: 'Verwijderen', confirmDelete: 'Scenario "{name}" verwijderen?', newName: 'Scenario {n}',
            copy: '{name} (kopie)', lastOne: 'Er moet minimaal één scenario blijven.'
        },
        start: {
            pair: 'Invoer met', flow: 'Luchtdebiet', flowVolume: 'm³/h', flowMass: 'kg/h droge lucht',
            mdot: 'ṁ = {m} kg/s droge lucht · V = {v} m³/h bij het beginpunt', noFlow: 'Geen debiet: vermogens en waterdebieten worden niet berekend.'
        },
        q: {
            t: 'Temperatuur', rh: 'Relatieve vochtigheid', x: 'Vochtgehalte', h: 'Enthalpie',
            twb: 'Natteboltemperatuur', tdp: 'Dauwpunt'
        },
        qs: { t: 't', rh: 'RH', x: 'x', h: 'h', twb: 't_nat', tdp: 't_dauw' },
        cat: {
            heat: 'Verwarmen', cool: 'Koelen', humidify: 'Bevochtigen', dehumidify: 'Ontvochtigen',
            mix: 'Mengen', hr: 'WTW', ewf: 'EWF-cascade', other: 'Overig'
        },
        type: {
            cascade: 'Klimaatcascade (Earth, Wind & Fire)',
            heat: 'Verwarmer (x constant)',
            cool: 'Koeler — ideaal (dauwpuntknik)',
            coil: 'Koelbatterij — ADP en bypassfactor',
            cooldehum: 'Koelen & ontvochtigen naar t / RH',
            adiabatic: 'Adiabatische bevochtiger (verdamping)',
            steam: 'Stoombevochtiger',
            spray: 'Waterverneveling (watertemperatuur)',
            dehum: 'Isotherm ontvochtigen',
            desiccant: 'Sorptiewiel (h constant)',
            mix: 'Mengen met tweede luchtstroom',
            hr: 'Warmteterugwinning',
            load: 'Ruimtebelasting (warmte + vocht)',
            fan: 'Ventilator (opwarming)',
            point: 'Vrij punt'
        },
        typeHint: {
            cascade: 'Water van ≈ 13 °C wordt bovenin een schacht versproeid; de vallende druppels koelen/drogen (zomer) of verwarmen/bevochtigen (winter) de lucht en leveren hydraulische trek. Celmodel volgens Bronsema (2013) h3; het pad volgt het berekende profiel.',
            heat: 'Voelbare verwarming: x blijft gelijk, lijn loodrecht omhoog in het Mollier-diagram.',
            cool: 'Ideale koeling: bij constante x tot het dauwpunt, daarna langs de verzadigingslijn (condensatie).',
            coil: 'Uittrede ligt op de rechte lijn naar het apparaatdauwpunt (ADP). BF = aandeel lucht dat de batterij „mist”. Valt die lijn in het mistgebied, dan slaan de druppels neer als condensaat en treedt de lucht verzadigd uit.',
            cooldehum: 'Rechte proceslijn naar het opgegeven eindpunt; het bijbehorende ADP en de BF worden afgeleid.',
            adiabatic: 'Verdampingsbevochtiging langs de natteboltemperatuurlijn (≈ h constant). 100 % = verzadigd.',
            steam: 'Stoombevochtiging: richting Δh/Δx = h van de stoom; t stijgt licht.',
            spray: 'Water verstuiven met een gegeven watertemperatuur: Δh/Δx = c_w · t_water.',
            dehum: 'Geïdealiseerde ontvochtiging bij constante temperatuur.',
            desiccant: 'Sorptieve ontvochtiging: h blijft (nagenoeg) gelijk, t stijgt.',
            mix: 'Adiabatisch mengen: massa- en energiebalans op droge lucht. Het mengpunt ligt op de rechte lijn tussen beide stromen.',
            hr: 'Gebalanceerde warmteterugwinning met retourlucht. Rendementen volgens EN 308.',
            load: 'Warmte- en vochtlast van een ruimte op de luchtstroom (Randmaatstaf Δh/Δx).',
            fan: 'Al het ventilatorvermogen wordt warmte in de luchtstroom: Δh = v · Δp / η.',
            point: 'Willekeurig punt; lijn als rechte in het h,x-vlak.'
        },
        mode: {
            toT: 'Naar temperatuur', dT: 'Met temperatuurverschil', power: 'Met vermogen', toH: 'Naar enthalpie',
            toRH: 'Naar relatieve vochtigheid', toX: 'Naar vochtgehalte', dX: 'Met Δx', flow: 'Met waterdebiet',
            eff: 'Met bevochtigingsrendement', bf: 'Met bypassfactor'
        },
        val: {
            toT: 'Doeltemperatuur', dT: 'Temperatuurverschil ΔT', power: 'Vermogen', toH: 'Doelenthalpie',
            toRH: 'Doel-RH', toX: 'Doel-vochtgehalte', dX: 'Toename Δx', flow: 'Waterdebiet',
            eff: 'Bevochtigingsrendement η', bf: 'Bypassfactor BF'
        },
        valBy: {
            'coil.toT': 'Uittredetemperatuur', 'dehum.dX': 'Afname Δx', 'desiccant.dX': 'Afname Δx',
            'dehum.flow': 'Afgevoerd water', 'steam.flow': 'Stoomdebiet', 'cool.power': 'Koelvermogen', 'heat.power': 'Verwarmingsvermogen'
        },
        field: {
            mode: 'Methode', tAdp: 'Batterij-oppervlaktetemperatuur (ADP)', t: 'Temperatuur', rh: 'Relatieve vochtigheid',
            tSteam: 'Stoomtemperatuur', tWater: 'Watertemperatuur', t2: 'Temperatuur stroom 2', hum: 'Vocht stroom 2 via',
            b2: 'Vocht stroom 2', flowMode: 'Hoeveelheid stroom 2', flow2: 'Hoeveelheid', hrType: 'Type wisselaar',
            eff: 'Temperatuurrendement η_t', effX: 'Vochtrendement η_x', tRet: 'Retourlucht temperatuur',
            rhRet: 'Retourlucht RH', qs: 'Voelbare warmte Q_s', mw: 'Vochtproductie', dp: 'Drukverhoging Δp',
            pair: 'Invoer met', a: 'Waarde 1', b: 'Waarde 2', label: 'Eigen naam (optioneel)'
        },
        fieldBy: { 'cascade.H': 'Actieve hoogte cascade', 'cascade.w': 'Luchtsnelheid', 'cascade.rwl': 'Water/lucht RW/L', 'cascade.tW': 'Watertemperatuur sproeiers', 'cascade.spray': 'Sproeispectrum', 'cascade.w0': 'Beginsnelheid druppels', 'fan.eff': 'Totaalrendement ventilator', 'mix.flow2.fraction': 'Aandeel stroom 2 in mengsel', 'mix.flow2.volume': 'Volumestroom stroom 2', 'mix.flow2.mass': 'Massastroom stroom 2 (droge lucht)' },
        opt: {
            fulljet: 'Fulljet 3/4GG-3050 (testopstelling)', s1: 'Spectrum 1 (d30 4,01 mm)', s2: 'Spectrum 2 (d30 3,61 mm)', s3: 'Spectrum 3 (d30 3,21 mm)', s4: 'Spectrum 4 (d30 2,81 mm)', s5: 'Spectrum 5 (d30 2,41 mm)', s6: 'Spectrum 6 (d30 2,01 mm)', s7: 'Spectrum 7 (d30 1,61 mm)', s8: 'Spectrum 8 (d30 1,20 mm)', s9: 'Spectrum 9 (d30 0,80 mm)', s10: 'Spectrum 10 (d30 0,40 mm)',
            rh: 'Relatieve vochtigheid', x: 'Vochtgehalte', fraction: 'Aandeel in mengsel (%)', volume: 'Volumestroom (m³/h)',
            mass: 'Massastroom (kg/h)', sensible: 'Platenwisselaar / twin-coil (sensibel)', enthalpy: 'Enthalpiewiel (warmte + vocht)'
        },
        form: {
            add: 'Toevoegen', update: 'Bijwerken', cancel: 'Annuleren', process: 'Proces',
            result: 'Resultaat', needStart: 'Stel eerst een geldig beginpunt in.'
        },
        steps: {
            empty: 'Nog geen processtappen. Kies hierboven een proces en klik op Toevoegen — of dubbelklik in het diagram.',
            up: 'Omhoog', down: 'Omlaag', toggle: 'Aan/uit', delete: 'Verwijderen', edit: 'Bewerken', duplicate: 'Dupliceren',
            disabled: 'uitgeschakeld', blocked: 'geblokkeerd door ongeldig beginpunt', of: '{n} stappen'
        },
        desc: {
            cascade: 'Klimaatcascade H {h} m · RW/L {rwl} · water {tw} °C',
            'heat.toT': 'Verwarmen naar {v} °C', 'heat.dT': 'Verwarmen +{v} K', 'heat.power': 'Verwarmen {v} kW',
            'heat.toH': 'Verwarmen naar {v} kJ/kg', 'heat.toRH': 'Verwarmen naar {v} % RH',
            'cool.toT': 'Koelen naar {v} °C', 'cool.dT': 'Koelen −{v} K', 'cool.power': 'Koelen {v} kW', 'cool.toRH': 'Koelen naar {v} % RH',
            'coil.bf': 'Koelbatterij ADP {tAdp} °C · BF {v}', 'coil.toT': 'Koelbatterij ADP {tAdp} °C → {v} °C',
            cooldehum: 'Koelen & ontvochtigen → {t} °C / {rh} %',
            'adiabatic.eff': 'Adiabatisch bevochtigen η {v} %', 'adiabatic.toRH': 'Adiabatisch bevochtigen → {v} % RH',
            'adiabatic.toX': 'Adiabatisch bevochtigen → {v} g/kg', 'adiabatic.toT': 'Adiabatisch bevochtigen → {v} °C',
            'steam.toRH': 'Stoom → {v} % RH', 'steam.toX': 'Stoom → {v} g/kg', 'steam.dX': 'Stoom +{v} g/kg', 'steam.flow': 'Stoom {v} kg/h',
            'spray.toRH': 'Verneveling → {v} % RH', 'spray.toX': 'Verneveling → {v} g/kg', 'spray.dX': 'Verneveling +{v} g/kg', 'spray.flow': 'Verneveling {v} kg/h',
            'dehum.toRH': 'Ontvochtigen → {v} % RH', 'dehum.toX': 'Ontvochtigen → {v} g/kg', 'dehum.dX': 'Ontvochtigen −{v} g/kg', 'dehum.flow': 'Ontvochtigen {v} kg/h',
            'desiccant.toRH': 'Sorptiewiel → {v} % RH', 'desiccant.toX': 'Sorptiewiel → {v} g/kg', 'desiccant.dX': 'Sorptiewiel −{v} g/kg',
            'mix.fraction': 'Mengen met {t2} °C / {b2} ({flow2} %)', 'mix.volume': 'Mengen met {t2} °C / {b2} ({flow2} m³/h)', 'mix.mass': 'Mengen met {t2} °C / {b2} ({flow2} kg/h)',
            'hr.sensible': 'WTW sensibel η {eff} %', 'hr.enthalpy': 'Enthalpiewiel η {eff} / {effX} %',
            load: 'Ruimtebelasting {qs} kW + {mw} kg/h', fan: 'Ventilator {dp} Pa · η {eff} %', point: 'Vrij punt {a} / {b}'
        },
        info: {
            bf: 'BF {bf} · ADP {adp} °C', dry: 'droge batterij (geen condensatie)', eff: 'η {eff} %', share: 'aandeel {share} %',
            gamma: 'Δh/Δx {g} kJ/kg', power: 'energie {p} kW', cascade: 't_w,uit {tw} °C · Δp_hydr {dp} Pa'
        },
        kpi: {
            heating: 'Verwarmen', cooling: 'Koelen', recovered: 'WTW', humid: 'Bevochtigen',
            dehum: 'Ontvochtigen', final: 'Eindpunt', fan: 'incl. ventilator {v} kW', none: '—'
        },
        tbl: {
            states: 'Toestanden', steps: 'Processen', csv: 'CSV', point: 'Punt', step: 'Stap', process: 'Proces',
            V: 'V m³/h', water: 'Water kg/h', shr: 'SHR', gamma: 'Δh/Δx', emptyStates: 'Geen geldige toestanden.',
            emptySteps: 'Nog geen processtappen.', fog: 'mist', skipped: 'uitgeschakeld'
        },
        chart: {
            layers: 'Lagen', range: 'Bereik', zoomIn: 'Inzoomen (+)', zoomOut: 'Uitzoomen (−)', fit: 'Passend maken (F)',
            reset: 'Volledig diagram (0)', wheelHint: 'Houd Ctrl (⌘) ingedrukt en scroll om te zoomen',
            hint: 'Dubbelklik: punt toevoegen · Sleep punt 1 om het beginpunt te verplaatsen · Ctrl + scroll: zoomen · slepen: verschuiven',
            title: '{type} · p = {p} kPa', statusIdle: 'Beweeg over het diagram om de luchttoestand af te lezen.',
            cursor: 'Cursor', point: 'Punt {n}', fog: 'mistgebied', dragging: 'verslepen…',
            axisX: 'Vochtgehalte x [g/kg]', axisT: 'Temperatuur t [°C]', axisPw: 'p_w [hPa]', axisH: 'h [kJ/kg]',
            axisTPsy: 'Droge-boltemperatuur t [°C]', axisXPsy: 'Vochtgehalte x [g/kg]', comfort: 'Comfort',
            fogLabel: 'mistgebied', edge: 'Randmaatstaf Δh/Δx [kJ/kg]',
            aux: { adp: 'ADP', stream2: 'L2', return: 'RL', wb: '' }
        },
        layer: {
            iso: 'Isothermen', rh: 'RH-lijnen φ', h: 'Isenthalpen h', wb: 'Natteboltemp.', rhoM: 'Dichtheid ρ', rhoP: 'Spec. volume v',
            fog: 'Mistgebied', comfort: 'Comfortzone', edge: 'Randmaatstaf', pw: 'Dampspanning', values: 'Waarden bij punten'
        },
        range: {
            title: 'Diagrambereik', tMin: 't min [°C]', tMax: 't max [°C]', xMax: 'x max [g/kg]', presets: 'Voorinstellingen',
            standard: 'Standaard', hvac: 'Klimaat', winter: 'Winter', hot: 'Hoge temp.', comfortTitle: 'Comfortzone',
            ctMin: 't min', ctMax: 't max', crhMin: 'RH min', crhMax: 'RH max', cxMax: 'x max [g/kg]', apply: 'Toepassen'
        },
        toast: {
            saved: 'Project opgeslagen als bestand.', opened: 'Project geopend: {name}', openFail: 'Kon het bestand niet lezen.',
            linkCopied: 'Deel-link gekopieerd naar het klembord.', linkShow: 'Kopieer deze link:', shared: 'Gedeeld project geladen.',
            migrated: 'Project uit de vorige versie overgenomen.', newProject: 'Nieuw project gestart.', example: 'Voorbeeldproject geladen.',
            undo: 'Ongedaan gemaakt', redo: 'Opnieuw uitgevoerd', stepAdded: 'Stap toegevoegd.', stepUpdated: 'Stap bijgewerkt.',
            pointAdded: 'Vrij punt toegevoegd op {t} °C / {x} g/kg.', startSet: 'Beginpunt ingesteld.', exportFail: 'Exporteren mislukt.',
            eggOn: 'Hej! MÖLLIER is in elkaar gezet — er zijn geen schroefjes over.', eggOff: 'Weer terug in de standaardstijl.'
        },
        confirm: { newProject: 'Nieuw leeg project starten? (Ongedaan maken blijft mogelijk.)' },
        example: {
            name: 'Voorbeeld luchtbehandelingskast', winter: 'Winter', summer: 'Zomer', newName: 'Nieuw project'
        },
        err: {
            ERR_CASCADE_H: 'Hoogte cascade moet tussen 0,5 en 200 m liggen.', ERR_CASCADE_RWL: 'RW/L moet tussen 0 en 5 liggen.',
            ERR_INVALID: 'Ongeldige of ontbrekende invoer.',
            ERR_OUT_OF_RANGE: 'Buiten het geldigheidsgebied (−100…200 °C).',
            ERR_T_RANGE: 'Temperatuur buiten −100…200 °C.',
            ERR_X_NEGATIVE: 'Vochtgehalte kan niet negatief worden.',
            ERR_X_POSITIVE: 'Vochtgehalte moet groter dan 0 zijn.',
            ERR_RH_RANGE: 'RH moet tussen 0 en 100 % liggen.',
            ERR_BOILING: 'Dampspanning hoger dan de luchtdruk (kookgebied).',
            ERR_TWB_ABOVE_T: 'Natteboltemperatuur kan niet hoger zijn dan de droge-boltemperatuur.',
            ERR_TWB_TOO_LOW: 'Natteboltemperatuur te laag voor deze temperatuur.',
            ERR_TDP_ABOVE_T: 'Dauwpunt kan niet hoger zijn dan de temperatuur.',
            ERR_H_TOO_LOW: 'Enthalpie te laag voor deze temperatuur.',
            ERR_SUPERSAT: 'Deze combinatie ligt in het mistgebied; gebruik t + x.',
            ERR_NO_SOLUTION: 'Geen oplossing gevonden — controleer de invoer.',
            ERR_UNKNOWN_PAIR: 'Onbekend invoerpaar.',
            ERR_VAPOUR_PRESSURE: 'Ongeldige dampspanning.',
            ERR_UNKNOWN_TYPE: 'Onbekend procestype.',
            ERR_NEED_FLOW: 'Hiervoor is een luchtdebiet nodig.',
            ERR_POSITIVE: 'Waarde moet groter dan 0 zijn.',
            ERR_HEAT_TARGET: 'Doel moet hoger liggen dan de huidige toestand.',
            ERR_HEAT_RH: 'Verwarmen verlaagt de RH: doel moet lager zijn dan de huidige RH.',
            ERR_COOL_TARGET: 'Eindtemperatuur moet lager zijn dan de huidige temperatuur.',
            ERR_COOL_RH: 'Doel-RH moet hoger zijn dan de huidige RH en maximaal 100 %.',
            ERR_ADP_HIGH: 'ADP moet lager zijn dan de intredetemperatuur.',
            ERR_COIL_T: 'Uittredetemperatuur moet tussen ADP en intredetemperatuur liggen.',
            ERR_BF_RANGE: 'Bypassfactor moet tussen 0 en 1 liggen.',
            ERR_DEHUM_X: 'Het vochtgehalte moet dalen.',
            ERR_ALREADY_SAT: 'Lucht is al verzadigd.',
            ERR_EFF_RANGE: 'Rendement moet tussen 0 en 100 % liggen.',
            ERR_ADIA_X: 'Doel-x moet tussen huidige x en {max} g/kg (verzadiging) liggen.',
            ERR_ADIA_T: 'Doeltemperatuur moet tussen de natteboltemperatuur ({min} °C) en de huidige temperatuur liggen.',
            ERR_HUMID_RH: 'Doel-RH moet hoger zijn dan de huidige RH en maximaal 100 %.',
            ERR_HUMID_X: 'Doel-x moet hoger zijn dan de huidige x.',
            ERR_DEHUM_RH: 'Doel-RH moet lager zijn dan de huidige RH.',
            ERR_STEAM_T: 'Stoomtemperatuur moet tussen 0 en 200 °C liggen.',
            ERR_WATER_T: 'Watertemperatuur moet tussen 0 en 100 °C liggen.',
            ERR_FRACTION: 'Aandeel moet tussen 0 en 100 % liggen.',
            ERR_LOAD: 'Geef een warmte- en/of vochtlast op.',
            generic: 'Berekening mislukt.'
        },
        help: {
            title: 'Help & sneltoetsen', close: 'Sluiten',
            intro: 'Kies een beginpunt, voeg processtappen toe en lees toestanden, vermogens en waterdebieten direct af. Alles wordt automatisch opgeslagen in deze browser.',
            mouse: 'Muis en touch',
            m1: 'Beweeg over het diagram: statusbalk toont t, x, RH, h, t_nat, t_dauw, ρ en p_w, met hulplijnen door de cursor.',
            m2: 'Dubbelklik: nieuw vrij punt (of beginpunt als het scenario nog leeg is).',
            m3: 'Sleep punt 1 (beginpunt), vrije punten, mengstroom L2 of retourlucht RL om ze te verplaatsen.',
            m4: 'Ctrl/⌘ + scroll of knijpen: zoomen · slepen op de achtergrond (touch: met twee vingers): verschuiven · tikken: aflezen.',
            m5: 'Klik op een proceslijn of stap om die te bewerken; klik op een punt om het in de tabel te markeren.',
            keys: 'Sneltoetsen',
            k1: 'Ctrl+Z / Ctrl+Y — ongedaan maken / opnieuw', k2: 'M — wissel Mollier / psychrometrisch',
            k3: '+ / − / 0 / F — zoomen, volledig, passend', k4: 'Delete — geselecteerde stap verwijderen', k5: 'Esc — bewerken annuleren / selectie wissen',
            method: 'Rekenmethode',
            me1: 'Verzadigingsdampdruk boven water en ijs volgens Hyland-Wexler (ASHRAE 2017, eq. 5–6); natteboltemperatuur eq. 33/35; dichtheid en specifiek volume eq. 26–28.',
            me2: 'Het Mollier-diagram gebruikt de klassieke scheve coördinaten: verticaal (h − 2501·x)/1,006, zodat isothermen licht waaieren en isenthalpen recht zijn. In het mistgebied knikken de isothermen.',
            me3: 'Vermogens: Q = ṁ_L · Δh, met ṁ_L de droge-luchtmassastroom (volumestroom gedeeld door het specifiek volume in het beginpunt). Bij koelen met condensatie gaat de enthalpie van het condensaat eraf: Q = ṁ_L · [Δh − Δx · c_w · t₂]. Q_s = ṁ_L · (1,006 + 1,86·x₁) · Δt, Q_l = Q − Q_s.',
            ewf: 'Earth, Wind & Fire',
            ewf1: 'E — wissel tussen Mollier-diagram en Earth, Wind & Fire. Ctrl+Z/Y en ? werken in beide weergaven.',
            ewf2: 'Kies links een weersituatie, "Weer van nu in De Bilt" of voer zelf in; alle gebouw- en systeemparameters zijn aanpasbaar en worden direct doorgerekend.',
            ewf3: 'Beweeg of tik op een onderdeel van de doorsnede voor de waarden; klik om het bijbehorende invoerpaneel te openen.',
            ewf4: 'Momentopname bij constant debiet: per verdieping smoren (overschot) of hulpventilator (tekort). Toevoer en afvoer worden apart in balans gebracht (neutrale zone).',
            ewf5: 'Model volgens Bronsema (2013), Earth, Wind & Fire – Natuurlijke Airconditioning (TU Delft); zie tabblad Methode & bronnen.'
        },
        view: { label: 'Weergave', mollier: 'Mollier-diagram', ewf: 'Earth, Wind & Fire' },
        ewf: {
            title: 'Earth, Wind & Fire', subtitle: 'Natuurlijke airconditioning · Bronsema 2013',
            assume: 'aanname', src: 'Bron', range: 'zinvol bereik', def: 'standaard',
            reset: 'Standaard', resetTitle: 'Standaardwaarden van dit paneel herstellen', resetAll: 'Alles standaard',
            resetAllTitle: 'Alle invoer (gebouw en weer) terugzetten naar het standaardkantoor', resetDone: 'Standaardwaarden hersteld',
            mode: { cool: 'koelen', heat: 'verwarmen', off: 'cascade uit (A1)' },
            modeLong: { cool: 'Koelbedrijf', heat: 'Verwarmen/bevochtigen', off: 'Variant A1: cascade uit' },
            panel: {
                weather: 'Weer', building: 'Gebouw', vent: 'Ventilatie', cascade: 'Klimaatcascade', ventec: 'Ventecdak',
                chimney: 'Zonneschoorsteen', exhaust: 'Afvoer & drukverlies', advanced: 'Geavanceerd'
            },
            f: {
                floors: 'Aantal verdiepingen', hFloor: 'Verdiepingshoogte', avoFloor: 'AVO per verdieping', bvoFactor: 'BVO/AVO',
                occDensity: 'Bezettingsdichtheid', presence: 'Aanwezigheid', qInt: 'Interne warmtelast', moistPerson: 'Vochtproductie',
                tRoomSummer: 'Ruimtetemperatuur zomer', tRoomWinter: 'Ruimtetemperatuur winter', rhRoomMax: 'Max. RV ruimte',
                xRoomMax: 'Max. vochtgehalte ruimte',
                ventMethod: 'Methode', ventCat: 'Categorie', emission: 'Emissieklasse gebouw', qManual: 'Ventilatiedebiet',
                tSupCool: 'Toevoertemperatuur koelen', tSupHeat: 'Toevoertemperatuur verwarmen',
                wCascade: 'Luchtsnelheid cascade', spray: 'Sproeispectrum', d30: 'd30 (volumegemiddeld)', d32: 'd32 (Sauter)',
                w0: 'Beginsnelheid druppels', rwlMode: 'Regeling water/lucht (RW/L)', rwlMin: 'RW/L minimum', rwlMax: 'RW/L maximum',
                rwlWinter: 'RW/L verwarmen (vorstbeveiliging)', rwlManual: 'RW/L', tWCool: 'Watertemperatuur koelen',
                tWHeat: 'Watertemperatuur verwarmen', tWFrost: 'Watertemperatuur bij vorst', tFrostLimit: 'Vorstgrens buitenlucht',
                variantA1: 'Variant A1: cascade uit in het tussenseizoen', tA1Min: 'A1 vanaf buitentemperatuur',
                terrain: 'Terreinklasse', roofExtra: 'Dakopbouw boven bovenste vloer', cpIn: 'Cp inlaat', cTop: 'Hoogte bovenkanaal c',
                uEjDesign: 'Ontwerpsnelheid ejector',
                chimType: 'Type', chimAz: 'Oriëntatie (0 = zuid, −90 = oost)', chimB: 'Breedte B', chimD: 'Diepte D', glass: 'Glas',
                glassG: 'g-waarde', glassU: 'U-waarde glas', chimR: 'Netto/bruto glas R', epsAbs: 'Emissiecoëfficiënt absorber',
                uWall: 'U binnenwand', f1: 'Absorptie binnenruit f1', f2: 'Absorptie absorber f2', cwc: 'Gedwongen convectie (CWC)',
                dpSupDesign: 'Δp toevoersysteem (ontwerp)', dpExhExt: 'Δp extern afzuig (roosters, atrium)', wShunt: 'Luchtsnelheid shunt',
                zetaU: 'ζ U-bocht', roughness: 'Wandruwheid schachten', dpFiwihex: 'Δp FiWiHEx', fiwiEff: 'Rendement FiWiHEx',
                fiwiTWater: 'Watertemperatuur FiWiHEx',
                nCells: 'Cellen cascade', pNozzle: 'Voordruk sproeiers', pipeR: 'Leidingweerstand', dpLocal: 'Lokale weerstanden',
                etaPump: 'Pomprendement', dpSource: 'Δp bronsysteem', etaFanV: 'Ventilatorrendement', etaFanM: 'Motorrendement',
                dtStrat: 'ΔT stratificatie afzuiglucht',
                t: 'Buitentemperatuur', rh: 'Relatieve vochtigheid', p: 'Luchtdruk', U10: 'Windsnelheid U10', dir: 'Windrichting',
                ghi: 'Globale straling (horizontaal)', facade: 'Straling op de gevel', time: 'Datum en tijd (lokaal)',
                facadeManual: 'Straling op de gevel handmatig (zonder invalshoekcorrectie)'
            },
            opt: {
                ventMethod: { nen: 'NEN-EN 16798-1', manual: 'Handmatig debiet' },
                ventCat: { I: 'Categorie I', II: 'Categorie II', III: 'Categorie III' },
                emission: { verylow: 'Zeer laag-emitterend', low: 'Laag-emitterend', non: 'Niet laag-emitterend' },
                spray: { fulljet: 'Fulljet 3/4GG-3050 (testopstelling)', s: 'Spectrum {n} (d30 {d30} mm)', custom: 'Eigen d30/d32' },
                rwlMode: { auto: 'Automatisch (koelen) / vast (verwarmen)', manual: 'Handmatig' },
                terrain: { 4: '4 · ruwweg open (z0 0,1 m)', 5: '5 · ruw (z0 0,25 m)', 6: '6 · zeer ruw (z0 0,5 m; d 10 m)', 7: '7 · gesloten (z0 1,0 m; d 10 m)', 8: '8 · stadskern (z0 2,0 m; d 15 m)' },
                cTop: { 1: '1 m (formule 2.3.1)', 2: '2 m (formule 2.3.2)' },
                chimType: { chimney: 'Zonneschoorsteen', facade: 'Zonnefaçade' },
                glass: { ps: 'Planitherm Solar (g 0,75; U 1,10)', pt: 'Planitherm Total low-E (g 0,70; U 1,32)', clear: 'Blank dubbel glas (g 0,70; U 3,00)', custom: 'Eigen waarden' }
            },
            hint: {
                building: 'H = {H} m · AVO {avo} m² · BVO {bvo} m² · {n} personen',
                vent: 'q_v = {q} m³/h ({qa} dm³/s·m²) · ṁ = {m} kg/s · doorsnede cascade {s} × {s} m',
                bbl: 'Bbl: {qp} dm³/s per persoon (min. 6,5)',
                cascade: 'd30/d32 {d30}/{d32} mm · RW/L {rwl} → {qw} m³/h water · verblijftijd druppels {tres} s',
                ventec: 'z_dak {z} m · U_ref {u} m/s · q_dyn {q} Pa · A_ej {a} m²',
                chimney: 'w = {w} m/s · D_h {dh} m · Φ gevel {phi} W/m² ({method})',
                exhaust: 'Verliezen afvoer (vl. 1): {sum} Pa · shunt {sh} m × {sh} m',
                advanced: 'Opvoerhoogte sproeipomp {h} m · η_vent {eta}',
                weather: 'x {x} g/kg · dauwpunt {tdp} °C · h {h} kJ/kg · Beaufort {bft} ({bftName})',
                sun: 'Zon: hoogte {alt}°, azimut {az}° · Φ gevel = {beam} direct + {diff} diffuus W/m² (θ {th}°)',
                sunManual: 'Zon: hoogte {alt}°, azimut {az}° · vaste gevelstraling {phi} W/m² (conventie proefschrift)',
                method: { manual: 'handmatig', gti: 'GTI Open-Meteo', model: 'Erbs + Hay-Davies' }
            },
            bft: ['windstil', 'zwak', 'zwak', 'matig', 'matig', 'vrij krachtig', 'krachtig', 'hard', 'stormachtig', 'storm', 'zware storm', 'zeer zware storm', 'orkaan'],
            weather: {
                source: 'Bron', srcPreset: 'Weersituatie', srcLive: 'Nu in De Bilt', srcManual: 'Handmatig', preset: 'Weersituatie',
                live: 'Weer van nu in De Bilt', liveAt: 'Weer van nu', loading: 'Ophalen…', station: 'Locatie',
                attribution: 'Weergegevens: Open-Meteo.com (CC BY 4.0), model KNMI HARMONIE-AROME — modelwaarde, geen meting',
                stamp: 'KNMI HARMONIE-AROME via Open-Meteo · {time} (15-min gemiddelde)',
                stampPreset: 'Weersituatie: {name}', stampManual: 'Handmatige invoer',
                fail: 'Weer ophalen mislukt — vorige waarden behouden', offline: 'Geen internetverbinding — vorige waarden behouden',
                cached: 'Weer uit de cache (minder dan 10 minuten oud)', ok: 'Weer opgehaald: {t} °C, {rh} %, {u} m/s'
            },
            preset: {
                ontwerp_zomer: { name: 'Ontwerp zomer 28 °C / 55 %', info: 'Ontwerpconditie klimaatcascade (§3.1.7.2, case D1); ontwerpwind Ventecdak 3,5 m/s (§2.5.4); referentiestraling gevel 400 W/m² (§4.2.3).' },
                gem_zomer: { name: 'Gemiddelde zomerdag 20 °C / 80 %', info: 'Case D2/B2 (§3.5.3); referentieconditie zonneschoorsteen (§4.2.3).' },
                hitte_2019: { name: 'Hittegolf 25-07-2019', info: 'KNMI De Bilt, uur 14 (13–14 UT): 37,1 °C, 29 %, GHI 728 W/m². Dagmaximum De Bilt 37,5 °C.' },
                benauwd_2020: { name: 'Benauwde zomerdag 12-08-2020', info: 'KNMI De Bilt, uur 13: 31,3 °C, 44 % (x ≈ 12,6 g/kg: hoge latente last), GHI 706 W/m².' },
                voorjaar_2023: { name: 'Zonnige voorjaarsdag 15-03-2023', info: 'KNMI De Bilt, uur 12: 8,1 °C, 51 %, GHI 617 W/m².' },
                tussen: { name: 'Tussenseizoen 10 °C / 99 %', info: 'Meting B4 (§3.4.5). Gevelstraling 150 W/m² is een aanname.' },
                gem_winter: { name: 'Gemiddelde winterdag 5 °C / 90 %', info: 'Case D3. Wind 4 m/s en gevelstraling 80 W/m² zijn aannames.' },
                zon_winter: { name: 'Zonnige winterdag (testdag 15-12-2009)', info: 'Testdag zonneschoorsteen (§4.4.5.2): 0,55 °C, gevel 730 W/m². RV en wind zijn aannames.' },
                koude_2021: { name: 'Koude-inval 13-02-2021', info: 'KNMI De Bilt, uur 9: −7,0 °C, 75 %, GHI 217 W/m².' },
                ontwerp_winter: { name: 'Ontwerp winter −10 °C / 90 %', info: 'Case D4; basis-ontwerpbuitentemperatuur −10 °C (ISSO 51/53/57). Wind 5 m/s is een aanname.' },
                storm_2022: { name: 'Storm Eunice 18-02-2022', info: 'KNMI De Bilt, uur 15: 11,0 °C, 56 %, 13 m/s (windstoten 27 m/s), GHI 175 W/m².' },
                windstil: { name: 'Windstil, bewolkt 20 °C', info: 'Toont de werking van de hulpventilatoren. Wind 0,8 m/s en gevelstraling 120 W/m² zijn aannames.' }
            },
            kpi: {
                supply: 'Toevoer', supplySub: 'uit cascade · toevoer {t} °C',
                cascade: 'Cascade', cascadeSub: 'RW/L {rwl} · {qw} m³/h · Δp {dp} Pa',
                supplyP: 'Drukbalans toevoer', exhaustP: 'Drukbalans afvoer',
                throttle: 'smoren {min}–{max} Pa', fan: 'hulpventilator {pa} Pa · {kw} kW',
                chimney: 'Zonneschoorsteen', chimneySub: '{q} kW · η {eta} · trek {dp} Pa', open: 'open', closed: 'dicht (kantelpunt)',
                power: 'Elektrisch', powerSub: 'pompen {pump} · vent. {fan} kW · COP {cop}',
                room: 'Ruimte', roomSub: '{x} g/kg · {t} °C', comfortOk: 'comfort ok', comfortBad: 'te vochtig'
            },
            warnHead: 'Meldingen', why: 'waarom?', noWarn: 'Geen meldingen.',
            warn: {
                inputRange: '{field}: {value} ligt buiten het zinvolle bereik {min}–{max}.',
                inputClamped: '{field}: {value} is niet realistisch; gerekend met {lim}.',
                setpointUnreachable: 'Toevoertemperatuur {t} °C niet haalbaar: RW/L op het maximum ({rwl}).',
                rwlMin: 'RW/L op het minimum ({rwl}): de lucht wordt kouder dan het setpoint en wordt naverwarmd.',
                iceLikely: 'IJsvorming waarschijnlijk: vorst en RW/L {rwl} < 0,5 (§3.4.8).',
                freezeTop: 'Bevriezingsrisico bovenin: laagste watertemperatuur {t} °C.',
                legionella: 'Watertemperatuur {t} °C > 20 °C: legionella-risico; de cascade is alleen intrinsiek veilig bij lage watertemperatuur (§3.6.3).',
                aerosols: 'd32 = {d} mm < 0,5 mm: risico op meevoeren van aerosolen (§3.2.14).',
                rhOutLow: 'RV uit de cascade {rh} % (< 90 %) — ter informatie.',
                roomHumid: 'RV ruimte {rh} % / x {x} g/kg boven de comfortgrens ({rhMax} % / {xMax} g/kg): de cascade droogt beperkt (§3.4.10.4).',
                condensWinter: 'RV ruimte {rh} % bij vorst: condensrisico op koude oppervlakken (§3.5.6.3).',
                glassHot: 'Glastemperatuur {t} °C > 80 °C: gehard glas of bypass-beveiliging nodig (§4.1.4).',
                chimneyClosed: 'Zonneschoorsteen dicht (kantelpunt §4.5.6.8): verlies ({q} kW) groter dan opbrengst; afzuigen via de shunt.',
                ejectorRange: 'U_ej/U_ref = {ratio} buiten het geldigheidsgebied 0,1–0,8; gerekend met {lim}.',
                ejectorPositive: 'Ejector met c = 1 m geeft overdruk (Cp = {cp}): werkt tegen.',
                noWind: 'Vrijwel geen wind: de ejector levert geen onderdruk.',
                windProfile: 'Dakhoogte {z} m < d + 5 m ({d} + 5): logaritmisch windprofiel onbetrouwbaar.',
                bblFlow: 'Debiet {q} dm³/s per persoon < {min} (Bbl art. 4.122).',
                balance: 'Energiebalans cascade wijkt {err} % af (> 0,1 %).',
                cascadeOff: 'Variant A1: cascade uit — geen behandeling en geen hydraulische trek.'
            },
            tab: {
                profile: 'Cascadeprofiel', pressure: 'Drukbalans', chimney: 'Zonneschoorsteen', mollier: 'Mollier', energy: 'Energie',
                floors: 'Per verdieping', all: 'Alle weersituaties', method: 'Methode & bronnen'
            },
            tbl: {
                floor: 'Verd.', z: 'z', tSup: 't_toe', supMargin: 'Marge toevoer', supAction: 'Toevoer', exhMargin: 'Marge afvoer',
                exhAction: 'Afvoer', throttle: 'smoren', deficit: 'tekort', csv: 'CSV'
            },
            energy: {
                item: 'Post', cascade: 'Klimaatcascade (+ verwarmen / − koelen)', reheat: 'Naverwarming', chimney: 'Zonnewarmte zonneschoorsteen',
                fiwihex: 'FiWiHEx-opbrengst (incl. ruimtewarmte)', spray: 'Sproeipomp', source: 'Bronpomp (WKO)', fanSupply: 'Hulpventilator toevoer',
                fanExhaust: 'Hulpventilator afvoer', refFan: 'Referentie: ventilatoren conventionele LBK (2,64 kW per m³/s)',
                refCool: 'Referentie: koelmachine conventionele LBK (COP 3)', losses: 'verliezen',
                note: 'Thermisch: + = warmte naar de lucht/het water, − = koeling. Elektrisch vermogen van pompen en ventilatoren. Referentie volgens de case study (§7.5.2).'
            },
            sch: {
                title: 'Schematische doorsnede', pause: 'Animatie pauzeren', play: 'Animatie afspelen',
                desc: 'Doorsnede van het Earth, Wind & Fire-gebouw. Buitenlucht {t} °C; na de klimaatcascade {tc} °C; toevoer {ts} °C; top zonneschoorsteen {tz} °C. Kleinste drukmarge toevoer {sup} Pa, afvoer {exh} Pa.',
                note: 'De klimaatcascade is ter wille van de duidelijkheid aan de gevel getekend; in werkelijkheid zit hij meestal inpandig. Schachtbreedtes op schaal (met een minimum), verdiepingshoogte boven 12 lagen gecomprimeerd.',
                source: 'Eigen schema naar de opbouw van Bronsema (2013) fig. 1.3/1',
                scale: 'Temperatuur lucht [°C]',
                bFanSup: 'Hulpventilator toevoer {w} W', bThrSup: 'Toevoer: smoren ≥ {pa} Pa', bFanExh: 'Hulpventilator afvoer {w} W',
                bThrExh: 'Afvoer: smoren ≥ {pa} Pa', bFreeze: 'Bevriezingsrisico', bRh: 'RV ruimte {rh} %',
                kc: 'Klimaatcascade', ts: 'Toevoerschacht', sh: 'Shuntkanaal', zs: 'Zonneschoorsteen / -façade', sun: 'Zon', ventec: 'Ventecdak (bovendak)',
                abKC: 'KC', abTS: 'TS', abSH: 'SH', abZS: 'ZS',
                c1: 'Overdrukruimte', c2: 'Verblijfsruimten', c3: 'Shuntkanaal', c4: 'FiWiHEx-installatie', c5: 'Hulpventilator(en)',
                c5s: 'Hulpventilator toevoer', c5e: 'Hulpventilator afvoer', c6: 'Venturi-ejector', c7: 'Recirculatieklep', c8: 'Warmteopslag (WKO)', c9: 'Technische ruimte',
                floorN: 'Verdieping {k}', floorShort: 'vl. {k}', floorTip: 'Verdieping {k}',
                lOut: 'Buiten {t} °C · {rh} % · U10 {u} m/s', lUref: 'U_ref {u} m/s', lOver: 'p_over +{p} Pa', lEj: 'p_ej {p} Pa',
                lSpray: 't_w {tw} °C · RW/L {rwl}', lFoot: '{t} °C · {rh} %', lFoot2: 't_w {tw} °C · Δp {dp} Pa', lRoom: 'ruimte {t} °C · {rh} %',
                lZs: 'top {t} °C · {q} kW', lZsClosed: 'dicht · {q} kW', lFiwi: 'FiWiHEx {q} kW', lPhi: 'Φ {phi} W/m²', lCold: 'koude bron · {q} kW koeling', lColdHeat: 'bron · {q} kW verwarming',
                lWarm: 'warme bron · {q} kW',
                refKC: '3.2.4/4, 3.2.6/1, 3.2.15/3–6', tIn: 'Intrede', tOutC: 'Uittrede', water: 'Water', dpHydr: 'Hydraulische trek', dpTh: 'Thermische trek',
                dpAero: 'Aerodyn. trek (info)', size: 'Doorsnede', tSup: 'Toevoer', reheat: 'Naverwarming', pFoot: 'Druk voet cascade', fanSup: 'Hulpventilator',
                tExh: 'Afzuiglucht', shuntTop: 'Shuntkolom bovenste verd.', state: 'Status', tAir: 'Lucht', draft: 'Thermische trek', glassMax: 'Glas max.',
                wallMax: 'Wand max.', dirInfo: 'Windrichting (info)', recircInfo: 'Buiten bedrijfstijd: recirculatie via de shunt (warmte-oogst zonder ventilatie). In deze momentopname dicht.',
                head: 'Opvoerhoogte', coldWell: 'Cascade ↔ bron', warmWell: 'Zonnewarmte → warme bron', alt: 'Zonnehoogte', az: 'Azimut (0 = zuid)', room: 'Ruimte'
            },
            ch: {
                profileTitle: 'Verloop in de klimaatcascade (sproeiers bovenin)', profileSrc: 'Model: Bronsema 2013 §3.2 (celmodel, formules 3.2.4/4, 3.2.6/1, 3.2.7/1); Ranz & Marshall 1952; Schiller & Naumann 1933.',
                pTemp: 'Temperatuur [°C]', pX: 'x [g/kg]', pRh: 'RV [%]', tWater: 't water', tAir: 't lucht', height: 'Hoogte [m]', spray: 'sproeiers ▾', wd: 'Druppelsnelheid',
                chimTitle: 'Temperaturen in de zonneschoorsteen ({state})', chimSrc: 'Model: Bronsema 2013 §4.2.5 (driekennodenmodel), 4.2.6/1; Churchill & Usagi 1972.',
                chimSummary: 'Q_zs {q} kW · η {eta} · trek {dp} Pa · glas max. {gl} °C · wand max. {wl} °C · Φ gevel {phi} W/m²',
                tGlass: 'θ glas', tWall: 'θ absorberwand', limit80: '80 °C (ongehard glas)', lGlass: 'glas', lAir: 'lucht', lWall: 'wand', temp: 'Temperatuur [°C]',
                pressTitle: 'Drukmarge per verdieping (+ smoren, − hulpventilator nodig)', pressSrc: 'Model: Bronsema 2013 §3.5.5 (toevoer), §4.2.7 en §4.5.5 (afvoer); neutrale zone §3.5.5.2. Klik op een verdieping voor de opbouw.',
                throttle: 'overschot (smoren)', deficit: 'tekort (hulpventilator)', supply: 'Toevoer', exhaust: 'Afvoer',
                thermTitle: 'Thermisch [kW]', elecTitle: 'Elektrisch [kW]', cooling: 'koelen', heating: 'verwarmen / warmte-oogst',
                ewf: 'EWF', conv: 'conventionele LBK (case study)', energySrc: 'Pompen: Bronsema 2013 §3.5.4; ventilatoren 4.5.11/1; referentie §7.5.2 (SFP 2,64 kW per m³/s, koelmachine COP 3).',
                e_cascade: 'Klimaatcascade', e_reheat: 'Naverwarming', e_chimney: 'Zonneschoorsteen', e_fiwihex: 'FiWiHEx',
                e_pumps: 'Pompen / koelmachine', e_fans: 'Ventilatoren', e_total: 'Totaal'
            },
            bu: {
                term: 'Opbouw', pOver: 'Overdruk Ventecdak', dpHydr: 'Hydraulische trek cascade', dpThKc: 'Thermische trek cascade', dpShaft: 'Kolom toevoerschacht',
                lossSup: 'Drukverlies toevoersysteem', sumSup: 'Marge toevoer', dpThZs: 'Thermische trek zonneschoorsteen', shuntCol: 'Kolom shuntkanaal',
                pEj: 'Onderdruk ejector (−p_ej)', lExt: 'Roosters / overstroom', lShunt: 'Wrijving shunt', lU: 'U-bocht', lChim: 'Wrijving schoorsteen',
                lFiwi: 'FiWiHEx', lDyn: 'Uitstroomverlies', sumExh: 'Marge afvoer',
                hint: 'Toevoer = p_over + Δp_hydr + Δp_th,kc − schachtkolom − verliezen; afvoer = Δp_th,zs + shuntkolom − p_ej − verliezen. Positief = smoren, negatief = hulpventilator.'
            },
            all: {
                intro: 'Alle weersituaties doorgerekend op het huidige gebouw. Klik op een kolomkop om te sorteren en op een rij om die weersituatie te laden.',
                note: 'Q in kW (+ verwarmen, − koelen); marges = kleinste over alle verdiepingen (+ smoren, − hulpventilator); P_pomp = sproei- + bronpomp; * = zonneschoorsteen dicht (kantelpunt).',
                progress: 'Berekenen… {n}/{m}', load: 'Klik om deze weersituatie te laden', loaded: 'Weersituatie geladen: {name}',
                c: {
                    name: 'Weersituatie', mode: 'Modus', rwl: 'RW/L', tCascadeOut: 't uit cascade', rhCascadeOut: 'RV uit', Qcascade: 'Q cascade',
                    Qreheat: 'Q naverw.', rhRoom: 'RV ruimte', phiFacade: 'Φ gevel', tChimneyOut: 't_zs', Qchimney: 'Q_zs', dpChimney: 'trek zs',
                    pOver: 'p_over', pEj: 'p_ej', minSupply: 'min. marge toevoer', minExhaust: 'min. marge afvoer', Pfan: 'P_vent', Ppump: 'P_pomp',
                    COP: 'COP', warn: '⚠'
                }
            },
            mo: {
                title: 'Procesketen in het h,x-diagram', open: 'Open in Mollier-diagram', opened: 'Scenario "{name}" bijgewerkt in het Mollier-diagram',
                legend: '1 buitenlucht · 2 uit cascade · 3 toevoer (na naverwarming) · 4 ruimte/afzuig · 5 top zonneschoorsteen · 6 na FiWiHEx',
                note: 'Het traject 1→2 volgt het berekende cascadeprofiel (gekromd); het proefschrift tekent dit gemakshalve recht (§3.1.7.6).',
                reheat: 'Naverwarming', fiwi: 'FiWiHEx', live: 'Weer van nu', manual: 'Handmatig weer', hover: 'Beweeg over het diagram om af te lezen.',
                s1: 'Buitenlucht', s2: 'Uit de klimaatcascade', s3: 'Toevoer (na naverwarming)', s4: 'Ruimte / afzuiglucht', s5: 'Top zonneschoorsteen', s6: 'Na FiWiHEx'
            },
            m: {
                intro: 'Quasi-stationaire momentopname van het complete EWF-systeem voor één weersituatie bij constant geregeld ventilatiedebiet (§2.5.5, §3.5.5.8, §4.5.5). Per verdieping wordt bepaald of de natuurlijke drijvende krachten volstaan: een overschot wordt met kleppen weggesmoord, een tekort door een hulpventilator aangevuld. Het gebouw is een neutrale zone (§3.5.5.2), dus toevoer en afvoer worden elk afzonderlijk in drukbalans gebracht.',
                disclaimer: 'Quasi-stationair ontwerpmodel ter verkenning; geen vervanging voor CFD, windtunnelonderzoek of dynamische gebouwsimulatie. Validatie op basis van schaalproeven (Bronsema 2013).',
                sec: { model: 'Model per onderdeel', assume: 'Aannames', dev: 'Bewuste afwijkingen van het proefschrift', val: 'Validatie (live berekend)', warn: 'Meldingen: waarom?', lit: 'Bronnen', check: 'Controle huidige berekening' },
                comp: [
                    { h: 'Wind en Ventecdak (h2)', p: 'De KNMI-windsnelheid op 10 m (potentiële wind) wordt via de mesowind op 60 m met een logaritmisch profiel naar dakhoogte vertaald. De inlaat aan de loefzijde geeft overdruk, de venturi-ejector in de keel onderdruk. Zonder geleideschoepen is het Ventecdak windrichtingonafhankelijk (§2.2.4).',
                        eq: ['U_meso = U10 · ln(60/0,03) / ln(10/0,03)   (2.1.1)', 'U(z) = U_meso · ln((z − d)/z0) / ln(60/z0)   (2.5.1–2.5.3)', 'p_over = Cp_in · ½·ρ_e·U_ref², Cp_in = 0,8   (2.1.4)', 'Cp_ej = 0,2913·ln(U_ej/U_ref) + 0,0151 (c = 2 m, 2.3.2) · 0,5374·ln(·) + 0,6381 (c = 1 m, 2.3.1)'] },
                    { h: 'Klimaatcascade (h3)', p: 'Celmodel (400 cellen) van boven naar beneden: druppelsnelheid uit een impulsvergelijking met C_d(Re), warmte- en stofoverdracht volgens Ranz-Marshall op het Sauter-oppervlak, verdamping/condensatie boven vloeibaar water, mist isenthalpisch naar verzadiging. Het gewicht van het zwevende water levert de hydraulische trek. In koelbedrijf zoekt de regeling de RW/L waarbij de lucht 17 °C uittreedt; in verwarmbedrijf is RW/L 0,9 (vorstbeveiliging).',
                        eq: ['a = g·(1 − ρ_a/ρ_w) − ¾·(ρ_a/ρ_w)·C_d·w_r·|w_r|/d30   (3.2.4/4)', 'A = 6·V_water/d32   (Sauter; afwijking van 3.2.5/7)', 'h_c = (2 + 0,6·Pr^⅓·Re^½)·λ/d32   (3.2.6/1); β idem met Sc   (3.2.7/1)', 'ṁ_ev = β·A·(ρ_v,s(t_w) − ρ_v,lucht)   (3.2.2/3)', 'Δp_hydr = Σ (ṁ_w/A_c)·g·Δt   (3.2.15/3–6)'] },
                    { h: 'Drukbalans toevoer (§3.5.5)', p: 'De beschikbare druk per verdieping volgt uit de overdruk van het Ventecdak, de hydraulische en thermische trek van de cascade, de kolom van de toevoerschacht en het ontwerpdrukverlies van het verdeelsysteem. De thermische trek wordt altijd over het berekende profiel geïntegreerd (§3.3.10).',
                        eq: ['Δp_th,kc = Σ g·Δz·(ρ_profiel − ρ_e)', 'P_k = p_over + Δp_hydr + Δp_th,kc − g·z_k·(ρ_toe − ρ_e) − Δp_toe,ontwerp,  z_k = (k − ½)·h_verd'] },
                    { h: 'Ruimte', p: 'Toevoer na eventuele naverwarming (17 °C koelen, 18 °C verwarmen). De ruimte neemt vocht op (65 g/h per persoon); de ventilatielucht levert basiskoeling of -verwarming, de rest is voor de klimaatplafonds. Comfortgrens RV ≤ 60 % en x ≤ 12 g/kg (§3.1.5.5).',
                        eq: ['x_ruimte = x_toe + G_vocht/ṁ_da', 'Q_vent = ṁ_da·(c_p,da + c_p,v·x_toe)·(t_ruimte − t_toe);  Q_rest = Q_int − Q_vent'] },
                    { h: 'Zonneschoorsteen en FiWiHEx (h4)', p: 'Per segment (4 per verdieping) een energiebalans van glas, lucht en absorberwand met straling, convectie (Churchill-Usagi: vrije en gedwongen convectie) en verlies naar buiten en naar binnen. Is de opbrengst negatief, dan sluit de schoorsteen (kantelpunt §4.5.6.8) en wordt via de shunt naar het dak afgezogen. De FiWiHEx is eenvoudig gemodelleerd (aanname).',
                        eq: ['S = R·g·(Φ_beam·k(θ) + Φ_diff·0,874),  k(θ) = g(θ)/g(0)   (fig. 4.2.2)', 'h_c = [(1,5·|Δθ|^⅓)³ + (7,65·w)³]^⅓   (4.2.4/4, 4.2.4/9)', 'η = Q_zs/(R·B·H·Φ)   (4.5.6/1);  Δp_th,zs = Σ g·Δz·(ρ_e − ρ_zs)   (4.2.6/1)', 'Q_hr = ε·ṁ_da·c_p·max(0, t_top − t_w,in)'] },
                    { h: 'Drukbalans afvoer (§4.2.7, §4.5.5)', p: 'Van het rooster op verdieping k omlaag door de shunt, omhoog door de zonneschoorsteen en via FiWiHEx en ejector naar buiten. In de winter kost de shuntkolom trek, zodat de bovenste verdiepingen het minste overhouden.',
                        eq: ['A_k = Δp_th,zs + g·z_k·(ρ_ruimte − ρ_e) − p_ej − Σ verliezen   (open)', 'A_k = g·(H − z_k)·(ρ_e − ρ_ruimte) − p_ej − Σ verliezen   (dicht)', 'λ = 0,25 / [log10(ε/(3,72·D_h) + 5,74/Re^0,901)]²   (4.2.7/3)'] },
                    { h: 'Energie (§3.5.4, §4.5.11)', p: 'Hulpventilatoren gedimensioneerd op de slechtste verdieping; sproeipomp uit opvoerhoogte en waterdebiet; bronpomp uit het warmtetransport. COP alleen in koelbedrijf. Referentie: conventionele LBK volgens de case study (§7.5.2).',
                        eq: ['P_vent = q_v·(Δp_toe + Δp_af)/(0,85·0,90)   (4.5.11/1)', 'P_sproei = ρ_w·g·h_pomp·q_w/0,75   (3.5.4/1–3)', 'COP = |Q_koel| / (P_sproei + P_bron)   (3.5.4/4)'] },
                    { h: 'Zon en weer', p: 'Zonnestand volgens NOAA. Uit de globale straling schat Erbs de directe en diffuse straling; Hay-Davies transponeert die naar de gevel. "Weer van nu" komt uit het KNMI-model HARMONIE-AROME via Open-Meteo (modelwaarde, geen meting); de gevelstraling volgt dan uit DNI en GTI.',
                        eq: ['beam = DNI·cos θ + circumsolair;  diffuus = isotroop + grond (ρ_g = 0,2)', 'live: beam = DNI·cos θ,  diffuus = GTI − beam'] }
                ],
                assumeCols: ['Aanname', 'Waarde', 'Toelichting'],
                assume: [
                    ['Dakopbouw boven de bovenste vloer', '4 m', 'techniekverdieping 3,7 m (fig. 2.2.2)'],
                    ['Verplaatsingshoogte d, terreinklasse 7 / 8', '10 / 15 m', 'proefschrift geeft alleen klasse 6'],
                    ['Vorm shuntkanaal', 'vierkant, 1,0 m/s', 'D_h = zijde'],
                    ['FiWiHEx', 'ε 0,7 · t_w 20 °C · Δp 10 Pa', 'eenvoudig model (§4.5.8.2)'],
                    ['Leidinglengte sproeipomp', 'H + 10 m', '§3.5.4.2 geeft R en Δp_lokaal'],
                    ['Variant A1 (tussenseizoen)', '10 °C ≤ θ_e ≤ 17 °C', 'definitie tussenseizoen'],
                    ['Buitenluchtdichtheid', 'constant over de hoogte', 'luchtdrukgradiënt verwaarloosd'],
                    ['Wandwarmte cascade', 'verwaarloosd', 'aandeel 3–5 % (§3.5.2.3)'],
                    ['Weerpresets met *', 'wind en gevelstraling', 'zie toelichting per weersituatie']
                ],
                devCols: ['#', 'Proefschrift', 'Probleem', 'Keuze'],
                dev: [
                    ['1', 'Druppeloppervlak 3.2.5/7 ∝ d32²/d30³', 'Correct is 6V/d32; ≈ 2× te groot', 'A = 6V/d32; grove spectra (s1–s7) koelen minder dan tab. 3.5.2/1'],
                    ['2', 'Eindsnelheid 3.2.4/6', 'Strijdig met Gunn & Kinzer', 'Krachtenevenwicht met C_d(Re)'],
                    ['3', 'CWC 7,65·w én 6,5·w', 'Twee waarden', '7,65·w, gemengd met vrije convectie'],
                    ['4', 'Knoopvergelijkingen 4.2.5/13–15', 'Drukfouten, verlies binnenwand ontbreekt', 'Correcte energiebalansen'],
                    ['5', 'Aerodynamische trek 3.2.15/2', 'Niet aantoonbaar in metingen', 'Alleen informatief'],
                    ['6', 'Thermische trek met gemiddelde temperatuur', 'Profiel niet-lineair', 'Integratie over het profiel'],
                    ['7', 'Tabel 3.3.9/2', 'Volume- vs massastroom water', 'RW/L × ṁ_da'],
                    ['8', 'Case study: 200 kW koeling', 'Past niet bij Δh', 'Niet als validatie'],
                    ['9', '3.5.5/3: constante 12 120', 'Uitgaande van 3,5 m en ρ0·T0', 'Generieke hydrostatica'],
                    ['10', 'Tabel 3.1.7/3: x = 13,3 g/kg', 'Afronding', 'Altijd ASHRAE (psychro.js)'],
                    ['11', '§3.5.5.4/5: +16,3 Pa bovenin (winter)', 'Schacht gerekend t.o.v. de cascadekolom', 'Neutrale zone: schacht t.o.v. buitenlucht (+30,3 Pa)'],
                    ['P2', 'Prototype: mistcorrectie', 'Condensaat zonder energie naar het water', 'Energiebehoudend; balans ≤ 0,02 %']
                ],
                valCols: ['Case', 'Grootheid', 'Model', 'Referentie', 'Tolerantie', 'Status'],
                val: { drops: 'Eindsnelheid druppels vs Gunn & Kinzer (1949)', testrig: 'Klimaatcascade testopstelling (tab. 3.4.7)', fullscale: 'Klimaatcascade ware grootte vs CFD (tab. 3.3.9/2)', ventec: 'Ventecdak (tab. 2.5.3)', draft: 'Thermische trek, vereenvoudiging §3.5.5.4/5', chimney: 'Zonneschoorsteen (fig. 4.5.6/1, §4.5.11.3, testdag 15-12-2009)' },
                valIntro: 'Deze tabel wordt bij het openen van dit tabblad met dezelfde rekenkern berekend. Groen = binnen de tolerantie van SPEC §12.1, oranje = daarbuiten.',
                computing: 'Validatie wordt berekend…', ok: 'binnen tolerantie', bad: 'buiten tolerantie',
                thesisNote: 'conventie proefschrift; met de neutrale-zonebenadering van het model +30,3 Pa (afwijking 11)',
                balance: 'Energiebalans cascade (lucht + water): {err} % (eis < 0,1 %)', water: 'Waterbalans: ṁ_w,uit = ṁ_w,in − ṁ_ev (exact)',
                warnText: {
                    inputRange: 'De invoer ligt buiten het bereik waarvoor het model of het proefschrift onderbouwd is (SPEC §7). Er wordt wel gerekend.',
                    inputClamped: 'De invoer is fysisch niet zinvol en is begrensd, zodat er geen ongeldige uitkomsten (NaN) ontstaan.',
                    setpointUnreachable: 'Ook met de maximale water/luchtfactor koelt de cascade niet tot het setpoint: grotere waterhoeveelheid, kouder water of fijner spectrum nodig.',
                    rwlMin: 'Bij de minimale RW/L wordt de lucht al kouder dan het setpoint; buiten de cascade wordt naverwarmd tot de toevoertemperatuur.',
                    iceLikely: 'Bij vorst en weinig water bevriezen druppels of sproeiers (§3.4.8); daarom RW/L ≥ 0,5 en warmer water.',
                    freezeTop: 'Bovenin kan het water bij koude buitenlucht onder 0,5 °C komen: bevriezingsrisico van sproeiers en druppels.',
                    legionella: 'Boven 20 °C is de cascade niet meer intrinsiek veilig voor legionella (§3.6.3).',
                    aerosols: 'Zeer fijne druppels (d32 < 0,5 mm) worden door de luchtstroom meegevoerd (§3.2.14).',
                    rhOutLow: 'Normaal verlaat de lucht de cascade bijna verzadigd; een lagere RV wijst op weinig water of een korte schacht.',
                    roomHumid: 'Met water van 13 °C droogt de cascade minder dan het conceptontwerp aanneemt (bevestigd door meting B1, §3.4.10.4); de ruimte-RV komt in de zomer boven 60 %.',
                    condensWinter: 'Hoge RV bij vorst geeft condensrisico op koude oppervlakken zoals beglazing (§3.5.6.3).',
                    glassHot: 'Ongehard glas kan breken boven ≈ 80 °C; gehard glas of een bypass-beveiliging is nodig (§4.1.4, §4.5.11.6).',
                    chimneyClosed: 'Is het warmteverlies van de schoorsteen groter dan de zonnewinst, dan wordt hij gesloten en wordt via de shunt naar het dak afgezogen (§4.5.6.8).',
                    ejectorRange: 'De Cp-formules van de ejector zijn alleen gevalideerd voor 0,1 ≤ U_ej/U_ref ≤ 0,8 (tab. 2.4.1); daarbuiten wordt de grenswaarde gebruikt.',
                    ejectorPositive: 'Met een bovenkanaal van 1 m wordt Cp positief bij U_ej/U_ref ≥ 0,3: de ejector werkt dan tegen.',
                    noWind: 'Zonder wind levert het Ventecdak geen over- of onderdruk; de hulpventilatoren nemen het over.',
                    windProfile: 'Het logaritmische windprofiel is onbetrouwbaar dicht bij de verplaatsingshoogte d (ruwe bebouwing).',
                    bblFlow: 'Het Bbl (art. 4.122 lid 2) vraagt voor kantoren minimaal 6,5 dm³/s per persoon.',
                    balance: 'De energiebalans van lucht en water in de cascade sluit niet binnen 0,1 %; controleer de invoer (bijv. extreem weinig cellen).',
                    cascadeOff: 'In variant A1 staat de cascade uit in het tussenseizoen: geen behandeling, geen hydraulische trek, dus een hulpventilator (§3.5.6.4).'
                }
            },
            warnTitle: {
                inputRange: 'Invoer buiten zinvol bereik', inputClamped: 'Invoer begrensd', setpointUnreachable: 'Setpoint niet haalbaar', rwlMin: 'RW/L op minimum',
                iceLikely: 'IJsvorming waarschijnlijk', freezeTop: 'Bevriezingsrisico bovenin', legionella: 'Legionella-risico', aerosols: 'Meevoeren van aerosolen',
                rhOutLow: 'Lage RV uit de cascade', roomHumid: 'RV ruimte te hoog', condensWinter: 'Condensrisico in de winter', glassHot: 'Glastemperatuur > 80 °C',
                chimneyClosed: 'Zonneschoorsteen dicht (kantelpunt)', ejectorRange: 'Ejector buiten geldigheidsgebied', ejectorPositive: 'Ejector geeft overdruk',
                noWind: 'Geen wind', windProfile: 'Windprofiel onbetrouwbaar', bblFlow: 'Bbl-debiet niet gehaald', balance: 'Energiebalans cascade', cascadeOff: 'Cascade uit (variant A1)'
            },
            // ewf:nl-end
        },
        units: { kPa: 'kPa', m: 'm' }
    };

    const en = {
        app: {
            title: 'Mollier h,x chart',
            subtitle: 'Air handling · processes · loads',
            footer: 'Calculations per ASHRAE Handbook – Fundamentals 2017 (Hyland-Wexler), validated against PsychroLib. An engineering aid; verify critical designs.'
        },
        tb: {
            undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)', file: 'File', share: 'Share',
            theme: 'Light/dark', help: 'Help & shortcuts', lang: 'Schakel naar Nederlands', projectName: 'Project name'
        },
        menu: {
            new: 'New project', example: 'Load example project', open: 'Open project (.json)…', save: 'Save project (.json)',
            png: 'Chart as PNG', svg: 'Chart as SVG (vector)', csv: 'Tables as CSV (Excel)', print: 'Print / PDF'
        },
        chartType: { mollier: 'Mollier h,x', psychro: 'Psychrometric' },
        panel: {
            system: 'System', scenarios: 'Scenarios', start: 'Start point & airflow',
            add: 'Add process step', edit: 'Edit process step', steps: 'Process steps'
        },
        sys: {
            pressureBy: 'Pressure from', altitude: 'Altitude', pressure: 'Pressure', altitudeUnit: 'm',
            result: 'p = {p} kPa', resultAlt: 'p = {p} kPa · altitude {z} m'
        },
        scn: {
            add: 'New', name: 'Name', color: 'Colour', visible: 'Show on chart', duplicate: 'Duplicate',
            delete: 'Delete', confirmDelete: 'Delete scenario "{name}"?', newName: 'Scenario {n}',
            copy: '{name} (copy)', lastOne: 'At least one scenario must remain.'
        },
        start: {
            pair: 'Input by', flow: 'Airflow', flowVolume: 'm³/h', flowMass: 'kg/h dry air',
            mdot: 'ṁ = {m} kg/s dry air · V = {v} m³/h at the start point', noFlow: 'No airflow: powers and water flows are not calculated.'
        },
        q: {
            t: 'Temperature', rh: 'Relative humidity', x: 'Humidity ratio', h: 'Enthalpy',
            twb: 'Wet-bulb temperature', tdp: 'Dew point'
        },
        qs: { t: 't', rh: 'RH', x: 'x', h: 'h', twb: 't_wb', tdp: 't_dp' },
        cat: {
            heat: 'Heating', cool: 'Cooling', humidify: 'Humidify', dehumidify: 'Dehumidify',
            mix: 'Mixing', hr: 'Heat recovery', ewf: 'EWF cascade', other: 'Other'
        },
        type: {
            cascade: 'Climate cascade (Earth, Wind & Fire)',
            heat: 'Heater (constant x)',
            cool: 'Cooler — ideal (dew-point kink)',
            coil: 'Cooling coil — ADP and bypass factor',
            cooldehum: 'Cool & dehumidify to t / RH',
            adiabatic: 'Adiabatic (evaporative) humidifier',
            steam: 'Steam humidifier',
            spray: 'Water spray (water temperature)',
            dehum: 'Isothermal dehumidification',
            desiccant: 'Desiccant wheel (constant h)',
            mix: 'Mix with second air stream',
            hr: 'Heat recovery',
            load: 'Room load (heat + moisture)',
            fan: 'Fan (heat gain)',
            point: 'Free point'
        },
        typeHint: {
            cascade: 'Water at ≈ 13 °C is sprayed at the top of a shaft; the falling droplets cool/dry (summer) or heat/humidify (winter) the air and provide hydraulic draught. Cell model after Bronsema (2013) ch. 3; the path follows the calculated profile.',
            heat: 'Sensible heating: x stays constant, a vertical line in the Mollier chart.',
            cool: 'Ideal cooling: constant x down to the dew point, then along the saturation line (condensation).',
            coil: 'Outlet lies on the straight line towards the apparatus dew point (ADP). BF = share of air bypassing the coil. If that line enters the fog region, the droplets are drained as condensate and the air leaves saturated.',
            cooldehum: 'Straight process line to the given end state; the implied ADP and BF are derived.',
            adiabatic: 'Evaporative humidification along the wet-bulb line (≈ constant h). 100 % = saturated.',
            steam: 'Steam humidification: direction Δh/Δx = steam enthalpy; t rises slightly.',
            spray: 'Water spray at a given water temperature: Δh/Δx = c_w · t_water.',
            dehum: 'Idealised dehumidification at constant temperature.',
            desiccant: 'Desiccant dehumidification: h (nearly) constant, t rises.',
            mix: 'Adiabatic mixing: mass and energy balance on dry air. The mix point lies on the straight line between both streams.',
            hr: 'Balanced heat recovery with return air. Efficiencies per EN 308.',
            load: 'Sensible and moisture load of a room applied to the air stream (protractor Δh/Δx).',
            fan: 'All fan power ends up as heat in the air stream: Δh = v · Δp / η.',
            point: 'Arbitrary point; drawn as a straight line in the h,x plane.'
        },
        mode: {
            toT: 'To temperature', dT: 'By temperature difference', power: 'By power', toH: 'To enthalpy',
            toRH: 'To relative humidity', toX: 'To humidity ratio', dX: 'By Δx', flow: 'By water flow',
            eff: 'By saturation efficiency', bf: 'By bypass factor'
        },
        val: {
            toT: 'Target temperature', dT: 'Temperature difference ΔT', power: 'Power', toH: 'Target enthalpy',
            toRH: 'Target RH', toX: 'Target humidity ratio', dX: 'Increase Δx', flow: 'Water flow',
            eff: 'Saturation efficiency η', bf: 'Bypass factor BF'
        },
        valBy: {
            'coil.toT': 'Leaving temperature', 'dehum.dX': 'Decrease Δx', 'desiccant.dX': 'Decrease Δx',
            'dehum.flow': 'Water removed', 'steam.flow': 'Steam flow', 'cool.power': 'Cooling power', 'heat.power': 'Heating power'
        },
        field: {
            mode: 'Method', tAdp: 'Coil surface temperature (ADP)', t: 'Temperature', rh: 'Relative humidity',
            tSteam: 'Steam temperature', tWater: 'Water temperature', t2: 'Stream 2 temperature', hum: 'Stream 2 moisture by',
            b2: 'Stream 2 moisture', flowMode: 'Stream 2 quantity', flow2: 'Quantity', hrType: 'Exchanger type',
            eff: 'Temperature efficiency η_t', effX: 'Moisture efficiency η_x', tRet: 'Return air temperature',
            rhRet: 'Return air RH', qs: 'Sensible heat Q_s', mw: 'Moisture gain', dp: 'Pressure rise Δp',
            pair: 'Input by', a: 'Value 1', b: 'Value 2', label: 'Custom name (optional)'
        },
        fieldBy: { 'cascade.H': 'Active cascade height', 'cascade.w': 'Air velocity', 'cascade.rwl': 'Water/air ratio RW/L', 'cascade.tW': 'Spray water temperature', 'cascade.spray': 'Spray spectrum', 'cascade.w0': 'Initial droplet velocity', 'fan.eff': 'Fan total efficiency', 'mix.flow2.fraction': 'Stream 2 share of mix', 'mix.flow2.volume': 'Stream 2 volume flow', 'mix.flow2.mass': 'Stream 2 mass flow (dry air)' },
        opt: {
            fulljet: 'Fulljet 3/4GG-3050 (test rig)', s1: 'Spectrum 1 (d30 4.01 mm)', s2: 'Spectrum 2 (d30 3.61 mm)', s3: 'Spectrum 3 (d30 3.21 mm)', s4: 'Spectrum 4 (d30 2.81 mm)', s5: 'Spectrum 5 (d30 2.41 mm)', s6: 'Spectrum 6 (d30 2.01 mm)', s7: 'Spectrum 7 (d30 1.61 mm)', s8: 'Spectrum 8 (d30 1.20 mm)', s9: 'Spectrum 9 (d30 0.80 mm)', s10: 'Spectrum 10 (d30 0.40 mm)',
            rh: 'Relative humidity', x: 'Humidity ratio', fraction: 'Share of mix (%)', volume: 'Volume flow (m³/h)',
            mass: 'Mass flow (kg/h)', sensible: 'Plate / run-around (sensible)', enthalpy: 'Enthalpy wheel (heat + moisture)'
        },
        form: {
            add: 'Add', update: 'Update', cancel: 'Cancel', process: 'Process',
            result: 'Result', needStart: 'Set a valid start point first.'
        },
        steps: {
            empty: 'No process steps yet. Pick a process above and click Add — or double-click the chart.',
            up: 'Move up', down: 'Move down', toggle: 'On/off', delete: 'Delete', edit: 'Edit', duplicate: 'Duplicate',
            disabled: 'disabled', blocked: 'blocked by invalid start point', of: '{n} steps'
        },
        desc: {
            cascade: 'Climate cascade H {h} m · RW/L {rwl} · water {tw} °C',
            'heat.toT': 'Heat to {v} °C', 'heat.dT': 'Heat +{v} K', 'heat.power': 'Heat {v} kW',
            'heat.toH': 'Heat to {v} kJ/kg', 'heat.toRH': 'Heat to {v} % RH',
            'cool.toT': 'Cool to {v} °C', 'cool.dT': 'Cool −{v} K', 'cool.power': 'Cool {v} kW', 'cool.toRH': 'Cool to {v} % RH',
            'coil.bf': 'Cooling coil ADP {tAdp} °C · BF {v}', 'coil.toT': 'Cooling coil ADP {tAdp} °C → {v} °C',
            cooldehum: 'Cool & dehumidify → {t} °C / {rh} %',
            'adiabatic.eff': 'Adiabatic humidify η {v} %', 'adiabatic.toRH': 'Adiabatic humidify → {v} % RH',
            'adiabatic.toX': 'Adiabatic humidify → {v} g/kg', 'adiabatic.toT': 'Adiabatic humidify → {v} °C',
            'steam.toRH': 'Steam → {v} % RH', 'steam.toX': 'Steam → {v} g/kg', 'steam.dX': 'Steam +{v} g/kg', 'steam.flow': 'Steam {v} kg/h',
            'spray.toRH': 'Spray → {v} % RH', 'spray.toX': 'Spray → {v} g/kg', 'spray.dX': 'Spray +{v} g/kg', 'spray.flow': 'Spray {v} kg/h',
            'dehum.toRH': 'Dehumidify → {v} % RH', 'dehum.toX': 'Dehumidify → {v} g/kg', 'dehum.dX': 'Dehumidify −{v} g/kg', 'dehum.flow': 'Dehumidify {v} kg/h',
            'desiccant.toRH': 'Desiccant → {v} % RH', 'desiccant.toX': 'Desiccant → {v} g/kg', 'desiccant.dX': 'Desiccant −{v} g/kg',
            'mix.fraction': 'Mix with {t2} °C / {b2} ({flow2} %)', 'mix.volume': 'Mix with {t2} °C / {b2} ({flow2} m³/h)', 'mix.mass': 'Mix with {t2} °C / {b2} ({flow2} kg/h)',
            'hr.sensible': 'Heat recovery η {eff} %', 'hr.enthalpy': 'Enthalpy wheel η {eff} / {effX} %',
            load: 'Room load {qs} kW + {mw} kg/h', fan: 'Fan {dp} Pa · η {eff} %', point: 'Free point {a} / {b}'
        },
        info: {
            bf: 'BF {bf} · ADP {adp} °C', dry: 'dry coil (no condensation)', eff: 'η {eff} %', share: 'share {share} %',
            gamma: 'Δh/Δx {g} kJ/kg', power: 'energy {p} kW', cascade: 't_w,out {tw} °C · Δp_hydr {dp} Pa'
        },
        kpi: {
            heating: 'Heating', cooling: 'Cooling', recovered: 'Heat recovery', humid: 'Humidification',
            dehum: 'Dehumidification', final: 'End state', fan: 'incl. fan {v} kW', none: '—'
        },
        tbl: {
            states: 'States', steps: 'Processes', csv: 'CSV', point: 'Point', step: 'Step', process: 'Process',
            V: 'V m³/h', water: 'Water kg/h', shr: 'SHR', gamma: 'Δh/Δx', emptyStates: 'No valid states.',
            emptySteps: 'No process steps yet.', fog: 'fog', skipped: 'disabled'
        },
        chart: {
            layers: 'Layers', range: 'Range', zoomIn: 'Zoom in (+)', zoomOut: 'Zoom out (−)', fit: 'Fit to data (F)',
            reset: 'Full chart (0)', wheelHint: 'Hold Ctrl (⌘) and scroll to zoom',
            hint: 'Double-click: add point · Drag point 1 to move the start · Ctrl + scroll: zoom · drag: pan',
            title: '{type} · p = {p} kPa', statusIdle: 'Move over the chart to read the air state.',
            cursor: 'Cursor', point: 'Point {n}', fog: 'fog region', dragging: 'dragging…',
            axisX: 'Humidity ratio x [g/kg]', axisT: 'Temperature t [°C]', axisPw: 'p_w [hPa]', axisH: 'h [kJ/kg]',
            axisTPsy: 'Dry-bulb temperature t [°C]', axisXPsy: 'Humidity ratio x [g/kg]', comfort: 'Comfort',
            fogLabel: 'fog region', edge: 'Protractor Δh/Δx [kJ/kg]',
            aux: { adp: 'ADP', stream2: 'S2', return: 'RA', wb: '' }
        },
        layer: {
            iso: 'Isotherms', rh: 'RH lines φ', h: 'Enthalpy h', wb: 'Wet bulb', rhoM: 'Density ρ', rhoP: 'Spec. volume v',
            fog: 'Fog region', comfort: 'Comfort zone', edge: 'Protractor', pw: 'Vapour pressure', values: 'Values at points'
        },
        range: {
            title: 'Chart range', tMin: 't min [°C]', tMax: 't max [°C]', xMax: 'x max [g/kg]', presets: 'Presets',
            standard: 'Standard', hvac: 'Comfort HVAC', winter: 'Winter', hot: 'High temp.', comfortTitle: 'Comfort zone',
            ctMin: 't min', ctMax: 't max', crhMin: 'RH min', crhMax: 'RH max', cxMax: 'x max [g/kg]', apply: 'Apply'
        },
        toast: {
            saved: 'Project saved as file.', opened: 'Project opened: {name}', openFail: 'Could not read the file.',
            linkCopied: 'Share link copied to clipboard.', linkShow: 'Copy this link:', shared: 'Shared project loaded.',
            migrated: 'Project from the previous version imported.', newProject: 'New project started.', example: 'Example project loaded.',
            undo: 'Undone', redo: 'Redone', stepAdded: 'Step added.', stepUpdated: 'Step updated.',
            pointAdded: 'Free point added at {t} °C / {x} g/kg.', startSet: 'Start point set.', exportFail: 'Export failed.',
            eggOn: 'Hej! MÖLLIER is assembled — no screws left over.', eggOff: 'Back to the standard style.'
        },
        confirm: { newProject: 'Start a new empty project? (Undo remains possible.)' },
        example: {
            name: 'Example air handling unit', winter: 'Winter', summer: 'Summer', newName: 'New project'
        },
        err: {
            ERR_CASCADE_H: 'Cascade height must be between 0.5 and 200 m.', ERR_CASCADE_RWL: 'RW/L must be between 0 and 5.',
            ERR_INVALID: 'Invalid or missing input.',
            ERR_OUT_OF_RANGE: 'Outside the validity range (−100…200 °C).',
            ERR_T_RANGE: 'Temperature outside −100…200 °C.',
            ERR_X_NEGATIVE: 'Humidity ratio cannot become negative.',
            ERR_X_POSITIVE: 'Humidity ratio must be greater than 0.',
            ERR_RH_RANGE: 'RH must be between 0 and 100 %.',
            ERR_BOILING: 'Vapour pressure exceeds air pressure (boiling region).',
            ERR_TWB_ABOVE_T: 'Wet-bulb temperature cannot exceed dry-bulb temperature.',
            ERR_TWB_TOO_LOW: 'Wet-bulb temperature too low for this temperature.',
            ERR_TDP_ABOVE_T: 'Dew point cannot exceed the temperature.',
            ERR_H_TOO_LOW: 'Enthalpy too low for this temperature.',
            ERR_SUPERSAT: 'This combination lies in the fog region; use t + x.',
            ERR_NO_SOLUTION: 'No solution found — check the input.',
            ERR_UNKNOWN_PAIR: 'Unknown input pair.',
            ERR_VAPOUR_PRESSURE: 'Invalid vapour pressure.',
            ERR_UNKNOWN_TYPE: 'Unknown process type.',
            ERR_NEED_FLOW: 'This requires an airflow.',
            ERR_POSITIVE: 'Value must be greater than 0.',
            ERR_HEAT_TARGET: 'Target must be above the current state.',
            ERR_HEAT_RH: 'Heating lowers RH: target must be below the current RH.',
            ERR_COOL_TARGET: 'Leaving temperature must be below the current temperature.',
            ERR_COOL_RH: 'Target RH must be above the current RH and at most 100 %.',
            ERR_ADP_HIGH: 'ADP must be below the entering temperature.',
            ERR_COIL_T: 'Leaving temperature must lie between ADP and entering temperature.',
            ERR_BF_RANGE: 'Bypass factor must be between 0 and 1.',
            ERR_DEHUM_X: 'Humidity ratio must decrease.',
            ERR_ALREADY_SAT: 'Air is already saturated.',
            ERR_EFF_RANGE: 'Efficiency must be between 0 and 100 %.',
            ERR_ADIA_X: 'Target x must lie between current x and {max} g/kg (saturation).',
            ERR_ADIA_T: 'Target temperature must lie between the wet-bulb ({min} °C) and the current temperature.',
            ERR_HUMID_RH: 'Target RH must be above the current RH and at most 100 %.',
            ERR_HUMID_X: 'Target x must be above the current x.',
            ERR_DEHUM_RH: 'Target RH must be below the current RH.',
            ERR_STEAM_T: 'Steam temperature must be between 0 and 200 °C.',
            ERR_WATER_T: 'Water temperature must be between 0 and 100 °C.',
            ERR_FRACTION: 'Share must be between 0 and 100 %.',
            ERR_LOAD: 'Enter a heat and/or moisture load.',
            generic: 'Calculation failed.'
        },
        help: {
            title: 'Help & shortcuts', close: 'Close',
            intro: 'Pick a start point, add process steps and read states, powers and water flows instantly. Everything is saved automatically in this browser.',
            mouse: 'Mouse and touch',
            m1: 'Move over the chart: the status bar shows t, x, RH, h, t_wb, t_dp, ρ and p_w, with guide lines through the cursor.',
            m2: 'Double-click: new free point (or start point if the scenario is empty).',
            m3: 'Drag point 1 (start), free points, mix stream S2 or return air RA to move them.',
            m4: 'Ctrl/⌘ + scroll or pinch: zoom · drag the background (touch: two fingers): pan · tap: read values.',
            m5: 'Click a process line or step to edit it; click a point to highlight it in the table.',
            keys: 'Keyboard shortcuts',
            k1: 'Ctrl+Z / Ctrl+Y — undo / redo', k2: 'M — toggle Mollier / psychrometric',
            k3: '+ / − / 0 / F — zoom, full chart, fit', k4: 'Delete — remove selected step', k5: 'Esc — cancel editing / clear selection',
            method: 'Method',
            me1: 'Saturation pressure over water and ice per Hyland-Wexler (ASHRAE 2017, eq. 5–6); wet bulb eq. 33/35; density and specific volume eq. 26–28.',
            me2: 'The Mollier chart uses the classic oblique coordinates: vertical (h − 2501·x)/1.006, so isotherms fan slightly and enthalpy lines are straight. Isotherms kink in the fog region.',
            me3: 'Powers: Q = ṁ_a · Δh, with ṁ_a the dry-air mass flow (volume flow divided by the specific volume at the start point). When cooling with condensation the condensate enthalpy is subtracted: Q = ṁ_a · [Δh − Δx · c_w · t₂]. Q_s = ṁ_a · (1.006 + 1.86·x₁) · Δt, Q_l = Q − Q_s.',
            ewf: 'Earth, Wind & Fire',
            ewf1: 'E — switch between the Mollier chart and Earth, Wind & Fire. Ctrl+Z/Y and ? work in both views.',
            ewf2: 'Pick a weather case, "Weather now in De Bilt" or enter your own on the left; all building and system parameters can be edited and are recalculated immediately.',
            ewf3: 'Hover or tap a component of the section for its values; click it to open the matching input panel.',
            ewf4: 'Snapshot at constant flow: per floor throttling (surplus) or auxiliary fan (deficit). Supply and exhaust are balanced separately (neutral zone).',
            ewf5: 'Model after Bronsema (2013), Earth, Wind & Fire – Natural Air Conditioning (TU Delft); see the Method & sources tab.'
        },
        view: { label: 'View', mollier: 'Mollier chart', ewf: 'Earth, Wind & Fire' },
        ewf: {
            title: 'Earth, Wind & Fire', subtitle: 'Natural air conditioning · Bronsema 2013',
            assume: 'assumption', src: 'Source', range: 'sensible range', def: 'default',
            reset: 'Default', resetTitle: 'Restore the defaults of this panel', resetAll: 'All defaults',
            resetAllTitle: 'Reset all inputs (building and weather) to the standard office', resetDone: 'Defaults restored',
            mode: { cool: 'cooling', heat: 'heating', off: 'cascade off (A1)' },
            modeLong: { cool: 'Cooling mode', heat: 'Heating/humidifying', off: 'Variant A1: cascade off' },
            panel: {
                weather: 'Weather', building: 'Building', vent: 'Ventilation', cascade: 'Climate cascade', ventec: 'Ventec roof',
                chimney: 'Solar chimney', exhaust: 'Exhaust & pressure losses', advanced: 'Advanced'
            },
            f: {
                floors: 'Number of floors', hFloor: 'Floor height', avoFloor: 'Net floor area per floor', bvoFactor: 'Gross/net area',
                occDensity: 'Occupancy density', presence: 'Presence', qInt: 'Internal heat gain', moistPerson: 'Moisture production',
                tRoomSummer: 'Room temperature summer', tRoomWinter: 'Room temperature winter', rhRoomMax: 'Max. room RH',
                xRoomMax: 'Max. room humidity ratio',
                ventMethod: 'Method', ventCat: 'Category', emission: 'Building emission class', qManual: 'Ventilation rate',
                tSupCool: 'Supply temperature cooling', tSupHeat: 'Supply temperature heating',
                wCascade: 'Cascade air velocity', spray: 'Spray spectrum', d30: 'd30 (volume mean)', d32: 'd32 (Sauter)',
                w0: 'Initial droplet velocity', rwlMode: 'Water/air ratio control (RW/L)', rwlMin: 'RW/L minimum', rwlMax: 'RW/L maximum',
                rwlWinter: 'RW/L heating (frost protection)', rwlManual: 'RW/L', tWCool: 'Water temperature cooling',
                tWHeat: 'Water temperature heating', tWFrost: 'Water temperature in frost', tFrostLimit: 'Frost limit outdoor air',
                variantA1: 'Variant A1: cascade off in mid-season', tA1Min: 'A1 from outdoor temperature',
                terrain: 'Terrain class', roofExtra: 'Roof structure above top floor', cpIn: 'Cp inlet', cTop: 'Upper channel height c',
                uEjDesign: 'Ejector design velocity',
                chimType: 'Type', chimAz: 'Orientation (0 = south, −90 = east)', chimB: 'Width B', chimD: 'Depth D', glass: 'Glazing',
                glassG: 'g-value', glassU: 'Glazing U-value', chimR: 'Net/gross glass R', epsAbs: 'Absorber emissivity',
                uWall: 'Inner wall U-value', f1: 'Absorption inner pane f1', f2: 'Absorption absorber f2', cwc: 'Forced convection (CWC)',
                dpSupDesign: 'Δp supply system (design)', dpExhExt: 'Δp external exhaust (grilles, atrium)', wShunt: 'Shunt air velocity',
                zetaU: 'ζ U-bend', roughness: 'Shaft wall roughness', dpFiwihex: 'Δp FiWiHEx', fiwiEff: 'FiWiHEx effectiveness',
                fiwiTWater: 'FiWiHEx water temperature',
                nCells: 'Cascade cells', pNozzle: 'Nozzle pressure', pipeR: 'Pipe friction', dpLocal: 'Local losses',
                etaPump: 'Pump efficiency', dpSource: 'Δp source system', etaFanV: 'Fan efficiency', etaFanM: 'Motor efficiency',
                dtStrat: 'ΔT stratification exhaust air',
                t: 'Outdoor temperature', rh: 'Relative humidity', p: 'Air pressure', U10: 'Wind speed U10', dir: 'Wind direction',
                ghi: 'Global horizontal irradiance', facade: 'Irradiance on the facade', time: 'Date and time (local)',
                facadeManual: 'Facade irradiance manual (no incidence-angle correction)'
            },
            opt: {
                ventMethod: { nen: 'EN 16798-1', manual: 'Manual flow rate' },
                ventCat: { I: 'Category I', II: 'Category II', III: 'Category III' },
                emission: { verylow: 'Very low-polluting', low: 'Low-polluting', non: 'Not low-polluting' },
                spray: { fulljet: 'Fulljet 3/4GG-3050 (test rig)', s: 'Spectrum {n} (d30 {d30} mm)', custom: 'Custom d30/d32' },
                rwlMode: { auto: 'Automatic (cooling) / fixed (heating)', manual: 'Manual' },
                terrain: { 4: '4 · roughly open (z0 0.1 m)', 5: '5 · rough (z0 0.25 m)', 6: '6 · very rough (z0 0.5 m; d 10 m)', 7: '7 · closed (z0 1.0 m; d 10 m)', 8: '8 · city centre (z0 2.0 m; d 15 m)' },
                cTop: { 1: '1 m (formula 2.3.1)', 2: '2 m (formula 2.3.2)' },
                chimType: { chimney: 'Solar chimney', facade: 'Solar facade' },
                glass: { ps: 'Planitherm Solar (g 0.75; U 1.10)', pt: 'Planitherm Total low-E (g 0.70; U 1.32)', clear: 'Clear double glazing (g 0.70; U 3.00)', custom: 'Custom values' }
            },
            hint: {
                building: 'H = {H} m · net area {avo} m² · gross {bvo} m² · {n} persons',
                vent: 'q_v = {q} m³/h ({qa} dm³/s·m²) · ṁ = {m} kg/s · cascade section {s} × {s} m',
                bbl: 'Bbl: {qp} dm³/s per person (min. 6.5)',
                cascade: 'd30/d32 {d30}/{d32} mm · RW/L {rwl} → {qw} m³/h water · droplet residence {tres} s',
                ventec: 'z_roof {z} m · U_ref {u} m/s · q_dyn {q} Pa · A_ej {a} m²',
                chimney: 'w = {w} m/s · D_h {dh} m · Φ facade {phi} W/m² ({method})',
                exhaust: 'Exhaust losses (floor 1): {sum} Pa · shunt {sh} m × {sh} m',
                advanced: 'Spray pump head {h} m · η_fan {eta}',
                weather: 'x {x} g/kg · dew point {tdp} °C · h {h} kJ/kg · Beaufort {bft} ({bftName})',
                sun: 'Sun: altitude {alt}°, azimuth {az}° · Φ facade = {beam} beam + {diff} diffuse W/m² (θ {th}°)',
                sunManual: 'Sun: altitude {alt}°, azimuth {az}° · fixed facade irradiance {phi} W/m² (thesis convention)',
                method: { manual: 'manual', gti: 'Open-Meteo GTI', model: 'Erbs + Hay-Davies' }
            },
            bft: ['calm', 'light air', 'light breeze', 'gentle breeze', 'moderate breeze', 'fresh breeze', 'strong breeze', 'near gale', 'gale', 'strong gale', 'storm', 'violent storm', 'hurricane'],
            weather: {
                source: 'Source', srcPreset: 'Weather case', srcLive: 'Now in De Bilt', srcManual: 'Manual', preset: 'Weather case',
                live: 'Weather now in De Bilt', liveAt: 'Weather now', loading: 'Fetching…', station: 'Location',
                attribution: 'Weather data: Open-Meteo.com (CC BY 4.0), model KNMI HARMONIE-AROME — model value, not a measurement',
                stamp: 'KNMI HARMONIE-AROME via Open-Meteo · {time} (15-min average)',
                stampPreset: 'Weather case: {name}', stampManual: 'Manual input',
                fail: 'Fetching weather failed — previous values kept', offline: 'No internet connection — previous values kept',
                cached: 'Weather from cache (less than 10 minutes old)', ok: 'Weather fetched: {t} °C, {rh} %, {u} m/s'
            },
            preset: {
                ontwerp_zomer: { name: 'Design summer 28 °C / 55 %', info: 'Cascade design condition (§3.1.7.2, case D1); Ventec roof design wind 3.5 m/s (§2.5.4); reference facade irradiance 400 W/m² (§4.2.3).' },
                gem_zomer: { name: 'Average summer day 20 °C / 80 %', info: 'Case D2/B2 (§3.5.3); solar chimney reference condition (§4.2.3).' },
                hitte_2019: { name: 'Heat wave 25-07-2019', info: 'KNMI De Bilt, hour 14 (13–14 UT): 37.1 °C, 29 %, GHI 728 W/m². Daily maximum De Bilt 37.5 °C.' },
                benauwd_2020: { name: 'Sultry summer day 12-08-2020', info: 'KNMI De Bilt, hour 13: 31.3 °C, 44 % (x ≈ 12.6 g/kg: high latent load), GHI 706 W/m².' },
                voorjaar_2023: { name: 'Sunny spring day 15-03-2023', info: 'KNMI De Bilt, hour 12: 8.1 °C, 51 %, GHI 617 W/m².' },
                tussen: { name: 'Mid-season 10 °C / 99 %', info: 'Measurement B4 (§3.4.5). Facade irradiance 150 W/m² is an assumption.' },
                gem_winter: { name: 'Average winter day 5 °C / 90 %', info: 'Case D3. Wind 4 m/s and facade irradiance 80 W/m² are assumptions.' },
                zon_winter: { name: 'Sunny winter day (test day 15-12-2009)', info: 'Solar chimney test day (§4.4.5.2): 0.55 °C, facade 730 W/m². RH and wind are assumptions.' },
                koude_2021: { name: 'Cold spell 13-02-2021', info: 'KNMI De Bilt, hour 9: −7.0 °C, 75 %, GHI 217 W/m².' },
                ontwerp_winter: { name: 'Design winter −10 °C / 90 %', info: 'Case D4; Dutch design outdoor temperature −10 °C (ISSO 51/53/57). Wind 5 m/s is an assumption.' },
                storm_2022: { name: 'Storm Eunice 18-02-2022', info: 'KNMI De Bilt, hour 15: 11.0 °C, 56 %, 13 m/s (gusts 27 m/s), GHI 175 W/m².' },
                windstil: { name: 'Calm, overcast 20 °C', info: 'Shows the auxiliary fans at work. Wind 0.8 m/s and facade irradiance 120 W/m² are assumptions.' }
            },
            kpi: {
                supply: 'Supply', supplySub: 'from cascade · supply {t} °C',
                cascade: 'Cascade', cascadeSub: 'RW/L {rwl} · {qw} m³/h · Δp {dp} Pa',
                supplyP: 'Supply pressure balance', exhaustP: 'Exhaust pressure balance',
                throttle: 'throttle {min}–{max} Pa', fan: 'aux. fan {pa} Pa · {kw} kW',
                chimney: 'Solar chimney', chimneySub: '{q} kW · η {eta} · draught {dp} Pa', open: 'open', closed: 'closed (tipping point)',
                power: 'Electric', powerSub: 'pumps {pump} · fans {fan} kW · COP {cop}',
                room: 'Room', roomSub: '{x} g/kg · {t} °C', comfortOk: 'comfort ok', comfortBad: 'too humid'
            },
            warnHead: 'Messages', why: 'why?', noWarn: 'No messages.',
            warn: {
                inputRange: '{field}: {value} is outside the sensible range {min}–{max}.',
                inputClamped: '{field}: {value} is not realistic; calculated with {lim}.',
                setpointUnreachable: 'Supply temperature {t} °C not reachable: RW/L at maximum ({rwl}).',
                rwlMin: 'RW/L at minimum ({rwl}): the air gets colder than the set point and is reheated.',
                iceLikely: 'Ice formation likely: frost and RW/L {rwl} < 0.5 (§3.4.8).',
                freezeTop: 'Freezing risk at the top: lowest water temperature {t} °C.',
                legionella: 'Water temperature {t} °C > 20 °C: legionella risk; the cascade is only intrinsically safe at low water temperature (§3.6.3).',
                aerosols: 'd32 = {d} mm < 0.5 mm: risk of aerosol carry-over (§3.2.14).',
                rhOutLow: 'RH leaving the cascade {rh} % (< 90 %) — for information.',
                roomHumid: 'Room RH {rh} % / x {x} g/kg above the comfort limit ({rhMax} % / {xMax} g/kg): the cascade dehumidifies only moderately (§3.4.10.4).',
                condensWinter: 'Room RH {rh} % in frost: condensation risk on cold surfaces (§3.5.6.3).',
                glassHot: 'Glass temperature {t} °C > 80 °C: toughened glass or bypass protection needed (§4.1.4).',
                chimneyClosed: 'Solar chimney closed (tipping point §4.5.6.8): loss ({q} kW) exceeds gain; exhaust via the shunt.',
                ejectorRange: 'U_ej/U_ref = {ratio} outside the validity range 0.1–0.8; calculated with {lim}.',
                ejectorPositive: 'Ejector with c = 1 m gives overpressure (Cp = {cp}): counteracts.',
                noWind: 'Hardly any wind: the ejector gives no suction.',
                windProfile: 'Roof height {z} m < d + 5 m ({d} + 5): logarithmic wind profile unreliable.',
                bblFlow: 'Flow {q} dm³/s per person < {min} (Dutch Bbl art. 4.122).',
                balance: 'Cascade energy balance deviates {err} % (> 0.1 %).',
                cascadeOff: 'Variant A1: cascade off — no treatment and no hydraulic draught.'
            },
            tab: {
                profile: 'Cascade profile', pressure: 'Pressure balance', chimney: 'Solar chimney', mollier: 'Mollier', energy: 'Energy',
                floors: 'Per floor', all: 'All weather cases', method: 'Method & sources'
            },
            tbl: {
                floor: 'Floor', z: 'z', tSup: 't_sup', supMargin: 'Supply margin', supAction: 'Supply', exhMargin: 'Exhaust margin',
                exhAction: 'Exhaust', throttle: 'throttle', deficit: 'deficit', csv: 'CSV'
            },
            energy: {
                item: 'Item', cascade: 'Climate cascade (+ heating / − cooling)', reheat: 'Reheating', chimney: 'Solar heat solar chimney',
                fiwihex: 'FiWiHEx recovery (incl. room heat)', spray: 'Spray pump', source: 'Source pump (ATES)', fanSupply: 'Auxiliary fan supply',
                fanExhaust: 'Auxiliary fan exhaust', refFan: 'Reference: fans conventional AHU (2.64 kW per m³/s)',
                refCool: 'Reference: chiller conventional AHU (COP 3)', losses: 'losses',
                note: 'Thermal: + = heat to the air/water, − = cooling. Electric power of pumps and fans. Reference per the case study (§7.5.2).'
            },
            sch: {
                title: 'Schematic section', pause: 'Pause animation', play: 'Play animation',
                desc: 'Section of the Earth, Wind & Fire building. Outdoor air {t} °C; after the climate cascade {tc} °C; supply {ts} °C; top of the solar chimney {tz} °C. Smallest pressure margin supply {sup} Pa, exhaust {exh} Pa.',
                note: 'For clarity the climate cascade is drawn at the facade; in reality it is usually inside the building. Shaft widths to scale (with a minimum), floor height compressed above 12 floors.',
                source: 'Own schematic after the layout of Bronsema (2013) fig. 1.3/1',
                scale: 'Air temperature [°C]',
                bFanSup: 'Auxiliary fan supply {w} W', bThrSup: 'Supply: throttle ≥ {pa} Pa', bFanExh: 'Auxiliary fan exhaust {w} W',
                bThrExh: 'Exhaust: throttle ≥ {pa} Pa', bFreeze: 'Freezing risk', bRh: 'Room RH {rh} %',
                kc: 'Climate cascade', ts: 'Supply shaft', sh: 'Shunt duct', zs: 'Solar chimney / facade', sun: 'Sun', ventec: 'Ventec roof (upper roof)',
                abKC: 'CC', abTS: 'SS', abSH: 'SH', abZS: 'SC',
                c1: 'Overpressure plenum', c2: 'Occupied spaces', c3: 'Shunt duct', c4: 'FiWiHEx unit', c5: 'Auxiliary fan(s)',
                c5s: 'Auxiliary fan supply', c5e: 'Auxiliary fan exhaust', c6: 'Venturi ejector', c7: 'Recirculation damper', c8: 'Thermal storage (ATES)', c9: 'Plant room',
                floorN: 'Floor {k}', floorShort: 'fl. {k}', floorTip: 'Floor {k}',
                lOut: 'Outdoor {t} °C · {rh} % · U10 {u} m/s', lUref: 'U_ref {u} m/s', lOver: 'p_over +{p} Pa', lEj: 'p_ej {p} Pa',
                lSpray: 't_w {tw} °C · RW/L {rwl}', lFoot: '{t} °C · {rh} %', lFoot2: 't_w {tw} °C · Δp {dp} Pa', lRoom: 'room {t} °C · {rh} %',
                lZs: 'top {t} °C · {q} kW', lZsClosed: 'closed · {q} kW', lFiwi: 'FiWiHEx {q} kW', lPhi: 'Φ {phi} W/m²', lCold: 'cold well · {q} kW cooling', lColdHeat: 'well · {q} kW heating',
                lWarm: 'warm well · {q} kW',
                refKC: '3.2.4/4, 3.2.6/1, 3.2.15/3–6', tIn: 'Inlet', tOutC: 'Outlet', water: 'Water', dpHydr: 'Hydraulic draught', dpTh: 'Thermal draught',
                dpAero: 'Aerodyn. draught (info)', size: 'Section', tSup: 'Supply', reheat: 'Reheating', pFoot: 'Pressure at cascade foot', fanSup: 'Auxiliary fan',
                tExh: 'Exhaust air', shuntTop: 'Shunt column top floor', state: 'State', tAir: 'Air', draft: 'Thermal draught', glassMax: 'Glass max.',
                wallMax: 'Wall max.', dirInfo: 'Wind direction (info)', recircInfo: 'Outside office hours: recirculation via the shunt (heat harvesting without ventilation). Closed in this snapshot.',
                head: 'Pump head', coldWell: 'Cascade ↔ well', warmWell: 'Solar heat → warm well', alt: 'Solar altitude', az: 'Azimuth (0 = south)', room: 'Room'
            },
            ch: {
                profileTitle: 'Profile in the climate cascade (sprayers at the top)', profileSrc: 'Model: Bronsema 2013 §3.2 (cell model, formulas 3.2.4/4, 3.2.6/1, 3.2.7/1); Ranz & Marshall 1952; Schiller & Naumann 1933.',
                pTemp: 'Temperature [°C]', pX: 'x [g/kg]', pRh: 'RH [%]', tWater: 't water', tAir: 't air', height: 'Height [m]', spray: 'sprayers ▾', wd: 'Droplet velocity',
                chimTitle: 'Temperatures in the solar chimney ({state})', chimSrc: 'Model: Bronsema 2013 §4.2.5 (three-node model), 4.2.6/1; Churchill & Usagi 1972.',
                chimSummary: 'Q_sc {q} kW · η {eta} · draught {dp} Pa · glass max. {gl} °C · wall max. {wl} °C · Φ facade {phi} W/m²',
                tGlass: 'θ glass', tWall: 'θ absorber wall', limit80: '80 °C (non-toughened glass)', lGlass: 'glass', lAir: 'air', lWall: 'wall', temp: 'Temperature [°C]',
                pressTitle: 'Pressure margin per floor (+ throttle, − auxiliary fan needed)', pressSrc: 'Model: Bronsema 2013 §3.5.5 (supply), §4.2.7 and §4.5.5 (exhaust); neutral zone §3.5.5.2. Click a floor for the build-up.',
                throttle: 'surplus (throttle)', deficit: 'deficit (auxiliary fan)', supply: 'Supply', exhaust: 'Exhaust',
                thermTitle: 'Thermal [kW]', elecTitle: 'Electric [kW]', cooling: 'cooling', heating: 'heating / heat harvest',
                ewf: 'EWF', conv: 'conventional AHU (case study)', energySrc: 'Pumps: Bronsema 2013 §3.5.4; fans 4.5.11/1; reference §7.5.2 (SFP 2.64 kW per m³/s, chiller COP 3).',
                e_cascade: 'Climate cascade', e_reheat: 'Reheating', e_chimney: 'Solar chimney', e_fiwihex: 'FiWiHEx',
                e_pumps: 'Pumps / chiller', e_fans: 'Fans', e_total: 'Total'
            },
            bu: {
                term: 'Build-up', pOver: 'Ventec roof overpressure', dpHydr: 'Hydraulic draught cascade', dpThKc: 'Thermal draught cascade', dpShaft: 'Supply shaft column',
                lossSup: 'Supply system pressure loss', sumSup: 'Supply margin', dpThZs: 'Thermal draught solar chimney', shuntCol: 'Shunt duct column',
                pEj: 'Ejector suction (−p_ej)', lExt: 'Grilles / transfer', lShunt: 'Shunt friction', lU: 'U-bend', lChim: 'Chimney friction',
                lFiwi: 'FiWiHEx', lDyn: 'Exit loss', sumExh: 'Exhaust margin',
                hint: 'Supply = p_over + Δp_hydr + Δp_th,cc − shaft column − losses; exhaust = Δp_th,sc + shunt column − p_ej − losses. Positive = throttle, negative = auxiliary fan.'
            },
            all: {
                intro: 'All weather cases calculated for the current building. Click a column header to sort and a row to load that weather case.',
                note: 'Q in kW (+ heating, − cooling); margins = smallest over all floors (+ throttle, − auxiliary fan); P_pump = spray + source pump; * = solar chimney closed (tipping point).',
                progress: 'Calculating… {n}/{m}', load: 'Click to load this weather case', loaded: 'Weather case loaded: {name}',
                c: {
                    name: 'Weather case', mode: 'Mode', rwl: 'RW/L', tCascadeOut: 't cascade out', rhCascadeOut: 'RH out', Qcascade: 'Q cascade',
                    Qreheat: 'Q reheat', rhRoom: 'Room RH', phiFacade: 'Φ facade', tChimneyOut: 't_sc', Qchimney: 'Q_sc', dpChimney: 'draught sc',
                    pOver: 'p_over', pEj: 'p_ej', minSupply: 'min. supply margin', minExhaust: 'min. exhaust margin', Pfan: 'P_fan', Ppump: 'P_pump',
                    COP: 'COP', warn: '⚠'
                }
            },
            mo: {
                title: 'Process chain in the h,x chart', open: 'Open in Mollier chart', opened: 'Scenario "{name}" updated in the Mollier chart',
                legend: '1 outdoor air · 2 leaving cascade · 3 supply (after reheating) · 4 room/exhaust · 5 top of solar chimney · 6 after FiWiHEx',
                note: 'Path 1→2 follows the calculated cascade profile (curved); the thesis draws it straight for convenience (§3.1.7.6).',
                reheat: 'Reheating', fiwi: 'FiWiHEx', live: 'Weather now', manual: 'Manual weather', hover: 'Move over the chart to read values.',
                s1: 'Outdoor air', s2: 'Leaving the climate cascade', s3: 'Supply (after reheating)', s4: 'Room / exhaust air', s5: 'Top of solar chimney', s6: 'After FiWiHEx'
            },
            m: {
                intro: 'Quasi-steady snapshot of the complete EWF system for one weather case at a constant controlled ventilation rate (§2.5.5, §3.5.5.8, §4.5.5). For every floor the tool checks whether the natural driving forces suffice: a surplus is throttled by dampers, a deficit is made up by an auxiliary fan. The building is a neutral zone (§3.5.5.2), so supply and exhaust are balanced separately.',
                disclaimer: 'Quasi-steady design model for exploration; not a substitute for CFD, wind-tunnel testing or dynamic building simulation. Validation based on scale experiments (Bronsema 2013).',
                sec: { model: 'Model per component', assume: 'Assumptions', dev: 'Deliberate deviations from the thesis', val: 'Validation (calculated live)', warn: 'Messages: why?', lit: 'Sources', check: 'Checks of the current calculation' },
                comp: [
                    { h: 'Wind and Ventec roof (ch. 2)', p: 'The KNMI wind speed at 10 m (potential wind) is translated via the meso wind at 60 m to roof height with a logarithmic profile. The windward inlet gives overpressure, the venturi ejector in the throat gives suction. Without guide vanes the Ventec roof is independent of wind direction (§2.2.4).',
                        eq: ['U_meso = U10 · ln(60/0.03) / ln(10/0.03)   (2.1.1)', 'U(z) = U_meso · ln((z − d)/z0) / ln(60/z0)   (2.5.1–2.5.3)', 'p_over = Cp_in · ½·ρ_e·U_ref², Cp_in = 0.8   (2.1.4)', 'Cp_ej = 0.2913·ln(U_ej/U_ref) + 0.0151 (c = 2 m, 2.3.2) · 0.5374·ln(·) + 0.6381 (c = 1 m, 2.3.1)'] },
                    { h: 'Climate cascade (ch. 3)', p: 'Cell model (400 cells) from top to bottom: droplet velocity from a momentum equation with C_d(Re), heat and mass transfer per Ranz-Marshall on the Sauter area, evaporation/condensation over liquid water, fog isenthalpically to saturation. The weight of the suspended water provides the hydraulic draught. In cooling mode the control finds the RW/L at which the air leaves at 17 °C; in heating mode RW/L is 0.9 (frost protection).',
                        eq: ['a = g·(1 − ρ_a/ρ_w) − ¾·(ρ_a/ρ_w)·C_d·w_r·|w_r|/d30   (3.2.4/4)', 'A = 6·V_water/d32   (Sauter; deviation from 3.2.5/7)', 'h_c = (2 + 0.6·Pr^⅓·Re^½)·λ/d32   (3.2.6/1); β likewise with Sc   (3.2.7/1)', 'ṁ_ev = β·A·(ρ_v,s(t_w) − ρ_v,air)   (3.2.2/3)', 'Δp_hydr = Σ (ṁ_w/A_c)·g·Δt   (3.2.15/3–6)'] },
                    { h: 'Supply pressure balance (§3.5.5)', p: 'The available pressure per floor follows from the Ventec roof overpressure, the hydraulic and thermal draught of the cascade, the supply shaft column and the design pressure loss of the distribution system. The thermal draught is always integrated over the calculated profile (§3.3.10).',
                        eq: ['Δp_th,cc = Σ g·Δz·(ρ_profile − ρ_e)', 'P_k = p_over + Δp_hydr + Δp_th,cc − g·z_k·(ρ_sup − ρ_e) − Δp_sup,design,  z_k = (k − ½)·h_floor'] },
                    { h: 'Room', p: 'Supply after any reheating (17 °C cooling, 18 °C heating). The room adds moisture (65 g/h per person); the ventilation air provides base cooling or heating, the rest is for the chilled ceilings. Comfort limit RH ≤ 60 % and x ≤ 12 g/kg (§3.1.5.5).',
                        eq: ['x_room = x_sup + G_moist/ṁ_da', 'Q_vent = ṁ_da·(c_p,da + c_p,v·x_sup)·(t_room − t_sup);  Q_rest = Q_int − Q_vent'] },
                    { h: 'Solar chimney and FiWiHEx (ch. 4)', p: 'Per segment (4 per floor) an energy balance of glass, air and absorber wall with radiation, convection (Churchill-Usagi: natural and forced convection) and losses to outside and inside. If the yield is negative the chimney closes (tipping point §4.5.6.8) and exhaust runs via the shunt to the roof. The FiWiHEx is modelled simply (assumption).',
                        eq: ['S = R·g·(Φ_beam·k(θ) + Φ_diff·0.874),  k(θ) = g(θ)/g(0)   (fig. 4.2.2)', 'h_c = [(1.5·|Δθ|^⅓)³ + (7.65·w)³]^⅓   (4.2.4/4, 4.2.4/9)', 'η = Q_sc/(R·B·H·Φ)   (4.5.6/1);  Δp_th,sc = Σ g·Δz·(ρ_e − ρ_sc)   (4.2.6/1)', 'Q_hr = ε·ṁ_da·c_p·max(0, t_top − t_w,in)'] },
                    { h: 'Exhaust pressure balance (§4.2.7, §4.5.5)', p: 'From the grille on floor k down the shunt, up the solar chimney and via FiWiHEx and ejector to outside. In winter the shunt column costs draught, so the top floors have the least left.',
                        eq: ['A_k = Δp_th,sc + g·z_k·(ρ_room − ρ_e) − p_ej − Σ losses   (open)', 'A_k = g·(H − z_k)·(ρ_e − ρ_room) − p_ej − Σ losses   (closed)', 'λ = 0.25 / [log10(ε/(3.72·D_h) + 5.74/Re^0.901)]²   (4.2.7/3)'] },
                    { h: 'Energy (§3.5.4, §4.5.11)', p: 'Auxiliary fans sized for the worst floor; spray pump from head and water flow; source pump from the heat transport. COP in cooling mode only. Reference: conventional AHU per the case study (§7.5.2).',
                        eq: ['P_fan = q_v·(Δp_sup + Δp_exh)/(0.85·0.90)   (4.5.11/1)', 'P_spray = ρ_w·g·h_pump·q_w/0.75   (3.5.4/1–3)', 'COP = |Q_cool| / (P_spray + P_source)   (3.5.4/4)'] },
                    { h: 'Sun and weather', p: 'Solar position per NOAA. From the global irradiance Erbs estimates beam and diffuse; Hay-Davies transposes them to the facade. "Weather now" comes from the KNMI model HARMONIE-AROME via Open-Meteo (model value, not a measurement); facade irradiance then follows from DNI and GTI.',
                        eq: ['beam = DNI·cos θ + circumsolar;  diffuse = isotropic + ground (ρ_g = 0.2)', 'live: beam = DNI·cos θ,  diffuse = GTI − beam'] }
                ],
                assumeCols: ['Assumption', 'Value', 'Note'],
                assume: [
                    ['Roof structure above the top floor', '4 m', 'plant floor 3.7 m (fig. 2.2.2)'],
                    ['Displacement height d, terrain class 7 / 8', '10 / 15 m', 'thesis gives class 6 only'],
                    ['Shunt duct shape', 'square, 1.0 m/s', 'D_h = side'],
                    ['FiWiHEx', 'ε 0.7 · t_w 20 °C · Δp 10 Pa', 'simple model (§4.5.8.2)'],
                    ['Spray pump pipe length', 'H + 10 m', '§3.5.4.2 gives R and Δp_local'],
                    ['Variant A1 (mid-season)', '10 °C ≤ θ_e ≤ 17 °C', 'definition of mid-season'],
                    ['Outdoor air density', 'constant with height', 'pressure gradient neglected'],
                    ['Cascade wall heat', 'neglected', 'share 3–5 % (§3.5.2.3)'],
                    ['Weather cases marked *', 'wind and facade irradiance', 'see the note per weather case']
                ],
                devCols: ['#', 'Thesis', 'Problem', 'Choice'],
                dev: [
                    ['1', 'Droplet area 3.2.5/7 ∝ d32²/d30³', 'Correct is 6V/d32; ≈ 2× too large', 'A = 6V/d32; coarse spectra (s1–s7) cool less than table 3.5.2/1'],
                    ['2', 'Terminal velocity 3.2.4/6', 'Contradicts Gunn & Kinzer', 'Force balance with C_d(Re)'],
                    ['3', 'CWC 7.65·w and 6.5·w', 'Two values', '7.65·w, blended with natural convection'],
                    ['4', 'Node equations 4.2.5/13–15', 'Typos, inner-wall loss missing', 'Correct energy balances'],
                    ['5', 'Aerodynamic draught 3.2.15/2', 'Not demonstrable in measurements', 'Information only'],
                    ['6', 'Thermal draught with mean temperature', 'Profile non-linear', 'Integration over the profile'],
                    ['7', 'Table 3.3.9/2', 'Water volume vs mass flow', 'RW/L × ṁ_da'],
                    ['8', 'Case study: 200 kW cooling', 'Does not match Δh', 'Not used for validation'],
                    ['9', '3.5.5/3: constant 12 120', 'Assumes 3.5 m and ρ0·T0', 'Generic hydrostatics'],
                    ['10', 'Table 3.1.7/3: x = 13.3 g/kg', 'Rounding', 'Always ASHRAE (psychro.js)'],
                    ['11', '§3.5.5.4/5: +16.3 Pa at the top (winter)', 'Shaft taken relative to the cascade column', 'Neutral zone: shaft relative to outdoor air (+30.3 Pa)'],
                    ['P2', 'Prototype: fog correction', 'Condensate added to the water without energy', 'Energy-conserving; balance ≤ 0.02 %']
                ],
                valCols: ['Case', 'Quantity', 'Model', 'Reference', 'Tolerance', 'Status'],
                val: { drops: 'Droplet terminal velocity vs Gunn & Kinzer (1949)', testrig: 'Climate cascade test rig (table 3.4.7)', fullscale: 'Climate cascade full scale vs CFD (table 3.3.9/2)', ventec: 'Ventec roof (table 2.5.3)', draft: 'Thermal draught, simplification §3.5.5.4/5', chimney: 'Solar chimney (fig. 4.5.6/1, §4.5.11.3, test day 15-12-2009)' },
                valIntro: 'This table is calculated with the same core when this tab is opened. Green = within the tolerance of SPEC §12.1, orange = outside.',
                computing: 'Calculating validation…', ok: 'within tolerance', bad: 'outside tolerance',
                thesisNote: 'thesis convention; with the neutral-zone approach of the model +30.3 Pa (deviation 11)',
                balance: 'Cascade energy balance (air + water): {err} % (requirement < 0.1 %)', water: 'Water balance: ṁ_w,out = ṁ_w,in − ṁ_ev (exact)',
                warnText: {
                    inputRange: 'The input is outside the range for which the model or the thesis is substantiated (SPEC §7). The calculation still runs.',
                    inputClamped: 'The input is not physically meaningful and has been limited so that no invalid results (NaN) occur.',
                    setpointUnreachable: 'Even at the maximum water/air ratio the cascade does not reach the set point: more water, colder water or a finer spectrum is needed.',
                    rwlMin: 'At the minimum RW/L the air already gets colder than the set point; it is reheated to the supply temperature outside the cascade.',
                    iceLikely: 'In frost with little water, droplets or nozzles freeze (§3.4.8); hence RW/L ≥ 0.5 and warmer water.',
                    freezeTop: 'At the top the water can drop below 0.5 °C with cold outdoor air: freezing risk for nozzles and droplets.',
                    legionella: 'Above 20 °C the cascade is no longer intrinsically safe against legionella (§3.6.3).',
                    aerosols: 'Very fine droplets (d32 < 0.5 mm) are carried along by the air flow (§3.2.14).',
                    rhOutLow: 'Normally the air leaves the cascade nearly saturated; a lower RH indicates little water or a short shaft.',
                    roomHumid: 'With 13 °C water the cascade dehumidifies less than the concept design assumes (confirmed by measurement B1, §3.4.10.4); room RH exceeds 60 % in summer.',
                    condensWinter: 'High RH in frost gives a risk of condensation on cold surfaces such as glazing (§3.5.6.3).',
                    glassHot: 'Non-toughened glass may break above ≈ 80 °C; toughened glass or bypass protection is needed (§4.1.4, §4.5.11.6).',
                    chimneyClosed: 'If the chimney heat loss exceeds the solar gain it is closed and exhaust runs via the shunt to the roof (§4.5.6.8).',
                    ejectorRange: 'The ejector Cp formulas are only validated for 0.1 ≤ U_ej/U_ref ≤ 0.8 (table 2.4.1); outside that range the limit value is used.',
                    ejectorPositive: 'With a 1 m upper channel Cp becomes positive at U_ej/U_ref ≥ 0.3: the ejector then counteracts.',
                    noWind: 'Without wind the Ventec roof gives no over- or underpressure; the auxiliary fans take over.',
                    windProfile: 'The logarithmic wind profile is unreliable close to the displacement height d (rough built-up area).',
                    bblFlow: 'The Dutch Bbl (art. 4.122(2)) requires at least 6.5 dm³/s per person for offices.',
                    balance: 'The air/water energy balance of the cascade does not close within 0.1 %; check the input (e.g. extremely few cells).',
                    cascadeOff: 'In variant A1 the cascade is off in mid-season: no treatment, no hydraulic draught, hence an auxiliary fan (§3.5.6.4).'
                }
            },
            warnTitle: {
                inputRange: 'Input outside sensible range', inputClamped: 'Input limited', setpointUnreachable: 'Set point not reachable', rwlMin: 'RW/L at minimum',
                iceLikely: 'Ice formation likely', freezeTop: 'Freezing risk at the top', legionella: 'Legionella risk', aerosols: 'Aerosol carry-over',
                rhOutLow: 'Low RH leaving the cascade', roomHumid: 'Room RH too high', condensWinter: 'Condensation risk in winter', glassHot: 'Glass temperature > 80 °C',
                chimneyClosed: 'Solar chimney closed (tipping point)', ejectorRange: 'Ejector outside validity range', ejectorPositive: 'Ejector gives overpressure',
                noWind: 'No wind', windProfile: 'Wind profile unreliable', bblFlow: 'Bbl flow rate not met', balance: 'Cascade energy balance', cascadeOff: 'Cascade off (variant A1)'
            },
            // ewf:en-end
        },
        units: { kPa: 'kPa', m: 'm' }
    };

    const DICTS = { nl, en };
    let lang = 'nl';

    /** Zoek genest; sleutels mogen zelf punten bevatten (bijv. desc['heat.toT']). */
    function lookup(o, key) {
        if (o == null || typeof o !== 'object') return undefined;
        if (o[key] !== undefined) return o[key];
        const i = key.indexOf('.');
        return i < 0 ? undefined : lookup(o[key.slice(0, i)], key.slice(i + 1));
    }

    /** Vertaal een sleutel; {naam} wordt vervangen. Terugval: Engels, daarna de sleutel zelf. */
    function t(key, vars) {
        let s = lookup(DICTS[lang], key);
        if (s === undefined) s = lookup(en, key);
        if (s === undefined) return key;
        if (typeof s !== 'string') return s;
        return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
    }
    const has = (key) => lookup(DICTS[lang], key) !== undefined;

    const numberFormats = {};
    /** Getal met vast aantal decimalen, locale-bewust (NL: komma). */
    function fmt(v, d = 1) {
        if (v === null || v === undefined || !isFinite(v)) return v === Infinity ? '∞' : v === -Infinity ? '−∞' : '—';
        const key = lang + d;
        if (!numberFormats[key]) {
            numberFormats[key] = new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB',
                { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });
        }
        const out = numberFormats[key].format(v === 0 ? 0 : v);
        return out === '-0' || /^-0[.,]0*$/.test(out) ? out.slice(1) : out.replace('-', '−');
    }
    /** Compact getal: maximaal d decimalen, zonder overbodige nullen. */
    function fmtAuto(v, d = 2) {
        if (!isFinite(v)) return fmt(v);
        const key = 'a' + lang + d;
        if (!numberFormats[key]) {
            numberFormats[key] = new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { maximumFractionDigits: d, useGrouping: false });
        }
        return numberFormats[key].format(v).replace('-', '−');
    }
    /** Lees een getal dat komma of punt als decimaalteken kan hebben. */
    function parseNum(s) {
        if (typeof s === 'number') return s;
        const c = String(s).trim().replace(/\s/g, '').replace('−', '-').replace(',', '.');
        return c === '' || c === '-' ? NaN : Number(c);
    }

    root.I18N = {
        t, has, fmt, fmtAuto, parseNum,
        get lang() { return lang; },
        setLang(l) { lang = DICTS[l] ? l : 'nl'; },
        languages: Object.keys(DICTS)
    };
})(typeof self !== 'undefined' ? self : this);
