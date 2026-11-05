(async () => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const utilities = window.APP_UTILS;
  const getElement = elementId => document.getElementById(elementId);
  const escapeHtml = window.escapeHtml || (value => String(value ?? ''));

  await window.EXTERNAL_DEPENDENCIES_READY;

  let sourceStatistics;
  try {
    const datasetResponse = await fetch(configuration.data.statisticsDatasetUrl, { cache: 'no-store' });
    if (!datasetResponse.ok) throw new Error(`Kunne ikke hente statistikkgrunnlaget (${datasetResponse.status}).`);
    sourceStatistics = await datasetResponse.json();
  } catch (error) {
    console.error(error);
    getElement('norway-map').textContent = 'Statistikkgrunnlaget kunne ikke lastes.';
    return;
  }

  const nationalStatistics = sourceStatistics[configuration.data.nationalRecordName];
  const hospitalEntries = Object.entries(sourceStatistics)
    .filter(([recordName]) => recordName !== configuration.data.nationalRecordName);
  const hospitals = hospitalEntries.map(([hospitalName, hospitalStatistics]) => ({
    id: utilities.createSlug(hospitalName),
    name: hospitalName,
    region: hospitalStatistics['Helseregion'],
    role: hospitalStatistics['Beredskapsfunksjon'],
    latitude: Number(hospitalStatistics['Breddegrad']),
    longitude: Number(hospitalStatistics['Lengdegrad']),
    statistics: hospitalStatistics,
    type: 'hospital'
  }));

  const expectedHospitalCount = configuration.hospitalProfiles.expectedHospitalCount;
  const averageStatistics = utilities.createAverageStatistics(nationalStatistics, expectedHospitalCount);
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

  window.APP_DATA = {
    national: nationalStatistics,
    hospitals,
    searchProfiles,
    raw: sourceStatistics
  };

  getElement('hospital-count').textContent = String(hospitals.length);

  function updateNationalSummary() {
    const activeDonors = utilities.getLatestValue(nationalStatistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(nationalStatistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(nationalStatistics, 'Tappingsvolum');
    const patientConsumption = utilities.getLatestValue(nationalStatistics, 'Pasientforbruk');
    const recruitmentChange = utilities.calculateRecruitmentChange(nationalStatistics);
    const recruitmentLoss = utilities.calculateRecruitmentLoss(nationalStatistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);

    getElement('kpi-active').textContent = activeDonors ? utilities.formatNumber(activeDonors.value) : '–';
    getElement('kpi-active-note').textContent = activeDonors ? `År ${activeDonors.year} · personer` : 'Ingen data';
    getElement('kpi-new').textContent = newDonors ? utilities.formatNumber(newDonors.value) : '–';
    getElement('kpi-new-note').textContent = newDonors ? `År ${newDonors.year} · personer` : 'Ingen data';
    getElement('kpi-units').textContent = collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–';
    getElement('kpi-units').classList.add('kpi-blood-value');
    getElement('kpi-litres').textContent = collectedBlood ? `Tapping · ${collectedBlood.year}` : 'Ingen data';
    getElement('kpi-consumption').textContent = patientConsumption ? utilities.formatBloodVolume(patientConsumption.value) : '–';
    getElement('kpi-consumption').classList.add('kpi-blood-value');
    getElement('kpi-consumption-note').textContent = patientConsumption ? `Pasientforbruk · ${patientConsumption.year}` : 'Ingen data';
    getElement('kpi-recruitment-loss').textContent = recruitmentLoss === null ? '–' : utilities.formatNumber(recruitmentLoss);
    getElement('kpi-recruitment-loss-note').textContent = '2015 minus 2025';

    getElement('national-risk').textContent = recruitmentChange === null
      ? '⚪ Ukjent'
      : `${utilities.formatPercentage(recruitmentChange)} · ${recruitmentRisk.icon} ${recruitmentRisk.label}`;
    getElement('national-risk-detail').textContent = utilities.createRecruitmentThresholdDescription(nationalStatistics);
    getElement('national-beredskapsnotat').textContent = nationalStatistics['Beredskapsnotat'] || 'Ikke oppgitt';
    getElement('national-forsyningslinje').textContent = nationalStatistics['Forsyningslinje'] || 'Ikke oppgitt';
  }

  function createLineChart(canvasId, statisticsRecord, metricName, metricLabel, lineColor) {
    const canvas = getElement(canvasId);
    const emptyMessage = document.querySelector(`[data-empty="${canvasId}"]`);
    const dataPoints = utilities.getSeries(statisticsRecord, metricName);
    if (!canvas || !window.Chart) {
      emptyMessage?.classList.add('visible');
      return;
    }
    if (!dataPoints.length) {
      emptyMessage?.classList.add('visible');
      return;
    }
    emptyMessage?.classList.remove('visible');

    const isBloodMetric = ['Tappingsvolum', 'Pasientforbruk', 'Nettbalanse'].includes(metricName);
    const measurementType = isBloodMetric ? 'blood' : 'people';

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
              title: tooltipItems => utilities.formatMeasurement(tooltipItems[0]?.raw ?? 0, measurementType),
              label: tooltipContext => `År ${tooltipContext.label} · ${metricLabel}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, maxRotation: 0, autoSkip: true }
          },
          y: {
            beginAtZero: true,
            grid: { color: configuration.chartAppearance.grid },
            border: { display: false },
            title: {
              display: true,
              text: isBloodMetric ? 'Blodenheter' : 'Personer',
              color: configuration.chartAppearance.axisText,
              font: { size: configuration.chartAppearance.axisFontSize, weight: '600' }
            },
            ticks: {
              color: configuration.chartAppearance.axisText,
              font: { size: configuration.chartAppearance.axisFontSize },
              callback: value => new Intl.NumberFormat(configuration.formatting.numberLocale, { notation: 'compact' }).format(value)
            }
          }
        }
      }
    });
  }

  function createNetBalanceSeries(statisticsRecord) {
    const consumptionByYear = new Map(
      utilities.getSeries(statisticsRecord, 'Pasientforbruk').map(point => [point.year, point.value])
    );
    return utilities.getSeries(statisticsRecord, 'Tappingsvolum')
      .filter(point => consumptionByYear.has(point.year))
      .map(point => ({
        year: point.year,
        value: point.value - consumptionByYear.get(point.year)
      }));
  }

  function drawNetBalanceChart() {
    const balancePoints = createNetBalanceSeries(nationalStatistics);
    const canvas = getElement('netBalanceChart');
    const emptyMessage = document.querySelector('[data-empty="netBalanceChart"]');
    if (!canvas || !window.Chart || !balancePoints.length) {
      emptyMessage?.classList.add('visible');
      return;
    }

    emptyMessage?.classList.remove('visible');
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: balancePoints.map(point => String(point.year)),
        datasets: [{
          label: 'Nettbalanse',
          data: balancePoints.map(point => point.value),
          borderColor: configuration.chartColors.netBalance,
          backgroundColor: `${configuration.chartColors.netBalance}20`,
          borderWidth: configuration.chartAppearance.lineBorderWidth,
          pointRadius: configuration.chartAppearance.linePointRadius,
          pointHoverRadius: configuration.chartAppearance.lineHoverRadius,
          tension: 0.25,
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
              title: tooltipItems => utilities.formatBloodVolume(tooltipItems[0]?.raw ?? 0),
              label: tooltipContext => `År ${tooltipContext.label} · Nettbalanse`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, maxRotation: 0, autoSkip: true } },
          y: {
            beginAtZero: true,
            grid: { color: configuration.chartAppearance.softGrid },
            border: { display: false },
            title: { display: true, text: 'Nettbalanse (blodenheter)', color: configuration.chartAppearance.balanceAxisTitle, font: { size: configuration.chartAppearance.axisFontSize, weight: '600' } },
            ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, callback: value => new Intl.NumberFormat(configuration.formatting.numberLocale, { notation: 'compact' }).format(value) }
          }
        }
      }
    });
  }

  function drawRecruitmentChangeChart() {
    const recruitmentRows = hospitals.map(hospital => {
      const change = utilities.calculateRecruitmentChange(hospital.statistics);
      return { name: hospital.name, change, risk: utilities.getRecruitmentRisk(change) };
    }).filter(row => row.change !== null).sort((firstRow, secondRow) => firstRow.change - secondRow.change);
    const canvas = getElement('recruitmentChart');
    const emptyMessage = document.querySelector('[data-empty="recruitmentChart"]');
    if (!canvas || !window.Chart || !recruitmentRows.length) {
      emptyMessage?.classList.add('visible');
      return;
    }

    emptyMessage?.classList.remove('visible');
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: recruitmentRows.map(row => row.name),
        datasets: [{
          data: recruitmentRows.map(row => row.change),
          backgroundColor: recruitmentRows.map(row => row.risk.key === 'red'
            ? configuration.chartColors.negativeRecruitment
            : row.risk.key === 'yellow' ? configuration.chartAppearance.yellowRecruitment : configuration.chartColors.positiveRecruitment),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: tooltipItems => utilities.formatPercentage(tooltipItems[0]?.raw ?? 0),
              label: tooltipContext => tooltipContext.label
            }
          }
        },
        scales: {
          x: { grid: { color: configuration.chartAppearance.grid }, ticks: { color: configuration.chartAppearance.axisText, callback: value => `${value}%` } },
          y: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisMutedText, font: { size: configuration.chartAppearance.compactAxisFontSize }, padding: 1, autoSkip: false } }
        }
      }
    });
  }

  function drawRecruitmentLossChart() {
    const recruitmentLossRows = hospitals.map(hospital => ({
      name: hospital.name,
      loss: utilities.calculateRecruitmentLoss(hospital.statistics)
    })).filter(row => row.loss !== null).sort((firstRow, secondRow) => secondRow.loss - firstRow.loss);
    const canvas = getElement('recruitmentLossChart');
    const emptyMessage = document.querySelector('[data-empty="recruitmentLossChart"]');
    if (!canvas || !window.Chart || !recruitmentLossRows.length) {
      emptyMessage?.classList.add('visible');
      return;
    }

    emptyMessage?.classList.remove('visible');
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: recruitmentLossRows.map(row => row.name),
        datasets: [{
          data: recruitmentLossRows.map(row => row.loss),
          backgroundColor: recruitmentLossRows.map(row => row.loss > 0
            ? configuration.chartColors.negativeRecruitment
            : row.loss < 0 ? configuration.chartColors.positiveRecruitment : configuration.chartColors.neutralRecruitment),
          borderRadius: 3,
          barThickness: 6,
          maxBarThickness: 7,
          categoryPercentage: 0.92,
          barPercentage: 0.9
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
              title: tooltipItems => `${utilities.formatNumber(tooltipItems[0]?.raw ?? 0)} personer`,
              label: tooltipContext => tooltipContext.raw >= 0
                ? `${tooltipContext.label}: færre rekrutter`
                : `${tooltipContext.label}: flere rekrutter`
            }
          }
        },
        scales: {
          x: { grid: { color: configuration.chartAppearance.softGrid }, ticks: { color: configuration.chartAppearance.axisText, callback: value => utilities.formatNumber(value) } },
          y: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisMutedText, font: { size: configuration.chartAppearance.compactAxisFontSize }, padding: 1, autoSkip: false } }
        }
      }
    });
  }

  function createHospitalPopup(hospital) {
    const statistics = hospital.statistics;
    const recruitmentChange = utilities.calculateRecruitmentChange(statistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);
    const activeDonors = utilities.getLatestValue(statistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(statistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(statistics, 'Tappingsvolum');
    const patientConsumption = utilities.getLatestValue(statistics, 'Pasientforbruk');
    const popupElement = document.createElement('div');

    popupElement.innerHTML = `
      <div class="popup-tag">${escapeHtml(hospital.role)}</div>
      <div class="popup-title">${escapeHtml(hospital.name)}</div>
      <div class="popup-sub">${escapeHtml(hospital.region)}</div>
      <div class="popup-stats">
        <div class="popup-stat"><b>${activeDonors ? utilities.formatNumber(activeDonors.value) : '–'}</b><span>Aktive blodgivere${activeDonors ? ` · ${activeDonors.year}` : ''}</span></div>
        <div class="popup-stat"><b>${newDonors ? utilities.formatNumber(newDonors.value) : '–'}</b><span>Nyrekruttering${newDonors ? ` · ${newDonors.year}` : ''}</span></div>
        <div class="popup-stat"><b>${collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–'}</b><span>Tapping${collectedBlood ? ` · ${collectedBlood.year}` : ''}</span></div>
        <div class="popup-stat"><b>${patientConsumption ? utilities.formatBloodVolume(patientConsumption.value) : '–'}</b><span>Pasientforbruk${patientConsumption ? ` · ${patientConsumption.year}` : ''}</span></div>
      </div>
      <div class="popup-beredskap"><span>Beredskapsstatus</span><strong>${recruitmentRisk.icon} ${recruitmentRisk.label}</strong></div>
      <div class="popup-status">Nedgang i nyrekruttering 2015–2025: ${utilities.calculateRecruitmentLoss(statistics) === null ? 'ikke beregnet' : utilities.formatNumber(utilities.calculateRecruitmentLoss(statistics))}</div>
      <button class="popup-view" type="button">Vis mer om sykehuset ↗</button>`;

    popupElement.querySelector('.popup-view').addEventListener('click', () => {
      window.location.href = `./hospital.html?id=${encodeURIComponent(hospital.id)}`;
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
      const recruitmentRisk = utilities.getRecruitmentRisk(utilities.calculateRecruitmentChange(hospital.statistics));
      const marker = window.L.marker([hospital.latitude, hospital.longitude], {
        icon: window.L.divIcon({
          className: 'hospital-marker-icon',
          html: `<span class="map-dot-wrap"><span class="map-dot ${recruitmentRisk.key}" aria-label="${recruitmentRisk.label}"></span></span>`,
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
      const flashConfiguration = configuration.map.markerFlash;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) return;

      function chooseNextMarker() {
        const availableMarkers = mapMarkers
          .map(marker => marker.getElement()?.querySelector('.map-dot'))
          .filter(markerElement => markerElement && !markerElement.classList.contains('is-flashing'));
        if (!availableMarkers.length) return;

        const selectedMarker = availableMarkers[Math.floor(Math.random() * availableMarkers.length)];
        selectedMarker.classList.add('is-flashing');
        window.setTimeout(() => selectedMarker.classList.remove('is-flashing'), flashConfiguration.animationDurationMilliseconds);
      }

      function scheduleNextMarkerFlash() {
        const interval = flashConfiguration.minimumStartIntervalMilliseconds
          + Math.random() * (flashConfiguration.maximumStartIntervalMilliseconds - flashConfiguration.minimumStartIntervalMilliseconds);
        window.setTimeout(() => {
          chooseNextMarker();
          scheduleNextMarkerFlash();
        }, interval);
      }

      scheduleNextMarkerFlash();
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

      mapSearchInput.value = result.name;
      mapSearchResults.hidden = true;
      map.flyTo([result.latitude, result.longitude], configuration.map.selectedZoom, { duration: configuration.timing.mapFlightSeconds });
      window.setTimeout(() => markerByHospitalId.get(result.id)?.openPopup(), 850);
    }

    function renderMapSearchResults(query) {
      const normalizedQuery = query.trim().toLocaleLowerCase('no');
      if (!normalizedQuery) {
        mapSearchResults.hidden = true;
        currentMapSearchResults = [];
        return;
      }

      const profileMatches = searchProfiles.filter(profile =>
        `${profile.name} ${profile.region} ${profile.searchTerms}`.toLocaleLowerCase('no').includes(normalizedQuery)
      );
      const hospitalMatches = hospitals.filter(hospital =>
        `${hospital.name} ${hospital.region} ${hospital.role}`.toLocaleLowerCase('no').includes(normalizedQuery)
      );
      currentMapSearchResults = [...profileMatches, ...hospitalMatches].slice(0, configuration.search.mapSuggestionLimit);

      mapSearchResults.innerHTML = currentMapSearchResults.length
        ? currentMapSearchResults.map((result, index) => `
            <button class="suggestion-item" data-index="${index}" type="button">
              <span class="suggestion-icon">⌖</span>
              <span class="suggestion-copy">
                <span class="suggestion-title">${escapeHtml(result.name)}</span>
                <span class="suggestion-sub">${escapeHtml(result.subtitle || `${result.region} · ${result.role}`)}</span>
              </span>
            </button>`).join('')
        : '<div class="suggestion-item"><span class="suggestion-copy"><span class="suggestion-title">Ingen treff</span></span></div>';
      mapSearchResults.hidden = false;
      mapSearchResults.querySelectorAll('button[data-index]').forEach(button => {
        button.addEventListener('click', () => navigateToMapResult(currentMapSearchResults[Number(button.dataset.index)]));
      });
    }

    mapSearchInput.addEventListener('input', () => renderMapSearchResults(mapSearchInput.value));
    mapSearchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        navigateToMapResult(currentMapSearchResults[0]);
      }
      if (event.key === 'Escape') mapSearchResults.hidden = true;
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.map-search-wrap')) mapSearchResults.hidden = true;
    });
    window.setTimeout(() => map.invalidateSize(), configuration.timing.mapSizeRefreshMilliseconds);
  }

  updateNationalSummary();

  const nationalChartMetrics = [
    { canvasId: 'activeChart', metricName: 'Aktive blodgivere', label: 'Aktive blodgivere', color: configuration.chartColors.activeDonors },
    { canvasId: 'newChart', metricName: 'Nyrekruttering', label: 'Nye blodgivere', color: configuration.chartColors.newDonors },
    { canvasId: 'collectionChart', metricName: 'Tappingsvolum', label: 'Tappingsvolum', color: configuration.chartColors.collections },
    { canvasId: 'consumptionChart', metricName: 'Pasientforbruk', label: 'Pasientforbruk', color: configuration.chartColors.patientConsumption }
  ];

  nationalChartMetrics.forEach(metric => createLineChart(
    metric.canvasId,
    nationalStatistics,
    metric.metricName,
    metric.label,
    metric.color
  ));
  drawNetBalanceChart();
  drawRecruitmentChangeChart();
  drawRecruitmentLossChart();
  initializeMap();
})();
