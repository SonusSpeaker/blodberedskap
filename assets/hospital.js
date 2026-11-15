(async () => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const utilities = window.APP_UTILS;
  const getElement = elementId => document.getElementById(elementId);
  const profileId = new URLSearchParams(window.location.search).get('id') || 'unn-narvik';
  await window.EXTERNAL_DEPENDENCIES_READY;

  try {
    const response = await fetch(configuration.data.statisticsDatasetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Statistikkfilen kunne ikke hentes (${response.status}).`);
    const sourceStatistics = await response.json();
    const nationalStatistics = sourceStatistics[configuration.data.nationalRecordName];
    const rawHealthFacilities = sourceStatistics.helseforetak || {};
    const healthFacilities = Object.entries(rawHealthFacilities).map(([id, item]) => ({
      id, name: item.Navn, region: item.Helseregion, type: item.Type,
      searchTerms: item.Soketermer || '', statistics: item
    }));
    const hospitalRecords = Object.entries(sourceStatistics.sykehus || {}).map(([id, item]) => {
      const facility = rawHealthFacilities[item['Helseforetak-ID']];
      const usesFacilityStatistics = !item['Rapporterer selv'] && Boolean(facility);
      return {
        id, name: item.Navn, region: item.Helseregion, role: item.Beredskapsfunksjon,
        healthFacilityId: item['Helseforetak-ID'], healthFacilityName: item.Helseforetak,
        healthFacilityMemberCount: facility?.['Sykehus-ID']?.length || 0,
        usesHealthFacilityStatistics: usesFacilityStatistics,
        statistics: usesFacilityStatistics ? facility : item,
        type: 'hospital'
      };
    });
    const averageStatistics = utilities.createAverageStatistics(
      Object.values(sourceStatistics.sykehus || {}), rawHealthFacilities
    );
    const searchProfiles = [
      { id: configuration.hospitalProfiles.nationalProfileId, name: configuration.hospitalProfiles.nationalProfileName, region: 'Norge', subtitle: configuration.hospitalProfiles.nationalProfileSubtitle, searchTerms: configuration.hospitalProfiles.nationalSearchTerms },
      { id: configuration.hospitalProfiles.averageProfileId, name: configuration.hospitalProfiles.averageProfileName, region: 'Norge', subtitle: configuration.hospitalProfiles.averageProfileSubtitle, searchTerms: configuration.hospitalProfiles.averageSearchTerms }
    ];
    window.APP_DATA = { national: nationalStatistics, hospitals: hospitalRecords, healthFacilities, searchProfiles, raw: sourceStatistics };

    let selectedProfile;
    if (profileId === configuration.hospitalProfiles.nationalProfileId) {
      selectedProfile = {
        id: profileId, name: configuration.hospitalProfiles.nationalProfileName,
        region: 'Norge', role: 'Nasjonal transfusjonsstatistikk',
        statistics: nationalStatistics, type: 'national'
      };
    } else if (profileId === configuration.hospitalProfiles.averageProfileId) {
      selectedProfile = {
        id: profileId, name: configuration.hospitalProfiles.averageProfileName,
        region: 'Norge', role: configuration.hospitalProfiles.averageProfileSubtitle,
        statistics: averageStatistics, type: 'average'
      };
    } else {
      selectedProfile = hospitalRecords.find(hospital => hospital.id === profileId);
    }
    if (!selectedProfile) throw new Error('Fant ikke profilen i statistikkfilen.');

    const profileStatistics = selectedProfile.statistics;
    const isAggregateProfile = ['national', 'average'].includes(selectedProfile.type);
    getElement('hospital-title').textContent = selectedProfile.name;
    getElement('hospital-subtitle').textContent = selectedProfile.type === 'hospital'
      ? `${selectedProfile.role} · ${selectedProfile.region}`
      : selectedProfile.role;
    getElement('hospital-breadcrumb').textContent = selectedProfile.name;

    if (selectedProfile.type === 'hospital' && selectedProfile.usesHealthFacilityStatistics) {
      getElement('profile-type-label').textContent = selectedProfile.healthFacilityMemberCount > 1
        ? `Statistikk rapporteres samlet for ${selectedProfile.healthFacilityName} – tallene gjelder hele helseforetaket.`
        : `Statistikk rapporteres for ${selectedProfile.healthFacilityName}, som har ett traumesykehus i oversikten.`;
    } else {
      getElement('profile-type-label').textContent = selectedProfile.type === 'national'
        ? 'Nasjonale tall'
        : selectedProfile.type === 'average'
          ? 'Gjennomsnitt basert på unike rapporterende enheter'
          : 'Sykehustall';
    }

    const recruitmentChange = utilities.calculateRecruitmentChange(profileStatistics);
    const recruitmentLoss = utilities.calculateRecruitmentLoss(profileStatistics);
    const donorLoss = utilities.calculateDonorLoss(profileStatistics);
    const recruitmentRisk = utilities.getRecruitmentRisk(recruitmentChange);
    const riskElement = getElement('hospital-risk');
    riskElement.className = `risk-pill risk-${recruitmentRisk.key}`;
    riskElement.innerHTML = `<span>${recruitmentRisk.icon}</span><span>${recruitmentRisk.label}</span>`;
    getElement('beredskap-value').textContent = `${recruitmentRisk.icon} ${recruitmentRisk.label}`;
    getElement('beredskap-rule').textContent = utilities.createRecruitmentThresholdDescription(profileStatistics);
    getElement('recruitment-summary').textContent = recruitmentChange === null ? 'Kan ikke beregnes' : utilities.formatPercentage(recruitmentChange);
    const recruitmentChangeLabel = utilities.getChangeLabel(recruitmentLoss, 'nyrekruttering');
    getElement('recruitment-detail').textContent = recruitmentLoss === null
      ? `Mangler sammenlignbare tall for ${configuration.comparisonYears.comparisonYear} og ${configuration.comparisonYears.baselineYear}.`
      : `${recruitmentChangeLabel}: ${utilities.formatNumber(Math.abs(recruitmentLoss))} personer · ${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}.`;
    getElement('beredskapsnotat-value').textContent = profileStatistics.Beredskapsnotat || selectedProfile.role || 'Ikke oppgitt';
    getElement('supply-line').textContent = profileStatistics.Forsyningslinje || 'Ikke oppgitt';
    getElement('supply-detail').textContent = 'Oppgitt forsyningslinje';

    const activeDonors = utilities.getLatestValue(profileStatistics, 'Aktive blodgivere');
    const newDonors = utilities.getLatestValue(profileStatistics, 'Nyrekruttering');
    const collectedBlood = utilities.getLatestValue(profileStatistics, 'Tappingsvolum');
    getElement('h-kpi-active').textContent = activeDonors ? utilities.formatNumber(activeDonors.value) : '–';
    getElement('h-kpi-active-note').textContent = activeDonors ? `År ${activeDonors.year} · personer` : 'Ingen data';
    getElement('h-kpi-new').textContent = newDonors ? utilities.formatNumber(newDonors.value) : '–';
    getElement('h-kpi-new-note').textContent = newDonors ? `År ${newDonors.year} · personer` : 'Ingen data';
    getElement('h-kpi-recruitment-loss-label').textContent = utilities.getChangeLabel(recruitmentLoss, 'nyrekruttering');
    getElement('h-kpi-recruitment-loss').textContent = recruitmentLoss === null ? '–' : utilities.formatNumber(Math.abs(recruitmentLoss));
    getElement('h-kpi-recruitment-loss-note').textContent = `${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}`;
    getElement('h-kpi-donor-loss-label').textContent = utilities.getChangeLabel(donorLoss, 'aktive blodgivere');
    getElement('h-kpi-donor-loss').textContent = donorLoss === null ? '–' : utilities.formatNumber(Math.abs(donorLoss));
    getElement('h-kpi-donor-loss-note').textContent = `${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}`;
    getElement('h-kpi-units').textContent = collectedBlood ? utilities.formatBloodVolume(collectedBlood.value) : '–';
    getElement('h-kpi-units').classList.add('kpi-blood-value');
    getElement('h-kpi-litres').textContent = collectedBlood ? `Fullblodstappinger · ${collectedBlood.year}` : 'Ingen data';

    function createLineChart(canvasId, metricName, metricLabel, lineColor) {
      const canvas = getElement(canvasId);
      const emptyMessage = document.querySelector(`[data-empty="${canvasId}"]`);
      const points = utilities.getSeries(profileStatistics, metricName);
      if (!canvas || !window.Chart || !points.length) {
        emptyMessage?.classList.add('visible');
        return;
      }
      emptyMessage?.classList.remove('visible');
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: points.map(point => String(point.year)),
          datasets: [{
            label: metricLabel, data: points.map(point => point.value),
            borderColor: lineColor, backgroundColor: `${lineColor}1b`,
            borderWidth: configuration.chartAppearance.lineBorderWidth,
            pointRadius: configuration.chartAppearance.linePointRadius,
            pointHoverRadius: configuration.chartAppearance.lineHoverRadius,
            tension: configuration.chartAppearance.lineTension, fill: true
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: configuration.chartAppearance.tooltipBackground,
              callbacks: {
                title: items => utilities.formatMeasurement(items[0]?.raw ?? 0, metricName === 'Tappingsvolum' ? 'blood' : 'people'),
                label: context => `År ${context.label} · ${metricLabel}`
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize }, maxRotation: 0, autoSkip: true } },
            y: {
              beginAtZero: true, grid: { color: configuration.chartAppearance.grid }, border: { display: false },
              title: { display: true, text: metricName === 'Tappingsvolum' ? 'Blodenheter' : 'Personer', color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize, weight: '600' } },
              ticks: { color: configuration.chartAppearance.axisText, font: { size: configuration.chartAppearance.axisFontSize } }
            }
          }
        }
      });
    }

    [
      { canvasId: 'hActiveChart', metricName: 'Aktive blodgivere', label: 'Aktive blodgivere', color: configuration.chartColors.activeDonors },
      { canvasId: 'hNewChart', metricName: 'Nyrekruttering', label: 'Nyrekruttering', color: configuration.chartColors.newDonors },
      { canvasId: 'hCollectionChart', metricName: 'Tappingsvolum', label: 'Fullblodstappinger', color: configuration.chartColors.collections }
    ].forEach(metric => createLineChart(metric.canvasId, metric.metricName, metric.label, metric.color));

    const availableYears = ['Aktive blodgivere', 'Nyrekruttering', 'Tappingsvolum']
      .flatMap(metric => Object.keys(profileStatistics[metric] || {}).map(Number))
      .filter(Number.isFinite);
    if (availableYears.length) getElement('data-period').textContent = `Dataperiode i denne profilen: ${Math.min(...availableYears)}–${Math.max(...availableYears)}.`;
  } catch (error) {
    console.error(error);
    getElement('hospital-title').textContent = 'Kunne ikke åpne statistikkprofilen';
    getElement('hospital-subtitle').textContent = error.message;
  }
})();
