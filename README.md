# Blodberedskap Norge

## Start lokalt

Prosjektet krever Python 3.10 eller nyere og bruker bare standardbiblioteket på serversiden.

```bash
python server.py
```

Åpne adressen som vises i terminalen (standard: `http://127.0.0.1:8000`). Statistikkgrunnlaget ligger i `data/hospital_statistics.json`.

## Valgfri HTTPS lokalt

Sertifikat og privatnøkkel er ikke pakket inn. For å aktivere lokal HTTPS, opprett egne filer i `certs/` (for eksempel med mkcert) og sett begge variablene i `.env`:

```dotenv
TLS_CERT_FILE=certs/localhost.pem
TLS_KEY_FILE=certs/localhost-key.pem
```

La begge feltene stå tomme for vanlig HTTP. Serveren krever begge verdiene når HTTPS er aktivert.

## Eksterne ressurser

Alle eksterne nettadresser er samlet i `public/assets/app-config.js`, med navn etter funksjonen de har i nettstedet. `external-dependencies.js` laster bare ressursene den aktuelle siden trenger.

| Konfigurasjonsnavn | Bruk | Versjon / leverandør |
| --- | --- | --- |
| `statisticsChartLibrary` | Tegner statistikkgrafer på nasjonal- og sykehusprofilene | Chart.js 4.4.4, jsDelivr |
| `interactiveMapLibrary` | Interaktivt kart, markører, kartkontroller og popup-vinduer | Leaflet 1.9.4, unpkg |
| `interactiveMapStylesheet` | Stilark for Leaflet-kartet | Leaflet 1.9.4, unpkg |
| `openStreetMapTileService` | Bakgrunnskartets kartfliser | OpenStreetMap |

Google Fonts er fjernet; nettsiden bruker lokale systemfonter. Leaflet-kildekoden ligger ikke lenger kopiert i prosjektmappen.

## Kodeoversikt

- `app-config.js`: kildestier, avhengigheter, farger, beregningskonstanter og animasjonstider.
- `shared-data.js`: felles formatering og beregninger for nasjonale tall, sykehus og gjennomsnitt.
- `external-dependencies.js`: kontrollert innlasting av Chart.js og Leaflet.
- `common.js`: toppmeny og globalt søk.
- `dashboard.js`: nasjonale nøkkeltall, grafer og kart.
- `hospital.js`: sykehus-, nasjonal- og gjennomsnittsprofiler.
- `blood-rain.js`: blodregnkontroll og animasjon.
- `styles.css` og `theme-overrides.css`: layout og sentral formålsbasert fargepalett.

## Bevegelse

Kartmarkører starter blink med tilfeldig intervall mellom 1 og 2 sekunder; hver blink varer 4 sekunder. Blodregn starter en ny dråpe med tilfeldig intervall mellom 4 og 10 sekunder. Begge effektene respekterer brukerens innstilling for redusert bevegelse.
