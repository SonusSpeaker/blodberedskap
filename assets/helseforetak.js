(async () => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const utilities = window.APP_UTILS;
  const getElement = elementId => document.getElementById(elementId);
  const profileId = new URLSearchParams(window.location.search).get('id');
  await window.EXTERNAL_DEPENDENCIES_READY;

  try {
    const response = await fetch(configuration.data.statisticsDatasetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Statistikkfilen kunne ikke hentes (${response.status}).`);
    const sourceStatistics = await response.json();
    const rawFacilities = sourceStatistics.helseforetak || {};
    const rawHospitals = sourceStatistics.sykehus || {};
    const nationalStatistics = sourceStatistics[configuration.data.nationalRecordName];
    const facilityRecords = Object.entries(rawFacilities).map(([id, item]) => ({
      id, name: item.Navn, region: item.Helseregion, type: item.Type,
      subtitle: `${item.Type === 'Region' ? 'Helseregion' : 'Helseforetak'} · ${item.Helseregion}`,
      searchTerms: item.Soketermer || '', statistics: item
    }));
    const hospitalRecords = Object.entries(rawHospitals).map(([id, item]) => ({
      id, name: item.Navn, region: item.Helseregion,
      healthFacilityName: item.Helseforetak
    }));
    const searchProfiles = [
      { id: configuration.hospitalProfiles.nationalProfileId, name: configuration.hospitalProfiles.nationalProfileName, region: 'Norge', subtitle: configuration.hospitalProfiles.nationalProfileSubtitle, searchTerms: configuration.hospitalProfiles.nationalSearchTerms },
      { id: configuration.hospitalProfiles.averageProfileId, name: configuration.hospitalProfiles.averageProfileName, region: 'Norge', subtitle: configuration.hospitalProfiles.averageProfileSubtitle, searchTerms: configuration.hospitalProfiles.averageSearchTerms }
    ];
    window.APP_DATA = { national: nationalStatistics, hospitals: hospitalRecords, healthFacilities: facilityRecords, searchProfiles, raw: sourceStatistics };

    const selectedFacility = rawFacilities[profileId];
    if (!selectedFacility) throw new Error('Fant ikke helseforetaket eller regionen i statistikkfilen.');
    const isRegion = selectedFacility.Type === 'Region';
    const title = selectedFacility.Navn;
    getElement('hospital-title').textContent = title;
    getElement('hospital-subtitle').textContent = `${isRegion ? 'Helseregion' : 'Helseforetak'} · ${selectedFacility.Helseregion}`;
    getElement('hospital-breadcrumb').textContent = title;
    getElement('profile-type-label').textContent = selectedFacility.Rapporteringsnivå === 'Summert fra sykehusrapporter'
      ? 'Helseforetakstall summert fra sykehusenes egne rapporter.'
      : isRegion
        ? 'Regionstall samlet fra helseforetakene i regionen.'
        : 'Tallene rapporteres samlet på helseforetaksnivå.';

    const memberHospitals = (selectedFacility['Sykehus-ID'] || [])
      .map(id => ({ id, ...(rawHospitals[id] || {}) }))
      .filter(item => item.Navn)
      .sort((first, second) => first.Navn.localeCompare(second.Navn, 'no'));
    const hospitalList = getElement('healthfacility-hospital-list');
    hospitalList.innerHTML = memberHospitals.length
      ? memberHospitals.map(hospital => `
          <li><a href="./hospital.html?id=${encodeURIComponent(hospital.id)}">${window.escapeHtml(hospital.Navn)}</a>
            <span>${window.escapeHtml(hospital['Beredskapsfunksjon'] || 'Sykehus')}</span></li>`).join('')
      : '<li>Ingen sykehus er oppført.</li>';
    getElement('healthfacility-hospital-count').textContent = String(memberHospitals.length);
    getElement('healthfacility-list-title').textContent = isRegion ? 'Sykehus i regionen' : 'Sykehus i helseforetaket';

    const profileStatistics = selectedFacility;
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
    getElement('recruitment-detail').textContent = recruitmentLoss === null
      ? `Mangler sammenlignbare tall for ${configuration.comparisonYears.comparisonYear} og ${configuration.comparisonYears.baselineYear}.`
      : `${utilities.getChangeLabel(recruitmentLoss, 'nyrekruttering')}: ${utilities.formatNumber(Math.abs(recruitmentLoss))} personer · ${configuration.comparisonYears.baselineYear} sammenliknet med ${configuration.comparisonYears.comparisonYear}.`;
    getElement('beredskapsnotat-value').textContent = profileStatistics.Beredskapsnotat || 'Ikke oppgitt';
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

    const years = ['Aktive blodgivere', 'Nyrekruttering', 'Tappingsvolum']
      .flatMap(metric => Object.keys(profileStatistics[metric] || {}).map(Number)).filter(Number.isFinite);
    if (years.length) getElement('data-period').textContent = `Dataperiode i denne profilen: ${Math.min(...years)}–${Math.max(...years)}.`;
  } catch (error) {
    console.error(error);
    getElement('hospital-title').textContent = 'Kunne ikke åpne statistikkprofilen';
    getElement('hospital-subtitle').textContent = error.message;
  }
})();
