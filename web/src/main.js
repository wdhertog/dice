import { DiceWorld } from './dice/world.js';
import { DIE_TYPES } from './dice/geometry.js';
import { skinPreview } from './dice/textures.js';
import { allSkins, getSkin } from './skins/index.js';
import { PRESETS } from './presets.js';
import { evaluate } from './evaluate.js';
import { native } from './native.js';
import { audio, clack, rattle, unlockAudio } from './audio.js';

const MAX_DICE = 30;
const $ = (id) => document.getElementById(id);

// ---------- persisted state ----------
const STORE_KEY = 'dobbelstenen.v1';
const defaults = {
  preset: PRESETS.find((p) => p.id === 'two'),
  skin: 'classic',
  custom: [],
  sound: true,
  vibrate: true,
  hold: 20,
};
let state = { ...defaults };
try {
  state = { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
} catch {
  /* storage unavailable */
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
audio.enabled = state.sound;
native.vibrationEnabled = state.vibrate;

// ---------- world ----------
let lastImpactBuzz = 0;
const world = new DiceWorld($('tray'), {
  onImpact(v, kind) {
    clack(v, kind);
    const now = performance.now();
    if (v > 9 && now - lastImpactBuzz > 120) {
      lastImpactBuzz = now;
      native.vibrate(12);
    }
  },
});

function updateInsets() {
  world.setInsets($('topbar').offsetHeight, $('result').offsetHeight);
}
window.addEventListener('resize', updateInsets);

let phase = 'idle'; // idle | rolling | result
let lockUntil = 0;

function describe(preset) {
  return preset.groups.map((g) => `${g.count}× ${g.type === 'd100' ? 'd%' : g.type}`).join(' + ');
}

function applyPreset(preset) {
  state.preset = JSON.parse(JSON.stringify(preset));
  save();
  $('presetName').textContent = preset.name;
  $('presetSub').textContent = describe(preset);
  const list = [];
  preset.groups.forEach((g, gi) => {
    for (let i = 0; i < g.count; i++) list.push({ type: g.type, skin: g.skin || state.skin, group: gi });
  });
  world.setDice(list);
  phase = 'idle';
  lockUntil = 0;
  showIdle();
  renderPresetList();
}

// ---------- result panel ----------
function showIdle() {
  $('headline').textContent = 'Schud om te gooien';
  $('resultSub').textContent = '';
  $('headline').className = 'headline';
  $('headline').parentElement.classList.add('idle');
  $('chips').innerHTML = '';
  updateStatus();
}

function chip(roll, mark) {
  const d = world.dice[roll.index];
  const skin = getSkin(d.skin);
  const el = document.createElement('div');
  el.className = `chip ${mark || ''}`;
  el.style.background = skin.base;
  el.style.color = skin.ink;
  el.innerHTML = `${roll.label}${roll.type !== 'd6' || world.dice.some((o) => o.type !== 'd6') ? `<small>${roll.type === 'd100' ? 'd%' : roll.type}</small>` : ''}`;
  return el;
}

let lastRolls = null;
function renderChipsAgain() {
  if (lastRolls) showResult(lastRolls, true);
}

function showResult(rolls, quiet = false) {
  lastRolls = rolls;
  const preset = state.preset;
  const res = evaluate(preset, rolls);
  const main = $('headline').parentElement;
  main.classList.remove('idle');
  $('headline').textContent = res.headline;
  $('headline').className = `headline${res.celebrate && !quiet ? ' celebrate' : ''}`;
  $('resultSub').textContent = res.sub;
  const chips = $('chips');
  chips.innerHTML = '';
  chips.classList.toggle('compact', rolls.length > 6 && !res.list);
  chips.classList.toggle('big', res.list);
  main.classList.toggle('slim', !res.headline);
  let delay = 0;
  for (const g of res.groups) {
    if (!g.rolls.length) continue;
    const box = document.createElement('div');
    box.className = 'group';
    if (g.label) {
      const l = document.createElement('div');
      l.className = 'group-label';
      l.textContent = g.label;
      box.appendChild(l);
    }
    for (const r of g.rolls) {
      const c = chip(r, res.marks.get(r));
      if (quiet) c.style.animation = 'none';
      c.style.animationDelay = `${delay}ms`;
      delay += 40;
      box.appendChild(c);
    }
    if (res.showGroupSums && g.rolls.length > 1) {
      const s = document.createElement('div');
      s.className = 'group-sum';
      s.textContent = `= ${g.rolls.reduce((a, r) => a + r.value, 0)}`;
      box.appendChild(s);
    }
    chips.appendChild(box);
  }
}

function updateStatus() {
  const status = $('status');
  const ring = $('ringFg');
  const text = $('statusText');
  const C = 94.25;
  if (phase === 'rolling') {
    status.classList.remove('ready');
    ring.style.strokeDashoffset = C;
    text.textContent = 'Rollen…';
    return;
  }
  const left = Math.max(0, lockUntil - Date.now());
  if (phase === 'result' && left > 0) {
    status.classList.remove('ready');
    ring.style.strokeDashoffset = String(C * (left / (state.hold * 1000)));
    text.textContent = `Nieuwe worp mogelijk over ${Math.ceil(left / 1000)} s`;
  } else {
    status.classList.add('ready');
    text.textContent = phase === 'result' ? 'Schud om opnieuw te gooien' : 'Schud je telefoon om te gooien';
  }
}
setInterval(updateStatus, 250);

// ---------- rolling ----------
async function roll(strength) {
  if (phase === 'rolling' || !world.dice.length) return;
  if (phase === 'result' && Date.now() < lockUntil) {
    const s = $('status');
    s.classList.remove('nudge');
    void s.offsetWidth;
    s.classList.add('nudge');
    return;
  }
  closeSheet();
  phase = 'rolling';
  updateStatus();
  native.vibrate(35);
  rattle();
  const raw = await world.throw(strength / 2.2);
  const rolls = raw.map((r) => ({ ...r, group: world.dice[r.index].group }));
  phase = 'result';
  lockUntil = Date.now() + state.hold * 1000;
  showResult(rolls);
  updateStatus();
  native.vibrate([0, 30, 70, 30]);
}

native.onShake((g) => {
  unlockAudio();
  if (!sheetOpen()) roll(g);
});
document.addEventListener('pointerdown', unlockAudio, { passive: true });

// ---------- sheet ----------
const sheet = $('sheet');
const backdrop = $('backdrop');
function sheetOpen() {
  return !sheet.classList.contains('hidden');
}
function openSheet(tab) {
  selectTab(tab);
  loadEditor(state.preset.groups);
  sheet.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}
function closeSheet() {
  sheet.classList.add('hidden');
  backdrop.classList.add('hidden');
}
function selectTab(tab) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.tab !== tab));
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
$('presetBtn').addEventListener('click', () => openSheet('dice'));
$('menuBtn').addEventListener('click', () => openSheet('skins'));
backdrop.addEventListener('click', closeSheet);
// Android back button
window.__onBack = () => {
  if (sheetOpen()) {
    closeSheet();
    return true;
  }
  return false;
};

function renderPresetList() {
  const list = $('presetList');
  list.innerHTML = '';
  const all = [...state.custom, ...PRESETS];
  for (const p of all) {
    const b = document.createElement('button');
    b.className = `preset${state.preset && state.preset.id === p.id ? ' active' : ''}`;
    b.innerHTML = `<b></b><span></span>`;
    b.querySelector('b').textContent = p.name;
    b.querySelector('span').textContent = p.custom ? describe(p) : p.sub || describe(p);
    b.addEventListener('click', () => {
      applyPreset(p);
      closeSheet();
    });
    if (p.custom) {
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Verwijderen');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        state.custom = state.custom.filter((c) => c.id !== p.id);
        save();
        renderPresetList();
      });
      b.appendChild(del);
    }
    list.appendChild(b);
  }
}

// ---------- custom editor ----------
let editorGroups = [];
function loadEditor(groups) {
  editorGroups = groups.map((g) => ({ type: g.type, count: g.count, skin: g.skin || '' }));
  renderEditor();
}
function totalDice() {
  return editorGroups.reduce((a, g) => a + g.count, 0);
}
function renderEditor() {
  const ed = $('editor');
  ed.innerHTML = '';
  editorGroups.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'erow';
    const type = document.createElement('select');
    type.className = 'type';
    DIE_TYPES.forEach((t) => type.add(new Option(t === 'd100' ? 'd%' : t, t, false, t === g.type)));
    type.addEventListener('change', () => (g.type = type.value));

    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    const minus = document.createElement('button');
    minus.textContent = '−';
    const out = document.createElement('output');
    out.textContent = g.count;
    const plus = document.createElement('button');
    plus.textContent = '+';
    minus.addEventListener('click', () => {
      g.count = Math.max(1, g.count - 1);
      out.textContent = g.count;
    });
    plus.addEventListener('click', () => {
      if (totalDice() >= MAX_DICE) return;
      g.count = Math.min(MAX_DICE, g.count + 1);
      out.textContent = g.count;
    });
    stepper.append(minus, out, plus);

    const skin = document.createElement('select');
    skin.className = 'skin';
    skin.add(new Option('Thema', '', false, !g.skin));
    allSkins().forEach((s) => skin.add(new Option(s.name, s.id, false, s.id === g.skin)));
    skin.addEventListener('change', () => (g.skin = skin.value));

    const rm = document.createElement('button');
    rm.className = 'remove';
    rm.textContent = '×';
    rm.setAttribute('aria-label', 'Verwijderen');
    rm.addEventListener('click', () => {
      if (editorGroups.length > 1) {
        editorGroups.splice(i, 1);
        renderEditor();
      }
    });
    row.append(type, stepper, skin, rm);
    ed.appendChild(row);
  });
}
$('addGroup').addEventListener('click', () => {
  if (totalDice() >= MAX_DICE) return;
  editorGroups.push({ type: 'd6', count: 1, skin: '' });
  renderEditor();
});
function editorPreset(name) {
  const groups = editorGroups.map((g) => ({ type: g.type, count: g.count, ...(g.skin ? { skin: g.skin } : {}) }));
  return { id: `custom-${Date.now()}`, name: name || 'Eigen combinatie', groups, mode: 'sum', custom: true };
}
$('useCustom').addEventListener('click', () => {
  const p = editorPreset($('customName').value.trim());
  p.custom = false; // not saved in the list
  applyPreset(p);
  closeSheet();
});
$('saveCustom').addEventListener('click', () => {
  const p = editorPreset($('customName').value.trim() || describe({ groups: editorGroups }));
  state.custom.unshift(p);
  $('customName').value = '';
  applyPreset(p);
});

// ---------- skins ----------
function renderSkins() {
  const grid = $('skinGrid');
  grid.innerHTML = '';
  for (const s of allSkins()) {
    const b = document.createElement('button');
    b.className = `skin${s.id === state.skin ? ' active' : ''}`;
    const img = new Image();
    img.src = skinPreview(s.id);
    b.append(img, document.createTextNode(s.name));
    b.addEventListener('click', () => {
      state.skin = s.id;
      save();
      renderSkins();
      world.restyle(world.dice.map((d) => state.preset.groups[d.group].skin || s.id));
      if (phase === 'result') renderChipsAgain();
    });
    grid.appendChild(b);
  }
}

// ---------- settings ----------
$('optSound').checked = state.sound;
$('optVibrate').checked = state.vibrate;
$('optHold').value = state.hold;
$('holdVal').textContent = state.hold;
$('optSound').addEventListener('change', (e) => {
  state.sound = audio.enabled = e.target.checked;
  save();
});
$('optVibrate').addEventListener('change', (e) => {
  state.vibrate = native.vibrationEnabled = e.target.checked;
  save();
  if (state.vibrate) native.vibrate(30);
});
$('optHold').addEventListener('input', (e) => {
  state.hold = Math.max(20, Number(e.target.value));
  $('holdVal').textContent = state.hold;
  save();
});

// ---------- start ----------
updateInsets();
renderSkins();
applyPreset(state.preset);
window.__dice = { roll, world }; // handy for debugging
