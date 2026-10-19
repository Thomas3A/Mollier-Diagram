#!/usr/bin/env node
/**
 * wrap-json.js — zet een klimaat-JSON om naar een UMD-script voor de browser.
 *
 * De site heeft geen build-stap en moet ook vanaf file:// werken; fetch() van JSON kan dat niet,
 * een <script>-tag wel. In Node levert require() van het resultaat het JSON-object op.
 *
 * Gebruik: node scripts/klimaat/wrap-json.js <invoer.json> <uitvoer.js> <sleutel>
 *   sleutel = naam onder window.KlimaatData (bijv. referentiejaren, knmi)
 */
'use strict';
const fs = require('fs');

const [src, dst, key] = process.argv.slice(2);
if (!src || !dst || !/^[a-z][a-z0-9]*$/i.test(key || '')) {
    console.error('Gebruik: node scripts/klimaat/wrap-json.js <invoer.json> <uitvoer.js> <sleutel>');
    process.exit(1);
}
const data = JSON.parse(fs.readFileSync(src, 'utf8'));          // valideert en compacteert
const head = `/* Klimaatdata KNMI De Bilt (open data, bron: KNMI) — zie docs/klimaat/README.md.\n`
    + `   Gegenereerd met scripts/klimaat/wrap-json.js uit ${src.split(/[\\/]/).pop()}; niet met de hand bewerken. */\n`;
const body = `(function (root, data) {\n`
    + `    if (typeof module === 'object' && module.exports) module.exports = data;\n`
    + `    else (root.KlimaatData = root.KlimaatData || {}).${key} = data;\n`
    + `})(typeof self !== 'undefined' ? self : this, ${JSON.stringify(data)});\n`;
fs.writeFileSync(dst, head + body);
console.log(`${dst}: ${(fs.statSync(dst).size / 1024).toFixed(0)} kB`);
