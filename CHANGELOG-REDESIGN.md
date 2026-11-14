# Redesign change log

## 2026-11-14 — Identity pass (navigation, buttons, settings glyph)

- Phase: tokens, base, navigation. Behaviour change: no.
- Tokens moved to `app/styles/tokens.css`. Terracotta kept. Mangrove was not applied. Pending owner decision 1, default used: keep terracotta.
- Desktop rail default is collapsed at 72px and expands to 232px on hover or focus. Pending owner decision 2, default used: collapsed.
- Search stays in the top bar. Pending owner decision 3.
- Settings glyph no longer rotates. Pending owner decision 4, default used: no rotation. The sun-shaped mark was replaced with a gear outline.
- Tablet and desktop share the vertical bar from 768px. Pending owner decision 6, default used: icon rail from 768px.
- The plain left column (`.orbit-rail`) is gone. The sculpted bar is one component, horizontal on a phone and vertical from 768px, and it stays on every signed-in screen. Study links that were only in that column are still on the Study page, the menu, and search.
- Browser-default blue links are reset. `.btn` and `.btn.accent` keep their names. Accent buttons are now the filled terracotta primary.
- `lib/tabs.js` gained `barPathVertical` only. Existing bar maths is unchanged.

## 2026-11-14 — Screens: Today, Study, Journal, Recall, Progress, Settings

- Phase: screens. Behaviour change: no.
- Today leads with the topic. Log what I learned sits with Swap. Study and Resonance leave the heading and stay in the bar and the Study hub. The field chooser sits under “Choose today’s topic”. Reviews show a count. Rings stay open, below reviews, because the calendar lives inside them.
- Study is four groups from the existing hub list. Nothing was dropped. The unsent Attention draft note stays on that card.
- Settings order is Profile, Appearance, Sound, Journal, Assist, Study, Trial mode, Backups, Storage, Help, Reset, Delete. Trial mode sits after Study. Pending owner decision 5, default used: after Study.
- Journal explains Learn and Reflect in one line. The same choice sits beside the timer and is blocked while it runs. The save button reads “Save entry”.
- Recall still scores the same way. The result also says Correct, Partly correct, or Not yet from that score.
- Progress shows the streak and the award count as numerals. Every progress link remains.
- Not changed: database, grading providers, selection rules, timers’ stored minutes, Topics mark logic.

## 2026-11-14 — Closing pass

- Phase: screens. Behaviour change: no.
- Today shows the learning timer and the reflection timer together. Daily rings and the calendar sit in one closed section under them. Opening that section is the only extra step.
- Topics keeps every filter. On a wide screen each field is a table: topic, section and level, mark. Phone stays a list.
- Settings is one quiet list. Under the hood is a text link, not a second button. Sign out stays on its own row.
- Journal confidence sits on the same row as Save entry.
- Logs search and filters sit in one card. Awards uses the same numeral as Progress.
- Sign-in keeps the drawing. The form is a single card on top of it.

