# Repository Guidelines

## Project Structure & Module Organization
- Root static PWA: `index.html` is the entry with forms/dialogs, `styles.css` holds layout + utility tokens, `main.js` contains data handlers and rendering, `sw.js` caches the shell, and `manifest.json` defines install metadata.
- Data is keyed by `carlog-data-v1` in `localStorage`; the service worker caches core assets for offline use after the first load.
- Docs live in `docs/` (`architecture.md`, `poc-plan.md`); update them when flows or storage shape change.

## Build, Test, and Development Commands
- `python -m http.server 8000` (from repo root) serves the static bundle; open `http://localhost:8000` for local dev. Avoid `file://` so the service worker can register.
- `npm install -g serve && serve .` is an alternative static host if you prefer Node.
- When changing the service worker, clear cached assets: DevTools → Application → Service Workers → “Unregister”, then hard refresh.

## Coding Style & Naming Conventions
- Plain JS/DOM; favor ES modules with `const`/`let`, arrow functions, and early returns.
- Two-space indentation, trailing semicolons (match `main.js`), camelCase for variables/fields, kebab-case for CSS classes.
- Keep functions small and pure where possible; centralize storage helpers near the top of `main.js`.
- HTML favors semantic tags (`section`, `header`, `footer`); align new markup/styles with existing card and grid patterns.

## Testing Guidelines
- No automated harness yet; run manual smoke tests for each change:
  - Add a vehicle, service record, and mileage entry; confirm dialogs and lists update.
  - Export JSON, refresh, then Import JSON; verify data round-trips.
  - Toggle the browser offline and reload; UI should load from cache and show stored data.
- If you add a test runner later, place specs under `tests/` (or `docs/examples/`) and document the command here.

## Commit & Pull Request Guidelines
- Prefer concise, imperative commits (“Add offline export dialog”); group related changes per commit.
- PRs should include: summary of user-facing behavior, before/after screenshots for UI tweaks, manual test notes (including offline check), and linked issue if applicable.
- Keep diffs lean; avoid formatting-only changes unless running a targeted cleanup.
- Update `CHANGELOG.md` with user-visible changes whenever behavior or setup shifts.
