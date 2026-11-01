// In-app editor for custom skins. Skins are stored as plain JSON (see
// skinFromData in skins/index.js) so they can be shared as text.
import { registerSkin, skinFromData } from './skins/index.js';
import { PATTERNS } from './skins/patterns.js';
import { skinPreview, facePreview } from './dice/textures.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_ID = '__preview';

function glossLabel(g) {
  if (g < 0.15) return 'mat';
  if (g < 0.5) return 'zijdeglans';
  if (g < 0.8) return 'glanzend';
  return 'hoogglans';
}

/** Scales a photo down to a square-ish JPEG data URL (keeps storage small). */
function loadPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 384;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function initSkinEditor({ selectTab, saveSkin, deleteSkin }) {
  let draft = null;
  let isNew = true;

  const sel = $('sePattern');
  for (const [id, p] of Object.entries(PATTERNS)) sel.add(new Option(p.name, id));

  let previewTimer = 0;
  function refreshPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const skin = await skinFromData({ ...draft, id: PREVIEW_ID });
      registerSkin(skin);
      $('skinPrev6').src = skinPreview(PREVIEW_ID, 168);
      $('skinPrev20').src = facePreview(PREVIEW_ID, 'd20', 168);
    }, 60);
  }

  function fill() {
    $('seName').value = draft.name;
    $('seBase').value = draft.base;
    $('seInk').value = draft.ink;
    $('sePattern').value = draft.pattern || 'none';
    $('seGloss').value = draft.gloss;
    $('seGlossVal').textContent = glossLabel(draft.gloss);
    $('seMetal').checked = !!draft.inkMetal;
    $('seGlow').checked = !!draft.glow;
    $('seAlpha').checked = !!draft.alpha;
    $('sePips').checked = draft.pips !== false;
    $('sePhotoClear').classList.toggle('hidden', !draft.image);
    $('sePhoto').textContent = draft.image ? 'Andere foto' : 'Kies foto';
    $('seDelete').classList.toggle('hidden', isNew);
    $('seShare').classList.toggle('hidden', isNew);
    $('skinEditorTitle').textContent = isNew ? 'Nieuwe skin' : 'Skin bewerken';
    $('shareBox').classList.add('hidden');
    refreshPreview();
  }

  const bind = (id, ev, fn) =>
    $(id).addEventListener(ev, (e) => {
      fn(e.target);
      fill();
    });
  bind('seName', 'input', (t) => (draft.name = t.value));
  bind('seBase', 'input', (t) => (draft.base = t.value));
  bind('seInk', 'input', (t) => (draft.ink = t.value));
  bind('sePattern', 'change', (t) => (draft.pattern = t.value));
  bind('seGloss', 'input', (t) => (draft.gloss = Number(t.value)));
  bind('seMetal', 'change', (t) => (draft.inkMetal = t.checked));
  bind('seGlow', 'change', (t) => (draft.glow = t.checked));
  bind('seAlpha', 'change', (t) => (draft.alpha = t.checked ? 0.6 : 0));
  bind('sePips', 'change', (t) => (draft.pips = t.checked));

  $('sePhoto').addEventListener('click', () => $('sePhotoInput').click());
  $('sePhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      draft.image = await loadPhoto(file);
      fill();
    } catch {
      alert('Deze foto kon niet worden geladen.');
    }
  });
  $('sePhotoClear').addEventListener('click', () => {
    delete draft.image;
    fill();
  });

  $('seCancel').addEventListener('click', () => selectTab('skins'));
  $('seSave').addEventListener('click', () => {
    if (!draft.name.trim()) draft.name = 'Eigen skin';
    saveSkin(JSON.parse(JSON.stringify(draft)));
  });
  $('seDelete').addEventListener('click', () => {
    if (confirm(`Skin "${draft.name}" verwijderen?`)) deleteSkin(draft.id);
  });

  // Sharing as text
  $('seShare').addEventListener('click', () => {
    const { id, ...rest } = draft;
    $('shareText').value = JSON.stringify(rest);
    $('shareHint').textContent = 'Kopieer deze tekst en stuur hem naar iemand anders. Die kan hem plakken bij "Skin importeren".';
    $('shareImport').classList.add('hidden');
    $('shareCopy').classList.remove('hidden');
    $('shareBox').classList.remove('hidden');
  });
  $('shareCopy').addEventListener('click', async () => {
    const t = $('shareText');
    t.select();
    try {
      await navigator.clipboard.writeText(t.value);
    } catch {
      document.execCommand('copy');
    }
    $('shareCopy').textContent = 'Gekopieerd!';
    setTimeout(() => ($('shareCopy').textContent = 'Kopiëren'), 1500);
  });
  $('shareImport').addEventListener('click', () => {
    try {
      const data = JSON.parse($('shareText').value.trim());
      if (typeof data !== 'object' || !data.base) throw new Error('geen skin');
      const clean = {
        id: `u-${Date.now()}`,
        name: String(data.name || 'Geïmporteerd').slice(0, 24),
        base: String(data.base),
        ink: String(data.ink || '#000000'),
        pattern: PATTERNS[data.pattern] ? data.pattern : 'none',
        gloss: Math.min(1, Math.max(0, Number(data.gloss ?? 0.35))),
        inkMetal: !!data.inkMetal,
        glow: !!data.glow,
        alpha: data.alpha ? 0.6 : 0,
        pips: data.pips !== false,
        ...(typeof data.image === 'string' && data.image.startsWith('data:image/') ? { image: data.image } : {}),
      };
      saveSkin(clean);
    } catch {
      alert('Dit is geen geldige skin-tekst.');
    }
  });

  return {
    open(data) {
      isNew = !data;
      draft = data
        ? JSON.parse(JSON.stringify(data))
        : { id: `u-${Date.now()}`, name: '', base: '#e8562a', ink: '#ffffff', pattern: 'none', gloss: 0.35, pips: true };
      selectTab('skinEditor');
      fill();
    },
    openImport() {
      isNew = true;
      draft = { id: `u-${Date.now()}`, name: '', base: '#ffffff', ink: '#000000', pattern: 'none', gloss: 0.35, pips: true };
      selectTab('skinEditor');
      fill();
      $('shareText').value = '';
      $('shareHint').textContent = 'Plak hier de skin-tekst die je hebt gekregen.';
      $('shareCopy').classList.add('hidden');
      $('shareImport').classList.remove('hidden');
      $('shareBox').classList.remove('hidden');
      $('shareText').focus();
    },
  };
}
