# Bundled KiCanvas

`kicanvas.js` is a build of the CircuitSnips fork of KiCanvas, rebased on
upstream `theacodes/kicanvas`.

- Fork: https://github.com/MichaelAyles/kicanvas
- Branch: `rebase-upstream-2026-11`
- Commit: `4882068`
- Upstream base: `b031159` (2026-04-28), includes KiCad 10 property support

Fork-only features CircuitSnips relies on: the `theme` attribute,
`kicanvas:load` / `rendered` lifecycle events, and text box and table
rendering. The fork also adds raw content loading (`content` attribute /
`loadContent()`) and box-select copy.

Rebuild with `scripts/update-kicanvas.sh [path-to-kicanvas-checkout]`.
