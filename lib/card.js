// Draws the progress card on a canvas and returns it as a PNG Blob.
// The rings use the same values as the Today and Stats rings.
const pct = v => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
const FONT = '-apple-system, Helvetica, Arial, sans-serif';

export function progressCardBlob({ name, date, streak, words, entries, rings }) {
  const size = 1080;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');

  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);

  const cx = 540;
  const cy = 470;
  const radii = [300, 232, 164];
  const colors = ['#c4623d', '#3b7a6a', '#5a6bb5'];
  const values = [rings.study, rings.journal, rings.review];

  radii.forEach((r, i) => {
    g.lineCap = 'round';
    g.lineWidth = 46;
    g.strokeStyle = '#f1eee9';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    const v = Math.max(0, Math.min(1, values[i]));
    if (v > 0) {
      g.strokeStyle = colors[i];
      g.beginPath();
      g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
      g.stroke();
    }
  });

  g.textAlign = 'center';
  g.fillStyle = '#1c1b19';
  g.font = `600 72px ${FONT}`;
  g.fillText(String(streak), cx, cy + 22);
  g.font = `400 30px ${FONT}`;
  g.fillStyle = '#8a867f';
  g.fillText(streak === 1 ? 'day streak' : 'day streak', cx, cy + 66);

  const shownName = String(name || 'Orbit learner').slice(0, 28);
  g.fillStyle = '#1c1b19';
  g.font = `600 58px ${FONT}`;
  g.fillText(shownName, cx, 880);

  g.fillStyle = '#8a867f';
  g.font = `400 34px ${FONT}`;
  g.fillText(`${Number(words).toLocaleString()} words · ${entries} entries`, cx, 938);
  g.fillText(`Study ${pct(values[0])} · Journal ${pct(values[1])} · Review ${pct(values[2])}`, cx, 990);
  g.fillText(`Orbit · ${date}`, cx, 1040);

  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}
