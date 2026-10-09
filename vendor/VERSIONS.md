# Vendored libraries

Third party files are kept in the repo (no CDN at runtime, no build step).
To update one, download the new version from the same source, replace the file and update this table.

| Library | Version | Files | Source |
|---|---|---|---|
| Bootstrap | 5.3.8 | `bootstrap/bootstrap.min.css`, `bootstrap/bootstrap.bundle.min.js` (includes Popper) | https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/ |
| Bootstrap Icons | 1.13.2 | `bootstrap-icons/bootstrap-icons.min.css`, `bootstrap-icons/fonts/bootstrap-icons.woff2`, `.woff` | https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.2/font/ |
| Chart.js | 4.5.1 | `chart.js/chart.umd.min.js` | https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/ |

Older libraries still in `js/plugins/`:

| Library | Version | Files |
|---|---|---|
| MSAL Browser | 5.22.0 | `msal-browser.min.js`, `msal-redirect-bridge.min.js` |
| Moment.js (with locales) | 2.18.1 | `moment-with-locales.min.js` |
| moment-business-days | (unversioned copy) | `moment-business-days.js` |
| ExcellentExport | 3.0.0 | `excellentexport.min.js` |

SHA-256 (first 16 hex digits) of the downloaded files:

| File | SHA-256 |
|---|---|
| `bootstrap/bootstrap.min.css` | d85327d99c7a3ee1… |
| `bootstrap/bootstrap.bundle.min.js` | e4fd49181388c48e… |
| `bootstrap-icons/bootstrap-icons.min.css` | 79c99c1a1e0e937f… |
| `bootstrap-icons/fonts/bootstrap-icons.woff2` | 2b7689746f87e0be… |
| `bootstrap-icons/fonts/bootstrap-icons.woff` | 24929e8a44da0275… |
| `chart.js/chart.umd.min.js` | 48444a82d4edcb5b… |
