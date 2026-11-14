# Redesign change log

## 2026-11-14 — Identity pass (navigation, buttons, settings glyph)

- Phase: tokens, base, navigation. Behaviour change: no.
- Tokens moved to `app/styles/tokens.css`. Terracotta kept. Mangrove was not applied. Pending owner decision 1, default used: keep terracotta.
- Desktop rail default is collapsed at 72px and expands to 232px on hover or focus. Pending owner decision 2, default used: collapsed.
- Search stays in the top bar. Pending owner decision 3.
- Settings glyph no longer rotates. Pending owner decision 4, default used: no rotation. The sun-shaped mark was replaced with a gear outline.
- Trial mode already sits first in Settings, which is more visible than "after Study". Left there. Pending owner decision 5.
- Tablet and desktop share the vertical bar from 768px. Pending owner decision 6, default used: icon rail from 768px.
- The plain left column (`.orbit-rail`) is gone. The sculpted bar is one component, horizontal on a phone and vertical from 768px, and it stays on every signed-in screen. Study links that were only in that column are still on the Study page, the menu, and search.
- Browser-default blue links are reset. `.btn` and `.btn.accent` keep their names. Accent buttons are now the filled terracotta primary.
- `lib/tabs.js` gained `barPathVertical` only. Existing bar maths is unchanged.
- Not in this pass: rebuilding Today, Journal, Topics, Study, Progress and Settings layouts screen by screen. Logic in `lib/` was not changed.
