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
  const statisticNames = ['Aktive blodgivere', 'Nyrekruttering', 'Tappingsvolum'];

  function formatNumber(value) {
    return numberFormatter.format(value).replace(' ', '.').replace('−', '− ');
  }

  function formatLitres(value) {
    return litreFormatter.format(value);
  }

  function formatBloodVolume(bloodUnits) {
    const litreVolume = bloodUnits * configuration.formatting.bloodUnitLitres;
    return `${formatNumber(bloodUnits)} enheter\n${formatNumber(Math.round(litreVolume))} liter`;
  }

  function formatPercentage(value) {
    const sign = value < 0 ? '−' : value > 0 ? '+' : '';
    return `${sign} ${Math.abs(value).toFixed(1).replace('.', ',')} %`;
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

  function mergeStatistics(hospitalStatistics, healthFacilityStatistics) {
    const merged = { ...(hospitalStatistics || {}) };
    for (const metricName of statisticNames) {
      merged[metricName] = { ...(hospitalStatistics?.[metricName] || {}) };
      for (const [year, value] of Object.entries(healthFacilityStatistics?.[metricName] || {})) {
        if (merged[metricName][year] === null || merged[metricName][year] === undefined || merged[metricName][year] === '') {
          merged[metricName][year] = value;
        }
      }
    }
    return merged;
  }

  function calculateRecruitmentChange(statisticsRecord) {
    const recent = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const earlier = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);
    if (earlier === null || recent === null || earlier === 0) return null;
    return ((recent - earlier) / earlier) * 100;
  }

  function calculateRecruitmentLoss(statisticsRecord) {
    const recent = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const earlier = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);
    if (earlier === null || recent === null) return null;
    return earlier - recent;
  }

  function calculateDonorLoss(statisticsRecord) {
    const recent = getYearValue(statisticsRecord, 'Aktive blodgivere', comparisonYears.baselineYear);
    const earlier = getYearValue(statisticsRecord, 'Aktive blodgivere', comparisonYears.comparisonYear);
    if (earlier === null || recent === null) return null;
    return earlier - recent;
  }

  function getChangeLabel(loss, subject) {
    if (loss === null || !Number.isFinite(loss)) return `Kan ikke beregne endring i ${subject}`;
    if (loss > 0) return `Nedgang i ${subject}`;
    if (loss < 0) return `Oppgang i ${subject}`;
    return `Ingen endring i ${subject}`;
  }

  function getRecruitmentRisk(recruitmentChange) {
    if (recruitmentChange === null || !Number.isFinite(recruitmentChange)) {
      return { key: 'unknown', icon: '⚪', label: 'Ukjent', explanation: 'Mangler sammenlignbare årstall' };
    }
    if (recruitmentChange <= -recruitmentThresholds.severeDeclinePercent) {
      return { key: 'red', icon: '🔴', label: 'Rød', explanation: `${recruitmentThresholds.severeDeclinePercent} % eller mer fall` };
    }
    if (recruitmentChange <= -recruitmentThresholds.moderateDeclinePercent) {
      return { key: 'yellow', icon: '🟡', label: 'Gul', explanation: `${recruitmentThresholds.moderateDeclinePercent}–${(recruitmentThresholds.severeDeclinePercent - 0.1).toFixed(1).replace('.', ',')} % fall` };
    }
    return { key: 'green', icon: '🟢', label: 'Grønn', explanation: `Under ${recruitmentThresholds.moderateDeclinePercent} % fall` };
  }

  function createRecruitmentThresholdDescription(statisticsRecord) {
    const recent = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.baselineYear);
    const earlier = getYearValue(statisticsRecord, 'Nyrekruttering', comparisonYears.comparisonYear);
    const hasComparableYears = earlier !== null && recent !== null;
    const yearSummary = hasComparableYears
      ? `Status beregnet fra nyrekruttering i ${comparisonYears.comparisonYear} (${formatNumber(earlier)}) og ${comparisonYears.baselineYear} (${formatNumber(recent)}).`
      : `Status kan ikke beregnes fordi tall for ${comparisonYears.comparisonYear} eller ${comparisonYears.baselineYear} mangler.`;
    const moderateThreshold = recruitmentThresholds.moderateDeclinePercent;
    const finalYellowThreshold = (recruitmentThresholds.severeDeclinePercent - 0.1).toFixed(1).replace('.', ',');
    const severeThreshold = recruitmentThresholds.severeDeclinePercent;
    return `🟢 Grønn · under ${moderateThreshold} % fall | 🟡 Gul · ${moderateThreshold}–${finalYellowThreshold} % fall | 🔴 Rød · ${severeThreshold} % eller mer fall | ${yearSummary}`;
  }

  function createAverageStatistics(hospitals, healthFacilities) {
    const averageStatistics = {};
    const years = [...new Set(hospitals.flatMap(hospital => statisticNames.flatMap(metric => Object.keys(hospital[metric] || {}))))].sort();

    for (const metricName of statisticNames) {
      averageStatistics[metricName] = {};
      for (const year of years) {
        const uniqueSources = new Map();
        for (const hospital of hospitals) {
          let value = getYearValue(hospital, metricName, year);
          let sourceId = `sykehus:${hospital.ID || createSlug(hospital.Navn || '')}`;
          if (!hospital['Rapporterer selv']) {
            const healthFacility = healthFacilities[hospital['Helseforetak-ID']];
            if (healthFacility?.Rapporteringsnivå === 'Helseforetak') {
              value = getYearValue(healthFacility, metricName, year);
              sourceId = `helseforetak:${hospital['Helseforetak-ID']}`;
            } else {
              value = null;
            }
          }
          if (value !== null && !uniqueSources.has(sourceId)) uniqueSources.set(sourceId, value);
        }
        const values = [...uniqueSources.values()];
        averageStatistics[metricName][year] = values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
      }
    }

    averageStatistics.Beredskapsfunksjon = 'Gjennomsnitt per rapporterende enhet';
    averageStatistics.Helseregion = 'Norge';
    averageStatistics.Beredskapsnotat = 'Nasjonalt gjennomsnitt basert på unike rapporterende enheter.';
    averageStatistics.Forsyningslinje = 'Gjennomsnitt per rapporterende enhet';
    averageStatistics['Antall rapporterende enheter'] = {};
    for (const metricName of statisticNames) {
      for (const year of years) {
        // Use the same valid observations as the average series for its denominator.
        const valueCount = hospitals.reduce((sources, hospital) => {
          const isOwnReport = hospital['Rapporterer selv'];
          const healthFacility = healthFacilities[hospital['Helseforetak-ID']];
          const sourceId = isOwnReport
            ? `sykehus:${hospital.ID || createSlug(hospital.Navn || '')}`
            : healthFacility?.Rapporteringsnivå === 'Helseforetak' ? `helseforetak:${hospital['Helseforetak-ID']}` : null;
          const value = isOwnReport ? getYearValue(hospital, metricName, year)
            : healthFacility?.Rapporteringsnivå === 'Helseforetak' ? getYearValue(healthFacility, metricName, year) : null;
          if (sourceId && value !== null) sources.add(sourceId);
          return sources;
        }, new Set()).size;
        averageStatistics['Antall rapporterende enheter'][year] = valueCount;
      }
    }
    return averageStatistics;
  }

  function formatMeasurement(value, measurementType) {
    if (measurementType === 'blood') return formatBloodVolume(value);
    if (measurementType === 'percentage') return formatPercentage(value);
    return formatNumber(value);
  }

  window.APP_UTILS = Object.freeze({
    formatNumber, formatLitres, formatBloodVolume, formatPercentage, createSlug,
    getYearValue, getSeries, getLatestValue, mergeStatistics,
    calculateRecruitmentChange, calculateRecruitmentLoss, calculateDonorLoss,
    getChangeLabel, getRecruitmentRisk, createRecruitmentThresholdDescription,
    createAverageStatistics, formatMeasurement
  });
})();
