# Startprompt voor Claude Code

Plak dit in Claude Code, in de root van de repo `thomas3a/Mollier-Diagram`, nadat je de map `docs/ewf/` en `test/fixtures/` hebt toegevoegd:

---

Lees `docs/ewf/SPEC.md` volledig en bouw de Earth, Wind & Fire-module precies volgens die specificatie.

- Werk op een nieuwe branch en volg de fasen uit §13. Begin met fase 1 (rekenkern + tests) en ga pas door naar de volgende fase als `npm test` groen is.
- Gebruik `docs/ewf/ewf_prototype.py` en `test/fixtures/ewf-oracle.json` als referentie voor de fysica. Je JavaScript moet binnen de toleranties van §12 dezelfde uitkomsten geven.
- Bestaande functionaliteit (Mollier-diagram, deellinks `#p=…`, opslaan/openen, ongedaan maken, thema's) mag niet breken.
- Commit per fase en open aan het eind een pull request met per fase een korte samenvatting, de gemaakte keuzes en de openstaande punten.
