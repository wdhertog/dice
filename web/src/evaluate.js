// Turns raw die results into a headline + details for the result panel.
// rolls: [{ group, value, label, type }]  (group = index into groups)

function yahtzee(values) {
  const counts = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const c = Object.values(counts).sort((a, b) => b - a);
  const uniq = [...new Set(values)].sort((a, b) => a - b).join('');
  const sum = values.reduce((a, b) => a + b, 0);
  if (c[0] === 5) return { headline: 'YAHTZEE!', sub: '50 punten', celebrate: true };
  if (uniq === '12345' || uniq === '23456') return { headline: 'Grote straat', sub: '40 punten', celebrate: true };
  if (['1234', '2345', '3456'].some((s) => uniq.includes(s))) return { headline: 'Kleine straat', sub: '30 punten' };
  if (c[0] === 3 && c[1] === 2) return { headline: 'Full house', sub: '25 punten' };
  if (c[0] === 4) return { headline: 'Carré', sub: `${sum} punten` };
  if (c[0] === 3) return { headline: 'Three of a kind', sub: `${sum} punten` };
  return { headline: `${sum}`, sub: 'Kans' };
}

export function evaluate(preset, rolls) {
  const groups = preset.groups.map((g, i) => ({
    ...g,
    rolls: rolls.filter((r) => r.group === i),
  }));
  const values = rolls.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const marks = new Map(); // roll -> 'win' | 'lose' | 'drop'
  let headline = String(sum);
  let sub = rolls.length > 1 ? 'Totaal' : '';
  let celebrate = false;

  switch (preset.mode) {
    case 'yahtzee':
      ({ headline, sub, celebrate = false } = yahtzee(values));
      groups.forEach((g) => g.rolls.sort((a, b) => a.value - b.value));
      break;
    case 'risk': {
      const att = [...groups[0].rolls].sort((a, b) => b.value - a.value);
      const def = [...groups[1].rolls].sort((a, b) => b.value - a.value);
      let attLoss = 0;
      let defLoss = 0;
      for (let i = 0; i < Math.min(att.length, def.length); i++) {
        if (att[i].value > def[i].value) {
          defLoss++;
          marks.set(att[i], 'win');
          marks.set(def[i], 'lose');
        } else {
          attLoss++;
          marks.set(att[i], 'lose');
          marks.set(def[i], 'win');
        }
      }
      groups[0].rolls = att;
      groups[1].rolls = def;
      headline = defLoss > attLoss ? 'Aanval wint' : attLoss > defLoss ? 'Verdediging wint' : 'Gelijkspel';
      sub = `Aanvaller verliest ${attLoss} · Verdediger verliest ${defLoss}`;
      break;
    }
    case 'advantage': {
      const hi = Math.max(...values);
      const lo = Math.min(...values);
      headline = `${hi} / ${lo}`;
      sub = `Voordeel: ${hi} · Nadeel: ${lo}`;
      celebrate = hi === 20;
      break;
    }
    case 'dropLowest': {
      const sorted = [...rolls].sort((a, b) => a.value - b.value);
      marks.set(sorted[0], 'drop');
      headline = String(sum - sorted[0].value);
      sub = `Laagste (${sorted[0].value}) valt af`;
      break;
    }
    case 'percent':
      headline = `${sum}%`;
      sub = '';
      break;
    case 'list':
      headline = '';
      sub = 'Elke dobbelsteen afzonderlijk';
      break;
    default:
      if (rolls.length === 1 && rolls[0].type === 'd20') {
        if (sum === 20) sub = 'Natural 20!';
        if (sum === 1) sub = 'Natural 1…';
        celebrate = sum === 20;
      }
  }
  return { headline, sub, celebrate, groups, marks, list: preset.mode === 'list', showGroupSums: preset.groups.length > 1 && preset.mode === 'sum' };
}
