(async () => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const utilities = window.APP_UTILS;
  const getElement = elementId => document.getElementById(elementId);
  const profileId = new URLSearchParams(window.location.search).get('id') || 'unn-narvik';

  await window.EXTERNAL_DEPENDENCIES_READY;

  try {
    const datasetResponse = await fetch(configuration.data.statisticsDatasetUrl, { cache: 'no-store' });
    if (!datasetResponse.ok) throw new Error(`Statistikkgrunnlaget kunne ikke hentes (${datasetResponse.status}).`);
    const sourceStatistics = await datasetResponse.json();
    const nationalStatistics = sourceStatistics[configuration.data.nationalRecordName];
    const averageStatistics = utilities.createAverageStatistics(
      nationalStatistics,
      configuration.hospitalProfiles.expectedHospitalCount
    );
    const hospitalEntries = Object.entries(sourceStatistics)
      .filter(([recordName]) => recordName !== configuration.data.nationalRecordName);
    const hospitalRecords = hospitalEntries.map(([hospitalName, hospitalStatistics]) => ({
      id: utilities.createSlug(hospitalName),
      name: hospitalName,
      region: hospitalStatistics['Helseregion'],
      role: hospitalStatistics['Beredskapsfunksjon'],
      statistics: hospitalStatistics,
      type: 'hospital'
    }));

    let selectedProfile;
    if (profileId === configuration.hospitalProfiles.nationalProfileId) {
      selectedProfile = {
        id: profileId,
        name: configuration.hospitalProfiles.nationalProfileName,
        region: 'Norge',
        role: 'Nasjonal transfusjonsstatistikk',
        statistics: nationalStatistics,
        type: 'national'
      };
    } else if (profileId === configuration.hospitalProfiles.averageProfileId) {
      selectedProfile = {
        id: profileId,
        name: configuration.hospitalProfiles.averageProfileName,
        region: 'Norge',
        role: configuration.hospitalProfiles.averageProfileSubtitle,
        statistics: averageStatistics,
        type: 'average'
      };
    } else {
      selectedProfile = hospitalRecords.find(hospital => hospital.id === profileId);
    }

    if (!selectedProfile) throw new Error('Fant ikke profilen i statistikkgrunnlaget.');

    const profileName = selectedProfile.name;
    const profileStatistics = selectedProfile.statistics;
    const isAggregateProfile = selectedProfile.type !== 'hospital';
    window.APP_DATA = {
      national: nationalStatistics,
      hospitals: hospitalRecords,
      searchProfiles: [
        {
          id: configuration.hospitalProfiles.nationalProfileId,
          name: configuration.hospitalProfiles.nationalProfileName,
          region: 'Norge',
          subtitle: configuration.hospitalProfiles.nationalProfileSubtitle,
          searchTerms: configuration.hospitalProfiles.nationalSearchTerms
        },
        {
          id: configuration.hospitalProfiles.averageProfileId,
          name: configuration.hospitalProfiles.averageProfileName,
          region: 'Norge',
          subtitle: configuration.hospitalProfiles.averageProfileSubtitle,
          searchTerms: configuration.hospitalProfiles.averageSearchTerms
        }
      ],
      raw: sourceStatistics
    };

    getElement('hospital-title').textContent = profileName;
    getElement('hospital-breadcrumb').textContent = profileName;
    getElement('hospital-subtitle').textContent = `${selectedProfile.role} · ${selectedProfile.region}`;
    document.title = `${profileName} – Blodberedskap Norge`;

    const recruitmentChange = utilities.calculateRecruitmentChange(profileStatistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);
    const recruitmentLoss = utilities.calculateRecruitmentLoss(profileStatistics);
    const recruitmentIn2025 = utilities.getYearValue(profileStatistics, 'Nyrekruttering', configuration.comparisonYears.baselineYear);
    const recruitmentIn2015 = utilities.getYearValue(profileStatistics, 'Nyrekruttering', configuration.comparisonYears.comparisonYear);

    const riskBadge = getElement('hospital-risk');
    riskBadge.className = `risk-pill risk-${recruitmentRisk.key}`;
    riskBadge.innerHTML = `<span>${recruitmentRisk.icon}</span><span>${recruitmentRisk.label}</span>`;
    getElement('beredskap-value').textContent = `${recruitmentRisk.icon} ${recruitmentRisk.label}`;
    getElement('beredskap-rule').textContent = utilities.createRecruitmentThresholdDescription(profileStatistics);
    getElement('recruitment-summary').textContent = recruitmentChange === null ? 'Kan ikke beregnes' : utilities.formatPercentage(recruitmentChange);
    getElement('recruitment-detail').textContent = recruitmentIn2015 !== null && recruitmentIn2025 !== null && recruitmentLoss !== null
      ? `${utilities.formatNumber(recruitmentIn2015)} i ${configuration.comparisonYears.baselineYear} → ${utilities.formatNumber(recruitmentIn2025)} i ${configuration.comparisonYears.comparisonYear} · Nedgang i nyrekruttering: ${utilities.formatNumber(recruitmentLoss)}`
      : 'Mangler sammenlignbare 2015- og 2025-tall.';
    getElement('beredskapsnotat-value').textContent = profileStatistics['Beredskapsnotat'] || 'Ikke oppgitt';
    getElement('supply-line').textContent = profileStatistics['Forsyningslinje'] || 'Ikke oppgitt';
    getElement('supply-detail').textContent = 'Oppgitt forsyningslinje';

    const activeDonors = utilities.getLatestValue(profileStatistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(profileStatistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(profileStatistics, 'Tappingsvolum');
    const patientConsumption = utilities.getLatestValue(profileStatistics, 'Pasientforbruk');

    getElement('h-kpi-active').textContent = activeDonors ? utilities.formatNumber(activeDonors.value) : '–';
    getElement('h-kpi-active-note').textContent = activeDonors ? `År ${activeDonors.year} · personer` : 'Ingen data';
    getElement('h-kpi-new').textContent = newDonors ? utilities.formatNumber(newDonors.value) : '–';
    getElement('h-kpi-new-note').textContent = newDonors ? `År ${newDonors.year} · personer` : 'Ingen data';
    getElement('h-kpi-units').textContent = collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–';
    getElement('h-kpi-units').classList.add('kpi-blood-value');
    getElement('h-kpi-litres').textContent = collectedBlood ? `Tapping · ${collectedBlood.year}` : 'Ingen data';
    getElement('h-kpi-consumption').textContent = patientConsumption ? utilities.formatBloodVolume(patientConsumption.value) : '–';
    getElement('h-kpi-consumption').classList.add('kpi-blood-value');
    getElement('h-kpi-consumption-note').textContent = patientConsumption ? `Pasientforbruk · ${patientConsumption.year}` : 'Ingen data';
    getElement('h-kpi-recruitment-loss').textContent = recruitmentLoss === null ? '–' : utilities.formatNumber(recruitmentLoss);
    getElement('h-kpi-recruitment-loss-note').textContent = '2015 minus 2025';

    function createLineChart(canvasId, metricName, metricLabel, lineColor) {
      const canvas = getElement(canvasId);
      const emptyMessage = document.querySelector(`[data-empty="${canvasId}"]`);
      const dataPoints = utilities.getSeries(profileStatistics, metricName);
      if (!canvas || !window.Chart || !dataPoints.length) {
        emptyMessage?.classList.add('visible');
        return;
      }
      emptyMessage?.classList.remove('visible');

      const isBloodMetric = ['Tappingsvolum', 'Pasientforbruk'].includes(metricName);
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
              callbacks: {
                title: tooltipItems => utilities.formatMeasurement(tooltipItems[0]?.raw ?? 0, isBloodMetric ? 'blood' : 'people'),
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
              title: { display: true, text: isBloodMetric ? 'Blodenheter' : 'Personer', color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize, weight: '600' } },
              ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize } }
            }
          }
        }
      });
    }

    function createNetBalanceSeries() {
      const consumptionByYear = new Map(
        utilities.getSeries(profileStatistics, 'Pasientforbruk').map(point => [point.year, point.value])
      );
      return utilities.getSeries(profileStatistics, 'Tappingsvolum')
        .filter(point => consumptionByYear.has(point.year))
        .map(point => ({ year: point.year, value: point.value - consumptionByYear.get(point.year) }));
    }

    function createNetBalanceChart() {
      const canvas = getElement('hNetBalanceChart');
      const emptyMessage = document.querySelector('[data-empty="hNetBalanceChart"]');
      const balancePoints = createNetBalanceSeries();
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
              ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize } }
            }
          }
        }
      });
    }

    const profileMetrics = [
      { canvasId: 'hActiveChart', metricName: 'Aktive blodgivere', label: 'Aktive blodgivere', color: configuration.chartColors.activeDonors },
      { canvasId: 'hNewChart', metricName: 'Nyrekruttering', label: 'Nyrekruttering', color: configuration.chartColors.newDonors },
      { canvasId: 'hCollectionChart', metricName: 'Tappingsvolum', label: 'Tappingsvolum', color: configuration.chartColors.collections },
      { canvasId: 'hConsumptionChart', metricName: 'Pasientforbruk', label: 'Pasientforbruk', color: configuration.chartColors.patientConsumption }
    ];
    profileMetrics.forEach(metric => createLineChart(metric.canvasId, metric.metricName, metric.label, metric.color));
    createNetBalanceChart();

    const availableYears = Object.values(profileStatistics)
      .filter(value => value && typeof value === 'object')
      .flatMap(value => Object.keys(value).map(Number))
      .filter(Number.isFinite);
    if (availableYears.length) {
      getElement('data-period').textContent = `Dataperiode i denne profilen: ${Math.min(...availableYears)}–${Math.max(...availableYears)}.`;
    }

    if (isAggregateProfile) {
      getElement('profile-type-label').textContent = selectedProfile.type === 'national'
        ? 'Nasjonale tall'
        : `Nasjonale tall delt på ${configuration.hospitalProfiles.expectedHospitalCount}`;
    } else {
      getElement('profile-type-label').textContent = 'Sykehustall';
    }
  } catch (error) {
    console.error(error);
    getElement('hospital-title').textContent = 'Kunne ikke åpne statistikkprofilen';
    getElement('hospital-subtitle').textContent = error.message;
  }
})();
