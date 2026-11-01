# Skins maken

Er zijn twee manieren om een eigen skin (uiterlijk van de dobbelstenen) te maken.

## 1. In de app (geen programmeerkennis nodig)

1. Tik rechtsboven op het palet-icoon → tab **Thema** → **+ Eigen skin maken**.
2. Kies een naam, de kleur van de dobbelsteen, de kleur van de cijfers/ogen, een patroon
   (effen, spikkels, marmer, hout, sterren, wervels, strepen) en de glans (mat → hoogglans).
3. Optioneel:
   - **Eigen foto**: wordt op elk vlak van de dobbelsteen getoond (bijvoorbeeld een logo of
     een foto van je hond). De foto wordt verkleind en op de telefoon bewaard.
   - **Metalen cijfers** (zoals goud ingelegd), **oplichtende cijfers** (neon),
     **doorzichtig** (glas) en **ogen of cijfers** op de d6.
4. Bovenin zie je direct een voorbeeld van een d6 en een d20. Tik op **Opslaan**.

Bewerken of verwijderen: tik op het potloodje (✎) bij de skin.

**Delen**: open de skin met ✎ en tik op **Delen**. Je krijgt een stukje tekst dat je via
WhatsApp, mail en dergelijke kunt versturen. De ontvanger kiest **Thema → Skin importeren**
en plakt de tekst. (Met een foto erin is de tekst lang, maar dat werkt gewoon.)

## 2. In de code (wordt standaard meegeleverd in de app)

Skins staan in `web/src/skins/`. Een skin is een JavaScript-object. Voeg het toe aan de
lijst in `web/src/skins/builtin.js`:

```js
{
  id: 'oranje',             // uniek, zonder spaties
  name: 'Oranje',           // naam in de app
  base: '#ff7a00',          // kleur van de vlakken
  ink: '#ffffff',           // kleur van cijfers en ogen
  gloss: 0.35,              // 0 = mat, 0.35 = zijdeglans (standaard), 1 = hoogglans
  pattern: PATTERNS.marble.paint,  // optioneel, zie skins/patterns.js
}
```

Alle opties:

| Optie | Betekenis |
|---|---|
| `base`, `ink` | Kleur van de vlakken en van de cijfers/ogen (CSS-kleur) |
| `gloss` | Glans van 0 (mat) tot 1 (hoogglans); standaard 0.35 (zijdeglans) |
| `pattern(ctx, w, h, rnd)` | Functie die een achtergrond tekent op een canvas (zie hieronder) |
| `image` | Een geladen `Image` die op elk vlak wordt getekend |
| `edge` | Kleur van de vlakranden (geeft een afgeronde look), bv. `'rgba(0,0,0,0.2)'` |
| `font` | Lettertype van de cijfers, bv. `'Georgia, serif'` |
| `pips` | `false` = cijfers op de d6 in plaats van ogen |
| `inkMetal` | `true` = metalen cijfers |
| `glow` | Kleur waarmee de cijfers oplichten, bv. `'#39ff88'` |
| `alpha` | Doorzichtigheid van de dobbelsteen (0–1), de cijfers blijven dekkend |
| `material` | Extra opties voor `THREE.MeshPhysicalMaterial` (voor experts) |

### Een eigen patroon

Een patroon is een functie die op een canvas tekent, over de basiskleur heen. `rnd()` geeft
een willekeurig getal tussen 0 en 1, steeds in dezelfde volgorde, zodat de dobbelsteen er
altijd hetzelfde uitziet:

```js
pattern(ctx, w, h, rnd) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 300; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 2 + rnd() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

Herbruikbare patronen zet je in `web/src/skins/patterns.js`. Dan verschijnen ze ook
automatisch in de skin-editor van de app.

### Een afbeelding als textuur

Zet de afbeelding in `web/public/` (bijvoorbeeld `web/public/skins/logo.png`) en voeg in
`build.mjs` het kopiëren van die map toe. Laad hem en registreer de skin pas als hij geladen is:

```js
import { registerSkin } from './index.js';
const img = new Image();
img.onload = () => registerSkin({ id: 'logo', name: 'Logo', base: '#ffffff', ink: '#000000', image: img });
img.src = 'skins/logo.png';
```

### Testen en uitbrengen

- In de browser: `cd web && npm run serve`, open http://localhost:8000 en druk op spatie
  om te gooien.
- Push naar `main`: GitHub Actions bouwt dan automatisch een nieuwe APK.
