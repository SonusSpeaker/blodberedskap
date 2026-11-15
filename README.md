# Blodberedskap Norge

A small, static-first website for exploring blood-donation recruitment, whole-blood collection volumes, and preparedness statistics for Norwegian trauma hospitals, health trusts, and health regions.

## Run locally

Requirements: Python 3.10 or newer. The server uses the Python standard library; no dependency installation is needed.

```bash
python server.py
```

Open the local address printed in the terminal (by default `http://127.0.0.1:8000`). The supplied `.env` enables local HTTPS using the certificate files in `certs/`. For plain HTTP (including when that local certificate/key pair is not valid), start the server with TLS disabled:

```bash
TLS_CERT_FILE= TLS_KEY_FILE= python server.py
```

On PowerShell, use `$env:TLS_CERT_FILE=""; $env:TLS_KEY_FILE=""; python server.py`. To use another host or port, set `HOST` and `PORT` in the environment or in `.env`:

```dotenv
HOST=127.0.0.1
PORT=8000
```

The server serves the project root and the bundled dataset. `Cache-Control: no-store` is set so edits to the JSON file are visible after a reload.

## Project layout

```text
.
├── index.html                 National dashboard and map
├── hospital.html              Individual hospital profile
├── helseforetak.html          Health-trust and health-region profile
├── about.html                 About page
├── server.py                  Local development server
├── data/
│   └── hospital_statistics.json  Dataset loaded by the website
├── pdf statistikk/            Annual source reports (PDF)
└── assets/
    ├── app-config.js          Paths, comparison years, thresholds and UI constants
    ├── shared-data.js         Shared formatting and statistics calculations
    ├── common.js              Header, navigation and global search
    ├── dashboard.js           National KPIs, charts, map and map search
    ├── hospital.js            Hospital profile controller
    ├── helseforetak.js        Health-trust / region profile controller
    ├── external-dependencies.js  Conditional loading of Chart.js and Leaflet
    ├── blood-rain.js          Optional visual effect
    ├── styles.css             Main layout and component styles
    ├── theme-overrides.css    Theme-specific overrides
    └── logo.png               Brand mark and browser-tab icon
```

All local links and asset references are relative and use the `./` prefix. Keep that convention when adding files or changing paths.

## Dataset structure

`data/hospital_statistics.json` is the production data file. The top-level structure is:

- `Norge Totalt`: the national series and national context fields.
- `sykehus`: hospital records keyed by stable URL-friendly IDs.
- `helseforetak`: health trusts and health regions keyed by stable IDs. Both use the same profile page; the `Type` field distinguishes `Helseforetak` from `Region`.

Each hospital record contains its display name, health-trust ID, region, map metadata, and annual series. Each health-trust / region record contains the three statistical series plus its member IDs. `Sykehus-ID` lists the hospitals belonging to a health trust; regional records also contain `Helseforetak-ID` for their health trusts.

Reporting-level fields are important:

- `Rapporterer selv` is true when the hospital has its own figures for the latest comparison year. If it is false, the website displays the parent health trust's series for that hospital. Where several hospitals share a health-trust report, the map popup explicitly identifies that the figures are trust-wide and links to the health-trust profile.
- `Statistikk-ID` identifies the report row used for an individually reporting hospital.
- `Rapporteringsnivå` on a health-trust record indicates whether its figures are reported at trust level or calculated from individual hospital reports.
- A health trust with one hospital uses the trust's series as that hospital's series without presenting the figures as a multi-hospital aggregate.

### Statistical fields

The website currently uses these annual series:

| JSON field | Meaning | Display unit |
| --- | --- | --- |
| `Aktive blodgivere` | Active blood donors | Persons |
| `Nyrekruttering` | Newly recruited blood donors | Persons |
| `Tappingsvolum` | `Fullblodstappinger` from the annual reports | Blood units and derived litres |

`Tappingsvolum` is whole-blood collection only. Do not substitute total collections that include apheresis. The litre display is derived using the conversion constant in `assets/app-config.js` (`bloodUnitLitres`). Existing number and unit formatting is also configured there.

Missing observations are represented by JSON `null`. A numeric zero in the statistical source series is normalised to `null`, and records with no observations are not treated as independent reporting units. Do not replace missing values with zero: the charts and comparisons distinguish missing data from an actual measurement.

**Known source discrepancy:** In the 2015 report, the national summary table reports 2,291 newly approved donors for Region Nord (and 20,814 nationally). The sum of the listed northern hospital rows is 2,322. The regional and national series retain the report summary values; the hospital rows are preserved as printed. This 31-person discrepancy is not silently allocated to a hospital.

The comparison period and preparedness thresholds are configuration values in `assets/app-config.js`; the interface and calculations read those values rather than relying on fixed values in individual components. Historical series are rendered from the years present in the JSON.

## Updating the statistics

1. Use the annual reports in `pdf statistikk/` as the source for data changes. Keep the reporting unit and table heading clear when transcribing a row.
2. Update the relevant hospital, health-trust, region, and national records in `data/hospital_statistics.json`. Preserve stable IDs because they are used in page links and membership lists.
3. Keep the reporting hierarchy consistent: hospital reports belong under `sykehus`; health-trust and region reports belong under `helseforetak`. Update `Sykehus-ID` and `Helseforetak-ID` whenever membership changes.
4. When a hospital is no longer reported individually, set `Rapporterer selv` to false and ensure its parent health trust has the appropriate annual series. The site will use that series for the hospital's map marker and profile.
5. Recalculate aggregate health-trust and regional totals from the underlying reporting units. Ensure regional totals add up to `Norge Totalt` for each year where the data is complete.
6. Use `null` for missing or zero observations, and omit reporting units that have no usable observations in every year.

## Front-end notes

- `assets/app-config.js` is the single place for the dataset path, comparison years, recruitment thresholds, chart styling, map settings, and optional effects.
- `assets/shared-data.js` contains the shared formatting, missing-value handling, reporting fallback, risk calculation, and dynamic average calculations.
- `assets/common.js` populates the global navigation and global search. The dashboard and profile controllers publish hospitals, health trusts, and regions through `window.APP_DATA`.
- `assets/dashboard.js` builds the national charts and Leaflet map. The recruitment comparison chart is one chart with a `Prosent` / `Personer` selector.
- `assets/hospital.js` and `assets/helseforetak.js` use the same chart and KPI IDs from their respective HTML templates.
- Chart.js and Leaflet are loaded by `assets/external-dependencies.js` only on pages that need them. Their versions and external resource locations are declared in `assets/app-config.js`.

## Local HTTPS (optional)

To enable HTTPS for local testing, create a certificate and key in `certs/` (for example with `mkcert`) and set both paths in `.env`:

```dotenv
TLS_CERT_FILE=certs/localhost.pem
TLS_KEY_FILE=certs/localhost-key.pem
```

Leave both values empty to use HTTP. The server requires both values when HTTPS is enabled.

## Checks before committing

Run syntax checks for the JavaScript files and validate the dataset JSON:

```bash
for file in assets/*.js; do node --check "$file"; done
python -m json.tool data/hospital_statistics.json > /dev/null
```

Then run `python server.py` and check the national dashboard, a hospital page (for example `./hospital.html?id=unn-tromso`), a multi-hospital trust page, and a regional page. Also test both search fields, the map popup for a trust-reporting hospital, and both views of the recruitment selector.
