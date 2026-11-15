(async () => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const utilities = window.APP_UTILS;
  const getElement = elementId => document.getElementById(elementId);
  const escapeHtml = window.escapeHtml || (value => String(value ?? ''));
  await window.EXTERNAL_DEPENDENCIES_READY;

  let sourceStatistics;
  try {
    const response = await fetch(configuration.data.statisticsDatasetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Kunne ikke hente statistikkfilen (${response.status}).`);
    sourceStatistics = await response.json();
  } catch (error) {
    console.error(error);
    getElement('norway-map').textContent = 'Statistikkfilen kunne ikke lastes.';
    return;
  }

  const nationalStatistics = sourceStatistics[configuration.data.nationalRecordName];
  const rawHospitalEntries = Object.entries(sourceStatistics.sykehus || {});
  const rawHealthFacilities = sourceStatistics.helseforetak || {};
  const healthFacilities = Object.entries(rawHealthFacilities).map(([id, item]) => ({
    id,
    name: item.Navn,
    region: item.Helseregion,
    type: item.Type,
    subtitle: `${item.Type === 'Region' ? 'Helseregion' : 'Helseforetak'} · ${item.Helseregion}`,
    searchTerms: item.Soketermer || '',
    statistics: item,
    facility: item
  }));
  const hospitals = rawHospitalEntries.filter(([, item]) => item.Kartvisning).map(([id, item]) => {
    const healthFacility = rawHealthFacilities[item['Helseforetak-ID']];
    const useFacilityStatistics = !item['Rapporterer selv'] && Boolean(healthFacility);
    const facilityMemberCount = healthFacility?.['Sykehus-ID']?.length || 0;
    return {
      id,
      name: item.Navn,
      region: item.Helseregion,
      role: item.Beredskapsfunksjon,
      latitude: Number(item.Breddegrad),
      longitude: Number(item.Lengdegrad),
      healthFacilityId: item['Helseforetak-ID'],
      healthFacilityName: item.Helseforetak,
      healthFacilityMemberCount: facilityMemberCount,
      usesHealthFacilityStatistics: useFacilityStatistics,
      statisticsSourceId: useFacilityStatistics ? `helseforetak:${item['Helseforetak-ID']}` : `sykehus:${id}`,
      statistics: useFacilityStatistics ? healthFacility : item,
      type: 'hospital'
    };
  });

  const averageStatistics = utilities.createAverageStatistics(
    rawHospitalEntries.map(([, item]) => item), rawHealthFacilities
  );
  const searchProfiles = [
    {
      id: configuration.hospitalProfiles.nationalProfileId,
      name: configuration.hospitalProfiles.nationalProfileName,
      region: 'Norge',
      subtitle: configuration.hospitalProfiles.nationalProfileSubtitle,
      searchTerms: configuration.hospitalProfiles.nationalSearchTerms,
      statistics: nationalStatistics,
      type: 'aggregate-profile'
    },
    {
      id: configuration.hospitalProfiles.averageProfileId,
      name: configuration.hospitalProfiles.averageProfileName,
      region: 'Norge',
      subtitle: configuration.hospitalProfiles.averageProfileSubtitle,
      searchTerms: configuration.hospitalProfiles.averageSearchTerms,
      statistics: averageStatistics,
      type: 'aggregate-profile'
    }
  ];

  window.APP_DATA = { national: nationalStatistics, hospitals, healthFacilities, searchProfiles, raw: sourceStatistics };
  getElement('hospital-count').textContent = String(hospitals.length);

  function updateNationalSummary() {
    const activeDonors = utilities.getLatestValue(nationalStatistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(nationalStatistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(nationalStatistics, 'Tappingsvolum');
    const recruitmentChange = utilities.calculateRecruitmentChange(nationalStatistics);
    const recruitmentLoss = utilities.calculateRecruitmentLoss(nationalStatistics);
    const donorLoss = utilities.calculateDonorLoss(nationalStatistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);

    getElement('kpi-active').textContent = activeDonors ? utilities.formatNumber(activeDonors.value) : '–';
    getElement('kpi-active-note').textContent = activeDonors ? `År ${activeDonors.year} · personer` : 'Ingen data';
    getElement('kpi-new').textContent = newDonors ? utilities.formatNumber(newDonors.value) : '–';
    getElement('kpi-new-note').textContent = newDonors ? `År ${newDonors.year} · personer` : 'Ingen data';
    getElement('kpi-recruitment-loss-label').textContent = utilities.getChangeLabel(recruitmentLoss, 'nyrekruttering');
    getElement('kpi-recruitment-loss').textContent = recruitmentLoss === null ? '–' : utilities.formatNumber(Math.abs(recruitmentLoss));
    getElement('kpi-recruitment-loss-note').textContent = `${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}`;
    getElement('kpi-donor-loss-label').textContent = utilities.getChangeLabel(donorLoss, 'aktive blodgivere');
    getElement('kpi-donor-loss').textContent = donorLoss === null ? '–' : utilities.formatNumber(Math.abs(donorLoss));
    getElement('kpi-donor-loss-note').textContent = `${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}`;
    getElement('kpi-units').textContent = collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–';
    getElement('kpi-units').classList.add('kpi-blood-value');
    getElement('kpi-litres').textContent = collectedBlood ? `Fullblodstappinger · ${collectedBlood.year}` : 'Ingen data';
    getElement('national-risk').textContent = recruitmentChange === null
      ? '⚪ Ukjent'
      : `${utilities.formatPercentage(recruitmentChange)} · ${recruitmentRisk.icon} ${recruitmentRisk.label}`;
    getElement('national-risk-detail').textContent = utilities.createRecruitmentThresholdDescription(nationalStatistics);
    getElement('national-beredskapsnotat').textContent = nationalStatistics.Beredskapsnotat || 'Ikke oppgitt';
    getElement('national-forsyningslinje').textContent = nationalStatistics.Forsyningslinje || 'Ikke oppgitt';
  }

  function createLineChart(canvasId, statisticsRecord, metricName, metricLabel, lineColor) {
    const canvas = getElement(canvasId);
    const emptyMessage = document.querySelector(`[data-empty="${canvasId}"]`);
    const dataPoints = utilities.getSeries(statisticsRecord, metricName);
    if (!canvas || !window.Chart || !dataPoints.length) {
      emptyMessage?.classList.add('visible');
      return;
    }
    emptyMessage?.classList.remove('visible');
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: dataPoints.map(point => String(point.year)),
        datasets: [{
          label: metricLabel,
          data: dataPoints.map(point => point.value),
          borderColor: lineColor,
          backgroundColor: `${lineColor}1b`,
          borderWidth: configuration.chartAppearance.lineBorderWidth,
          pointRadius: configuration.chartAppearance.linePointRadius,
          pointHoverRadius: configuration.chartAppearance.lineHoverRadius,
          tension: configuration.chartAppearance.lineTension,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: configuration.chartAppearance.tooltipBackground,
            padding: configuration.chartAppearance.tooltipPadding,
            callbacks: {
              title: tooltipItems => utilities.formatMeasurement(tooltipItems[0]?.raw ?? 0, metricName === 'Tappingsvolum' ? 'blood' : 'people'),
              label: tooltipContext => `År ${tooltipContext.label} · ${metricLabel}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, maxRotation: 0, autoSkip: true } },
          y: {
            beginAtZero: true,
            grid: { color: configuration.chartAppearance.grid },
            border: { display: false },
            title: { display: true, text: metricName === 'Tappingsvolum' ? 'Blodenheter' : 'Personer', color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize, weight: '600' } },
            ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, callback: value => new Intl.NumberFormat(configuration.formatting.numberLocale, { notation: 'compact' }).format(value) }
          }
        }
      }
    });
  }

  function getUniqueComparisonRecords() {
    const seen = new Set();
    return hospitals.flatMap(hospital => {
      if (seen.has(hospital.statisticsSourceId)) return [];
      seen.add(hospital.statisticsSourceId);
      return [{
        name: hospital.usesHealthFacilityStatistics ? hospital.healthFacilityName : hospital.name,
        statistics: hospital.statistics,
        sourceId: hospital.statisticsSourceId
      }];
    });
  }

  let recruitmentComparisonChart = null;
  function drawRecruitmentComparisonChart(mode = 'percentage') {
    const canvas = getElement('recruitmentChart');
    const emptyMessage = document.querySelector('[data-empty="recruitmentChart"]');
    const rows = getUniqueComparisonRecords().map(record => {
      const value = mode === 'percentage'
        ? utilities.calculateRecruitmentChange(record.statistics)
        : utilities.calculateRecruitmentLoss(record.statistics);
      return { name: record.name, value };
    }).filter(row => row.value !== null)
      .sort((first, second) => mode === 'percentage' ? first.value - second.value : second.value - first.value);

    if (recruitmentComparisonChart) {
      recruitmentComparisonChart.destroy();
      recruitmentComparisonChart = null;
    }
    if (!canvas || !window.Chart || !rows.length) {
      emptyMessage?.classList.add('visible');
      return;
    }
    emptyMessage?.classList.remove('visible');
    const personMode = mode === 'persons';
    recruitmentComparisonChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(row => row.name),
        datasets: [{
          data: rows.map(row => row.value),
          backgroundColor: rows.map(row => {
            const decline = personMode ? row.value > 0 : row.value < 0;
            const growth = personMode ? row.value < 0 : row.value > 0;
            return decline ? configuration.chartColors.negativeRecruitment
              : growth ? configuration.chartColors.positiveRecruitment : configuration.chartColors.neutralRecruitment;
          }),
          borderRadius: 4,
          barThickness: personMode ? 6 : undefined,
          maxBarThickness: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: configuration.chartAppearance.tooltipBackground,
            callbacks: {
              title: tooltipItems => personMode
                ? `${utilities.formatNumber(Math.abs(tooltipItems[0]?.raw ?? 0))} personer`
                : utilities.formatPercentage(tooltipItems[0]?.raw ?? 0),
              label: tooltipContext => personMode
                ? `${tooltipContext.label}: ${tooltipContext.raw > 0 ? 'færre rekrutter' : tooltipContext.raw < 0 ? 'flere rekrutter' : 'uendret'}`
                : tooltipContext.label
            }
          }
        },
        scales: {
          x: {
            grid: { color: configuration.chartAppearance.grid },
            ticks: { color: configuration.chartAppearance.axisText, callback: value => personMode ? utilities.formatNumber(value) : `${value} %` },
            title: { display: true, text: personMode ? 'Personer' : 'Prosent', color: configuration.chartAppearance.axisText }
          },
          y: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisMutedText, font: { size: configuration.chartAppearance.compactAxisFontSize }, padding: 1, autoSkip: false } }
        }
      }
    });
  }

  function createHospitalPopup(hospital) {
    const statistics = hospital.statistics;
    const recruitmentChange = utilities.calculateRecruitmentChange(statistics);
    const recruitmentLoss = utilities.calculateRecruitmentLoss(statistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);
    const activeDonors = utilities.getLatestValue(statistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(statistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(statistics, 'Tappingsvolum');
    const reportsForWholeFacility = hospital.usesHealthFacilityStatistics && hospital.healthFacilityMemberCount > 1;
    const popupElement = document.createElement('div');
    popupElement.innerHTML = `
      <div class="popup-tag">${escapeHtml(hospital.role)}</div>
      <div class="popup-title">${escapeHtml(hospital.name)}</div>
      <div class="popup-sub">${escapeHtml(hospital.region)}</div>
      ${reportsForWholeFacility ? `<div class="reporting-source-notice"><strong>Rapporteres på helseforetaksnivå</strong><span>Tallene nedenfor gjelder hele ${escapeHtml(hospital.healthFacilityName)}, ikke bare dette sykehuset.</span></div>` : ''}
      <div class="popup-stats">
        <div class="popup-stat"><b>${activeDonors ? utilities.formatNumber(activeDonors.value) : '–'}</b><span>Aktive blodgivere${activeDonors ? ` · ${activeDonors.year}` : ''}</span></div>
        <div class="popup-stat"><b>${newDonors ? utilities.formatNumber(newDonors.value) : '–'}</b><span>Nyrekruttering${newDonors ? ` · ${newDonors.year}` : ''}</span></div>
        <div class="popup-stat"><b>${collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–'}</b><span>Fullblodstappinger${collectedBlood ? ` · ${collectedBlood.year}` : ''}</span></div>
      </div>
      <div class="popup-beredskap"><span>Beredskapsstatus</span><strong>${recruitmentRisk.icon} ${recruitmentRisk.label}</strong></div>
      <div class="popup-status">${utilities.getChangeLabel(recruitmentLoss, 'nyrekruttering')} ${recruitmentLoss === null ? '' : `${utilities.formatNumber(Math.abs(recruitmentLoss))} personer`} · ${configuration.comparisonYears.comparisonYear}–${configuration.comparisonYears.baselineYear}</div>
      <button class="popup-view" type="button">${reportsForWholeFacility ? `Vis statistikk for ${escapeHtml(hospital.healthFacilityName)} ↗` : 'Vis mer om sykehuset ↗'}</button>`;

    popupElement.querySelector('.popup-view').addEventListener('click', () => {
      if (reportsForWholeFacility) {
        window.location.href = `./helseforetak.html?id=${encodeURIComponent(hospital.healthFacilityId)}`;
      } else {
        window.location.href = `./hospital.html?id=${encodeURIComponent(hospital.id)}`;
      }
    });
    return popupElement;
  }

  function initializeMap() {
    const mapElement = getElement('norway-map');
    if (!window.L) {
      mapElement.textContent = 'Kartbiblioteket kunne ikke lastes. Kontroller nettilkoblingen.';
      return;
    }

    const map = window.L.map('norway-map', { scrollWheelZoom: false, zoomControl: true })
      .setView(configuration.map.initialCenter, configuration.map.initialZoom);
    window.L.tileLayer(configuration.externalDependencies.openStreetMapTileService.urlTemplate, {
      maxZoom: configuration.map.tileMaximumZoom,
      attribution: '© OpenStreetMap-bidragsytere'
    }).addTo(map);

    const markerByHospitalId = new Map();
    const mapMarkers = [];
    hospitals.forEach(hospital => {
      const risk = utilities.getRecruitmentRisk(utilities.calculateRecruitmentChange(hospital.statistics));
      const marker = window.L.marker([hospital.latitude, hospital.longitude], {
        icon: window.L.divIcon({
          className: 'hospital-marker-icon',
          html: `<span class="map-dot-wrap"><span class="map-dot ${risk.key}" aria-label="${risk.label}"></span></span>`,
          iconSize: configuration.map.selectedMarkerIconSize,
          iconAnchor: configuration.map.selectedMarkerIconAnchor
        }),
        title: hospital.name,
        alt: hospital.name
      });
      marker.bindPopup(createHospitalPopup(hospital), { maxWidth: configuration.map.popupMaximumWidth });
      marker.addTo(map);
      markerByHospitalId.set(hospital.id, marker);
      mapMarkers.push(marker);
    });

    function startStaggeredMarkerFlashing() {
      const flash = configuration.map.markerFlash;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      function chooseNextMarker() {
        const available = mapMarkers.map(marker => marker.getElement()?.querySelector('.map-dot'))
          .filter(element => element && !element.classList.contains('is-flashing'));
        if (!available.length) return;
        const selected = available[Math.floor(Math.random() * available.length)];
        selected.classList.add('is-flashing');
        window.setTimeout(() => selected.classList.remove('is-flashing'), flash.animationDurationMilliseconds);
      }
      function schedule() {
        const interval = flash.minimumStartIntervalMilliseconds
          + Math.random() * (flash.maximumStartIntervalMilliseconds - flash.minimumStartIntervalMilliseconds);
        window.setTimeout(() => { chooseNextMarker(); schedule(); }, interval);
      }
      schedule();
    }
    startStaggeredMarkerFlashing();

    const mapSearchInput = getElement('map-search');
    const mapSearchResults = getElement('map-search-results');
    let currentMapSearchResults = [];
    function navigateToMapResult(result) {
      if (!result) return;
      if (result.type === 'aggregate-profile') {
        window.location.href = `./hospital.html?id=${encodeURIComponent(result.id)}`;
        return;
      }
      if (result.type === 'healthfacility') {
        window.location.href = `./helseforetak.html?id=${encodeURIComponent(result.id)}`;
        return;
      }
      mapSearchInput.value = result.name;
      mapSearchResults.hidden = true;
      map.flyTo([result.latitude, result.longitude], configuration.map.selectedZoom, { duration: configuration.timing.mapFlightSeconds });
      window.setTimeout(() => markerByHospitalId.get(result.id)?.openPopup(), configuration.timing.mapPopupAfterFlightMilliseconds);
    }
    function renderMapSearchResults(query) {
      const normalized = query.trim().toLocaleLowerCase('no');
      if (!normalized) {
        mapSearchResults.hidden = true;
        currentMapSearchResults = [];
        return;
      }
      const profileMatches = searchProfiles.filter(item => `${item.name} ${item.region} ${item.searchTerms}`.toLocaleLowerCase('no').includes(normalized));
      const facilityMatches = healthFacilities.filter(item => `${item.name} ${item.region} ${item.searchTerms}`.toLocaleLowerCase('no').includes(normalized));
      const hospitalMatches = hospitals.filter(item => `${item.name} ${item.region} ${item.role} ${item.healthFacilityName}`.toLocaleLowerCase('no').includes(normalized));
      currentMapSearchResults = [
        ...profileMatches,
        ...facilityMatches.map(item => ({ ...item, type: 'healthfacility' })),
        ...hospitalMatches
      ].slice(0, configuration.search.mapSuggestionLimit);
      mapSearchResults.innerHTML = currentMapSearchResults.length
        ? currentMapSearchResults.map((result, index) => `
            <button class="suggestion-item" data-index="${index}" type="button">
              <span class="suggestion-icon">⌖</span>
              <span class="suggestion-copy"><span class="suggestion-title">${escapeHtml(result.name)}</span>
              <span class="suggestion-sub">${escapeHtml(result.subtitle || (result.type === 'healthfacility' ? `${result.type === 'Region' ? 'Helseregion' : 'Helseforetak'} · ${result.region}` : `${result.region} · ${result.role}`))}</span></span>
            </button>`).join('')
        : '<div class="suggestion-item"><span class="suggestion-copy"><span class="suggestion-title">Ingen treff</span></span></div>';
      mapSearchResults.hidden = false;
      mapSearchResults.querySelectorAll('button[data-index]').forEach(button => {
        button.addEventListener('click', () => navigateToMapResult(currentMapSearchResults[Number(button.dataset.index)]));
      });
    }
    mapSearchInput.addEventListener('input', () => renderMapSearchResults(mapSearchInput.value));
    mapSearchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); navigateToMapResult(currentMapSearchResults[0]); }
      if (event.key === 'Escape') mapSearchResults.hidden = true;
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.map-search-wrap')) mapSearchResults.hidden = true;
    });
    window.setTimeout(() => map.invalidateSize(), configuration.timing.mapSizeRefreshMilliseconds);
  }

  updateNationalSummary();
  [
    { canvasId: 'activeChart', metricName: 'Aktive blodgivere', label: 'Aktive blodgivere', color: configuration.chartColors.activeDonors },
    { canvasId: 'newChart', metricName: 'Nyrekruttering', label: 'Nye blodgivere', color: configuration.chartColors.newDonors },
    { canvasId: 'collectionChart', metricName: 'Tappingsvolum', label: 'Fullblodstappinger', color: configuration.chartColors.collections }
  ].forEach(metric => createLineChart(metric.canvasId, nationalStatistics, metric.metricName, metric.label, metric.color));

  const recruitmentMode = getElement('recruitment-mode');
  const recruitmentDescription = getElement('recruitment-description');
  function updateRecruitmentComparison() {
    const mode = recruitmentMode?.value || 'percentage';
    if (recruitmentDescription) {
      recruitmentDescription.textContent = mode === 'percentage'
        ? `Prosentvis endring fra ${configuration.comparisonYears.comparisonYear} til ${configuration.comparisonYears.baselineYear}. Negative verdier betyr færre nye givere.`
        : `Forskjell i antall nye givere fra ${configuration.comparisonYears.comparisonYear} til ${configuration.comparisonYears.baselineYear}. Positive verdier betyr færre givere.`;
    }
    drawRecruitmentComparisonChart(mode);
  }
  recruitmentMode?.addEventListener('change', updateRecruitmentComparison);
  updateRecruitmentComparison();
  initializeMap();
})();
