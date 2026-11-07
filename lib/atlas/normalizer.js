// Turns wording into one key so the same idea is not stored twice.

const FOLDS = [
  ['neuroplasticity', 'neural plasticity', 'plasticity of the nervous system'],
  ['gradient descent', 'gradient-descent'],
];

export function normalizeName(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactName(raw) {
  return normalizeName(raw).replace(/[^a-z0-9]/g, '');
}

function foldKey(raw) {
  const compact = compactName(raw);
  const plain = normalizeName(raw);
  for (const group of FOLDS) {
    if (group.some(item => normalizeName(item) === plain || compactName(item) === compact)) {
      return compactName(group[0]);
    }
  }
  return compact;
}

export function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  const rows = Array.from({ length: s.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= t.length; j++) rows[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[s.length][t.length];
}

export function sameConcept(a, b) {
  const left = foldKey(a);
  const right = foldKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const longer = Math.max(left.length, right.length);
  if (longer < 10) return false;
  return 1 - levenshtein(left, right) / longer >= 0.9;
}

export function canonicalKey(raw) {
  return foldKey(raw);
}

export function contentWords(text) {
  return normalizeName(text).split(' ').filter(word => word.length > 3);
}
