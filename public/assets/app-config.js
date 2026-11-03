(() => {
  'use strict';

  const APP_CONFIG = Object.freeze({
    data: Object.freeze({
      statisticsDatasetUrl: '/data/hospital_statistics.json',
      nationalRecordName: 'Norge Totalt'
    }),
    formatting: Object.freeze({
      numberLocale: 'nb-NO',
      bloodUnitLitres: 0.45,
      maximumNumberFractionDigits: 1,
      maximumLitresFractionDigits: 2
    }),
    comparisonYears: Object.freeze({
      baselineYear: 2015,
      comparisonYear: 2025
    }),
    recruitmentThresholds: Object.freeze({
      moderateDeclinePercent: 30,
      severeDeclinePercent: 60
    }),
    search: Object.freeze({
      hospitalSuggestionLimit: 7,
      mapSuggestionLimit: 10,
      globalSuggestionLimit: 10
    }),
    chartAppearance: Object.freeze({
      tooltipBackground: '#6b1a36',
      axisText: '#94a099',
      axisMutedText: '#718078',
      grid: '#edf1ed',
      softGrid: '#f0e7e9',
      balanceAxisTitle: '#9b6570',
      yellowRecruitment: '#d49c2d',
      lineBorderWidth: 2.4,
      linePointRadius: 2.8,
      lineHoverRadius: 6,
      lineTension: 0.28,
      tooltipPadding: 10,
      axisFontSize: 10,
      compactAxisFontSize: 8
    }),
    timing: Object.freeze({
      mapPopupAfterFlightMilliseconds: 850,
      mapSizeRefreshMilliseconds: 150,
      mapFlightSeconds: 0.8,
      bloodDropCleanupGraceMilliseconds: 150
    }),
    hospitalProfiles: Object.freeze({
      expectedHospitalCount: 38,
      nationalProfileId: 'hele-landet-norge',
      nationalProfileName: 'Hele landet (Norge)',
      nationalProfileSubtitle: 'Nasjonal statistikk',
      averageProfileId: 'gjennomsnitt',
      averageProfileName: 'Gjennomsnitt per sykehus (38)',
      averageProfileSubtitle: 'Nasjonalt gjennomsnitt fordelt på 38 sykehus',
      nationalSearchTerms: 'hele landet norge nasjonalt nasjonal oversikt',
      averageSearchTerms: 'gjennomsnitt gjennomsnitt per sykehus average'
    }),
    map: Object.freeze({
      initialCenter: Object.freeze([64.8, 14.4]),
      initialZoom: 4,
      selectedZoom: 8,
      tileMaximumZoom: 12,
      selectedMarkerIconSize: Object.freeze([24, 24]),
      selectedMarkerIconAnchor: Object.freeze([12, 12]),
      popupMaximumWidth: 320,
      markerFlash: Object.freeze({
        minimumStartIntervalMilliseconds: 1000,
        maximumStartIntervalMilliseconds: 2000,
        animationDurationMilliseconds: 4000
      })
    }),
    bloodRain: Object.freeze({
      storageKey: 'blodberedskap.bloodRain.enabled',
      imageUrl: '/assets/blood.png',
      minimumSpawnIntervalMilliseconds: 4000,
      maximumSpawnIntervalMilliseconds: 10000,
      fallDurationMilliseconds: 6500,
      minimumDropSizePixels: 26,
      maximumDropSizePixels: 64,
      minimumDropRotationDegrees: -24,
      maximumDropRotationDegrees: 24,
      horizontalPositionPercent: 100
    }),
    externalDependencies: Object.freeze({
      statisticsChartLibrary: Object.freeze({
        purpose: 'Draws national and hospital statistics charts',
        url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'
      }),
      interactiveMapLibrary: Object.freeze({
        purpose: 'Provides the interactive hospital map, markers and popups',
        url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      }),
      interactiveMapStylesheet: Object.freeze({
        purpose: 'Styles the interactive Leaflet map and its controls',
        url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      }),
      openStreetMapTileService: Object.freeze({
        purpose: 'Supplies the map background tiles',
        urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      })
    }),
    chartColors: Object.freeze({
      activeDonors: '#287b5b',
      newDonors: '#b98b36',
      collections: '#4d8a70',
      patientConsumption: '#5f7f9c',
      netBalance: '#a81731',
      positiveRecruitment: '#27805c',
      negativeRecruitment: '#b51f38',
      neutralRecruitment: '#9aa6a0'
    })
  });

  window.APP_CONFIG = APP_CONFIG;
})();
