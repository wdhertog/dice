# Dobbelstenen

Android-app met geanimeerde 3D-dobbelstenen. Schud je telefoon om te gooien; het
resultaat blijft minimaal 20 seconden staan (schudden wordt in die tijd genegeerd).

## Downloaden

Elke push naar `main` bouwt automatisch een APK via GitHub Actions en publiceert die als
release: **[nieuwste versie](https://github.com/wdhertog/dice/releases/latest)**.
Open de `.apk` op je telefoon. Als Android erom vraagt, sta "installeren uit onbekende bronnen"
toe. Nieuwe versies installeer je gewoon over de oude heen.

## Functies

- 3D-dobbelstenen met physics: d4, d6, d8, d10, d12, d20 en d% (d100)
- Gooien door te schudden, met trillen en geluid
- Resultaat blijft minimaal 20 seconden staan (in te stellen tot 60 s); het scherm blijft aan
- Snelkeuzes: 1 of 2 dobbelstenen, Yahtzee (herkent de combinaties), Risk (rekent uit wie
  legers verliest), 10.000/Farkle, D&D (d20, voordeel/nadeel, complete set, eigenschap 4d6,
  Fireball 8d6, percentage)
- Eigen combinaties: kies soort, aantal en kleur per groep, en sla ze op
- Thema's: Klassiek, Robijn, Saffier, Smaragd, Onyx & goud, Marmer, Hout, Neon,
  Sterrenstelsel, Amethist (glas)

## Opbouw

```
app/                 Android-wrapper (Java): WebView, schuddetectie, trillen, scherm aan
web/                 De eigenlijke app (three.js + cannon-es)
  src/main.js        UI en spelverloop
  src/presets.js     Snelkeuzes
  src/evaluate.js    Uitleg van het resultaat (Yahtzee, Risk, ...)
  src/dice/          Geometrie, texturen en physics van de dobbelstenen
  src/skins/         Thema's
.github/workflows/   Bouwt de APK en maakt een release
```

## Een eigen thema (skin) toevoegen

Voeg een object toe aan `web/src/skins/builtin.js` (of maak een nieuw bestand naar het
voorbeeld van `classic.js` en registreer het in `skins/index.js`):

```js
{
  id: 'oranje',
  name: 'Oranje',
  base: '#ff7a00',          // kleur van de vlakken
  ink: '#ffffff',           // kleur van cijfers en ogen
  pattern(ctx, w, h, rnd) { /* optioneel: teken een achtergrond op de canvas */ },
  material: { roughness: 0.3, clearcoat: 1 },  // opties voor THREE.MeshPhysicalMaterial
  // optioneel: inkMetal: true (metalen cijfers), glow: '#0f0' (oplichtende cijfers),
  //            alpha: 0.6 (doorzichtig), pips: false (cijfers i.p.v. ogen op d6),
  //            font: 'Georgia, serif'
}
```

Een afbeelding als textuur kan ook: laad die vooraf (`new Image()`) en teken hem in
`pattern()` met `ctx.drawImage(...)`.

## Zelf bouwen

Benodigd: Node.js 20+, JDK 17 en de Android SDK.

```bash
cd web && npm ci && cd ..
./gradlew assembleRelease      # bouwt eerst de web-app, daarna de APK
```

De APK staat dan in `app/build/outputs/apk/release/`.

Snel testen in de browser: `cd web && npm run serve` en open http://localhost:8000.
Druk op spatie om te gooien.

## Ondertekening

Zonder extra instellingen wordt de APK ondertekend met `app/keystore/dice-public.jks`.
Die sleutel staat openbaar in de repo, dus hij is niet geheim; het zorgt er alleen voor dat
updates over elkaar heen te installeren zijn. Wil je een eigen, geheime sleutel, voeg dan
deze repository-secrets toe: `DICE_KEYSTORE_BASE64` (keystore als base64),
`DICE_KEYSTORE_PASSWORD`, `DICE_KEY_ALIAS` en `DICE_KEY_PASSWORD`. Let op: na het wisselen van
sleutel moet je de app één keer verwijderen en opnieuw installeren.
