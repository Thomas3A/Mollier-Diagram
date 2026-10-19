# Klimaatdata voor de energieberekening van de LBK

De tab **Energieverbruik** rekent een luchtbehandelingskast uur voor uur door over een klimaatjaar
(8760 uur). De klimaatjaren zijn een reconstructie op basis van open KNMI-data van De Bilt;
**geen officiële NEN 5060-data**.

## Bestanden

| Bestand | Inhoud | Gebruik |
|---|---|---|
| `data/klimaat/referentiejaren.js` | Vijf referentiejaren (`energie`, `T5`, `T1`, `winter1979`, `winter1963`): 8760 uurwaarden T (0,1 °C), RV (%), wind (0,1 m/s), globale straling (W/m²) + metadata en statistiek | runtime (lazy) |
| `data/klimaat/knmi-debilt-1951-2025.js` | Werkelijke jaren 1951–2025, alleen T (0,1 °C), 8760 uur per jaar, weekdag van 1 januari, statistiek, aanbevolen stresstestjaren | runtime (lazy, ≈ 2,3 MB) |
| `docs/klimaat/statistiek_jaren.csv` | Statistiek per referentiejaar en per werkelijk jaar | documentatie |
| `docs/klimaat/winterstatistiek_1951_2025.csv` | Per stookseizoen (1 nov – 31 mrt, 1951/52 – 2024/25): Hellmann-getal, T min, uren < −5/−10 °C, koudste 24/72/168/336/720 uur | documentatie |

De `.js`-bestanden zijn de oorspronkelijke JSON-bestanden (`referentiejaren.json`,
`knmi-debilt-1951-2025.json`) verpakt als script, zodat de site zonder server en zonder build-stap werkt
(ook vanaf `file://`). In Node levert `require()` het JSON-object op. Opnieuw verpakken:

```bash
node scripts/klimaat/wrap-json.js referentiejaren.json data/klimaat/referentiejaren.js referentiejaren
node scripts/klimaat/wrap-json.js knmi-debilt-1951-2025.json data/klimaat/knmi-debilt-1951-2025.js knmi
```

Tijdas: MET (UTC+1) zonder zomertijd; uurindex 0 = 1 januari 00:00–01:00. Referentiejaren beginnen op een
maandag en tellen 365 dagen (29 februari weggelaten). Werkelijke jaren beginnen op hun echte weekdag
(`meta.startWeekdag`, ISO: 1 = maandag), zodat het weekpatroon op echte weekdagen valt. Feestdagen worden
genegeerd.

## Herkomst

- **Bron:** KNMI, uurgegevens van station 260 De Bilt via
  `https://www.daggegevens.knmi.nl/klimatologie/uurgegevens` (open data; bronvermelding "KNMI"). KNMI levert
  uurvakken in UT; bij het inlezen is één uur opgeschoven naar MET.
- **NEN-referentiejaren (`energie`, `T5`, `T1`):** NEN 5060:2018 stelt haar referentiejaren samen uit
  werkelijke kalendermaanden van De Bilt uit 1996–2015 (energiejaar; ontwerpjaren T1 = 1 % en T5 = 5 %
  overschrijdingskans). De uurdata van NEN zijn niet vrij; daarom is per maand de werkelijke maand gekozen
  waarvan het maandgemiddelde overeenkomt met de gepubliceerde maandgemiddelden (W/E-rapport 9604, RVO,
  april 2018, tabel 4). De reconstructie wijkt per maand maximaal 0,05 K af van de NEN-tabel.
  Maandovergangen zijn over 16 uur vloeiend gemaakt.
- **Stresstestjaren (`winter1979`, `winter1963`):** het T1-jaar waarin het complete werkelijke stookseizoen
  1 november – 31 maart is vervangen door dat van 1978/79 (strenge winter, ≈ 1× per 25 jaar in 1951–2025)
  resp. 1962/63 (extreme winter, ≈ 1× per eeuw). Herhalingstijden zijn empirisch en in het huidige klimaat
  eerder langer.

Bronjaar per maand (jan … dec):

| Jaar | jan | feb | mrt | apr | mei | jun | jul | aug | sep | okt | nov | dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| energie | 2001 | 2004 | 2004 | 2002 | 2000 | 2011 | 2008 | 2001 | 2011 | 2010 | 2003 | 2003 |
| T5 | 2013 | 1996 | 2013 | 1996 | 2006 | 2011 | 2013 | 1997 | 1999 | 2001 | 1999 | 2009 |
| T1 | 1997 | 1996 | 2005 | 2007 | 1998 | 2006 | 2006 | 2003 | 2011 | 2011 | 2010 | 2010 |
| winter1979 | 1979 | 1979 | 1979 | 2007 | 1998 | 2006 | 2006 | 2003 | 2011 | 2011 | 1978 | 1978 |
| winter1963 | 1963 | 1963 | 1963 | 2007 | 1998 | 2006 | 2006 | 2003 | 2011 | 2011 | 1962 | 1962 |

## Gebruik in de LBK-berekening

- **Referentiejaren:** buitentemperatuur T en relatieve vochtigheid RV per uur; het vochtgehalte x volgt uit
  T, RV en de luchtdruk van het project (ASHRAE 2017).
- **Werkelijke jaren 1951–2025:** alleen de temperatuur is gemeten. Het vochtgehalte wordt benaderd met het
  uurlijkse vochtgehalte van het energiejaar op hetzelfde uur, begrensd op verzadiging bij de werkelijke
  temperatuur (x ≤ x_s(T)). Daardoor zijn de latente koellast en de bevochtiging bij werkelijke jaren
  indicatief; de verwarmings- en ventilatorenergie zijn er nauwelijks gevoelig voor.
- **Advies:** het energiejaar voor het jaarverbruik; T1 en de stresstestjaren om te controleren hoe vaak een
  bestaande LBK zijn eisen niet haalt (uren met te koude toevoerlucht).

## Reproduceren

```bash
scripts/klimaat/download_knmi.sh knmi_raw 1951 2025            # ±30 MB, 75 bestanden
python3 -I scripts/klimaat/parse_knmi.py knmi_raw knmi.npz      # vereist numpy
python3 -I scripts/klimaat/build_reference_years.py knmi.npz out/                  # schrijft JSON + CSV
python3 -I scripts/klimaat/winter_stats.py knmi.npz out/referentiejaren.json out/winterstatistiek_1951_2025.csv
```

Daarna de JSON-bestanden verpakken met `scripts/klimaat/wrap-json.js` (zie boven).
