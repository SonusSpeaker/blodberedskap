(() => {
  'use strict';

  const configuration = window.APP_CONFIG;
  const recruitmentThresholds = configuration.recruitmentThresholds;
  const comparisonYears = configuration.comparisonYears;
  const numberFormatter = new Intl.NumberFormat(configuration.formatting.numberLocale, {
    maximumFractionDigits: configuration.formatting.maximumNumberFractionDigits
  });
  const litreFormatter = new Intl.NumberFormat(configuration.formatting.numberLocale, {
    maximumFractionDigits: configuration.formatting.maximumLitresFractionDigits
  });

  function formatNumber(value) {
    return numberFormatter.format(value);
  }

  function formatLitres(value) {
    return litreFormatter.format(value);
  }

  function formatBloodVolume(bloodUnits) {
    const litreVolume = bloodUnits * configuration.formatting.bloodUnitLitres;
    return `${formatNumber(bloodUnits)} enheter / ${formatLitres(Math.round(litreVolume))} liter`;
  }

  function formatPercentage(value) {
    const sign = value < 0 ? '−' : value > 0 ? '+' : '';
    return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
  }

  function createSlug(value) {
    return value.toLocaleLowerCase('no')
      .replaceAll('æ', 'ae')
      .replaceAll('ø', 'o')
      .replaceAll('å', 'a')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function getYearValue(statisticsRecord, metricName, year) {
    const rawValue = statisticsRecord?.[metricName]?.[String(year)];
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function getSeries(statisticsRecord, metricName) {
    const metricValues = statisticsRecord?.[metricName] || {};
    return Object.entries(metricValues)
      .map(([year, rawValue]) => ({ year: Number(year), value: rawValue === null || rawValue === '' ? null : Number(rawValue) }))
      .filter(point => Number.isInteger(point.year) && point.value !== null && Number.isFinite(point.value))
      .sort((firstPoint, secondPoint) => firstPoint.year - secondPoint.year);
  }

  function getLatestValue(statisticsRecord, metricName) {
    return getSeries(statisticsRecord, metricName).at(-1) || null;
  }

  function calculateRecruitmentChange(statisticsRecord) {
    const recruitmentIn2015 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const recruitmentIn2025 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);

    if (recruitmentIn2015 === null || recruitmentIn2025 === null || recruitmentIn2015 === 0) {
      return null;
    }

    return ((recruitmentIn2025 - recruitmentIn2015) / recruitmentIn2015) * 100;
  }

  function calculateRecruitmentLoss(statisticsRecord) {
    const recruitmentIn2015 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const recruitmentIn2025 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);

    if (recruitmentIn2015 === null || recruitmentIn2025 === null) {
      return null;
    }

    return recruitmentIn2015 - recruitmentIn2025;
  }

  function getRecruitmentRisk(recruitmentChange) {
    if (recruitmentChange === null || !Number.isFinite(recruitmentChange)) {
      return { key: 'unknown', icon: '⚪', label: 'Ukjent', explanation: 'Mangler 2015- eller 2025-tall' };
    }
    if (recruitmentChange <= -recruitmentThresholds.severeDeclinePercent) {
      return { key: 'red', icon: '🔴', label: 'Rød', explanation: `${recruitmentThresholds.severeDeclinePercent} %  eller mer fall` };
    }
    if (recruitmentChange <= -recruitmentThresholds.moderateDeclinePercent) {
      return { key: 'yellow', icon: '🟡', label: 'Gul', explanation: `${recruitmentThresholds.moderateDeclinePercent}–${(recruitmentThresholds.severeDeclinePercent - 0.1).toFixed(1).replace('.', ',')} %  fall` };
    }
    return { key: 'green', icon: '🟢', label: 'Grønn', explanation: `Under ${recruitmentThresholds.moderateDeclinePercent} %  fall` };
  }

  function createRecruitmentThresholdDescription(statisticsRecord) {
    const recruitmentIn2015 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const recruitmentIn2025 = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);
    const hasComparableYears = recruitmentIn2015 !== null && recruitmentIn2025 !== null;
    const yearSummary = hasComparableYears
      ? `Status beregnet fra nyrekruttering i ${comparisonYears.baselineYear} (${formatNumber(recruitmentIn2015)}) og ${comparisonYears.comparisonYear} (${formatNumber(recruitmentIn2025)}).`
      : 'Status kan ikke beregnes fordi 2015- eller 2025-tall mangler.';

    const moderateThreshold = recruitmentThresholds.moderateDeclinePercent;
    const finalYellowThreshold = (recruitmentThresholds.severeDeclinePercent - 0.1).toFixed(1).replace('.', ',');
    const severeThreshold = recruitmentThresholds.severeDeclinePercent;
    return `🟢 Grønn · under ${moderateThreshold} % fall | 🟡 Gul · ${moderateThreshold}–${finalYellowThreshold} % fall | 🔴 Rød · ${severeThreshold} % eller mer fall | ${yearSummary}`;
  }

  function createAverageStatistics(nationalStatistics, hospitalCount) {
    const averageStatistics = {};

    for (const [fieldName, fieldValue] of Object.entries(nationalStatistics)) {
      if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
        averageStatistics[fieldName] = Object.fromEntries(
          Object.entries(fieldValue).map(([year, value]) => [year, Number(value) / hospitalCount])
        );
      } else {
        averageStatistics[fieldName] = fieldValue;
      }
    }

    averageStatistics['Beredskapsfunksjon'] = 'Gjennomsnitt per traumesykehus';
    averageStatistics['Helseregion'] = 'Norge';
    averageStatistics['Breddegrad'] = null;
    averageStatistics['Lengdegrad'] = null;
    averageStatistics['Beredskapsnotat'] = `Nasjonale verdier fordelt på ${hospitalCount} traumesykehus.`;
    averageStatistics['Forsyningslinje'] = `Gjennomsnitt per sykehus (${hospitalCount})`;
    return averageStatistics;
  }

  function formatMeasurement(value, measurementType) {
    if (measurementType === 'blood') return formatBloodVolume(value);
    if (measurementType === 'percentage') return `${formatPercentage(value)}`;
    return `${formatNumber(value)} personer`;
  }

  window.APP_UTILS = Object.freeze({
    formatNumber,
    formatLitres,
    formatBloodVolume,
    formatPercentage,
    createSlug,
    getYearValue,
    getSeries,
    getLatestValue,
    calculateRecruitmentChange,
    calculateRecruitmentLoss,
    getRecruitmentRisk,
    createRecruitmentThresholdDescription,
    createAverageStatistics,
    formatMeasurement
  });
})();
