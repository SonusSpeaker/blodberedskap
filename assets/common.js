(() => {
  'use strict';

  const pageName = document.body.dataset.page || 'home';
  const searchLimits = window.APP_CONFIG.search;
  const statisticsNavigationItems = [
    { id: 'active-donors', title: 'Aktive blodgivere', keywords: 'aktive givere blodgiver antall donor blodbank' },
    { id: 'new-donors', title: 'Nyrekruttering', keywords: 'nye givere rekruttering nyrekruttering førstegangsgiver' },
    { id: 'collections', title: 'Tappingsvolum', keywords: 'tapping fullblodstappinger blod tappet volum blodposer blodenheter liter produksjon' },
    { id: 'recruitment', title: 'Endringer i nyrekruttering', keywords: 'rekrutteringsfall oppgang nedgang prosent personer færre flere givere utvikling status' }
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function getHospitalSearchItems() { return window.APP_DATA?.hospitals || []; }
  function getProfileSearchItems() { return window.APP_DATA?.searchProfiles || []; }
  function getHealthFacilitySearchItems() { return window.APP_DATA?.healthFacilities || []; }

  function renderGlobalSearchResults(query, resultsElement, navigateToResult) {
    const normalizedQuery = query.trim().toLocaleLowerCase('no');
    if (!normalizedQuery) {
      resultsElement.hidden = true;
      return [];
    }

    const profileResults = getProfileSearchItems()
      .filter(profile => `${profile.name} ${profile.region} ${profile.searchTerms || ''}`.toLocaleLowerCase('no').includes(normalizedQuery))
      .map(profile => ({
        title: profile.name,
        subtitle: profile.subtitle,
        icon: '⌖',
        destination: `./hospital.html?id=${encodeURIComponent(profile.id)}`
      }));

    const healthFacilityResults = getHealthFacilitySearchItems()
      .filter(item => `${item.name} ${item.region} ${item.searchTerms || ''}`.toLocaleLowerCase('no').includes(normalizedQuery))
      .slice(0, searchLimits.hospitalSuggestionLimit)
      .map(item => ({
        title: item.name,
        subtitle: `${item.type === 'Region' ? 'Helseregion' : 'Helseforetak'} · ${item.region}`,
        icon: '⌖',
        destination: `./helseforetak.html?id=${encodeURIComponent(item.id)}`
      }));

    const hospitalResults = getHospitalSearchItems()
      .filter(hospital => `${hospital.name} ${hospital.region} ${hospital.healthFacilityName || ''}`.toLocaleLowerCase('no').includes(normalizedQuery))
      .slice(0, searchLimits.hospitalSuggestionLimit)
      .map(hospital => ({
        title: hospital.name,
        subtitle: `${hospital.region} · Sykehusprofil`,
        icon: '⌖',
        destination: `./hospital.html?id=${encodeURIComponent(hospital.id)}`
      }));

    const statisticResults = statisticsNavigationItems
      .filter(statistic => `${statistic.title} ${statistic.keywords}`.toLocaleLowerCase('no').includes(normalizedQuery))
      .map(statistic => ({
        title: statistic.title,
        subtitle: 'Statistikk',
        icon: '↗',
        destination: pageName === 'about' ? `./#${statistic.id}` : `#${statistic.id}`
      }));

    const aboutResults = 'om prosjektet'.includes(normalizedQuery)
      ? [{ title: 'Om prosjektet', subtitle: 'Informasjonsside', icon: 'i', destination: './about.html' }]
      : [];
    const allResults = [...profileResults, ...healthFacilityResults, ...hospitalResults, ...statisticResults, ...aboutResults]
      .slice(0, searchLimits.globalSuggestionLimit);

    resultsElement.innerHTML = allResults.length
      ? allResults.map((result, index) => `
          <button class="suggestion-item" type="button" data-index="${index}">
            <span class="suggestion-icon">${result.icon}</span>
            <span class="suggestion-copy">
              <span class="suggestion-title">${escapeHtml(result.title)}</span>
              <span class="suggestion-sub">${escapeHtml(result.subtitle)}</span>
            </span>
          </button>`).join('')
      : '<div class="suggestion-item"><span class="suggestion-copy"><span class="suggestion-title">Ingen treff</span><span class="suggestion-sub">Prøv et sykehus, helseforetak eller en statistikk.</span></span></div>';

    resultsElement.hidden = false;
    resultsElement.querySelectorAll('button[data-index]').forEach(button => {
      button.addEventListener('click', () => navigateToResult(allResults[Number(button.dataset.index)]));
    });
    return allResults;
  }

  function renderHeader() {
    const headerElement = document.getElementById('site-header');
    if (!headerElement) return;

    headerElement.className = 'site-header';
    headerElement.innerHTML = `
      <div class="nav-inner">
        <a class="brand" href="./" aria-label="Blodberedskap Norge – hjem">
          <img class="brand-logo" src="./assets/logo.png" alt="Logo" onerror="this.hidden=true">
          <span class="brand-name">BLODBEREDSKAP<span class="brand-sub">NORGE · TRAUMESYKEHUS</span></span>
        </a>
        <nav class="nav-links" aria-label="Hovedmeny">
          <a class="nav-link ${pageName === 'home' ? 'active' : ''}" href="./">Hjem</a>
          <div class="nav-dropdown">
            <button class="nav-button" id="stats-menu-button" type="button" aria-expanded="false">Statistikker <span aria-hidden="true">⌄</span></button>
            <div class="nav-menu" id="stats-menu" hidden>${statisticsNavigationItems.map(statistic => `<a href="${pageName === 'about' ? `./#${statistic.id}` : `#${statistic.id}`}" data-statistic-id="${statistic.id}">${statistic.title}</a>`).join('')}</div>
          </div>
          <a class="nav-link ${pageName === 'about' ? 'active' : ''}" href="./about.html">Om prosjektet</a>
        </nav>
        <div class="nav-search-wrap">
          <span class="nav-search-icon" aria-hidden="true">⌕</span>
          <label class="sr-only" for="global-search">Søk på hele nettstedet</label>
          <input class="nav-search" type="search" id="global-search" placeholder="Søk etter sykehus, helseforetak eller region …" autocomplete="off">
          <kbd>/</kbd><div class="suggestions" id="global-search-results" hidden></div>
        </div>
      </div>`;

    const menuButton = document.getElementById('stats-menu-button');
    const menuElement = document.getElementById('stats-menu');
    menuButton.addEventListener('click', () => {
      const shouldOpen = menuElement.hidden;
      menuElement.hidden = !shouldOpen;
      menuButton.setAttribute('aria-expanded', String(shouldOpen));
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.nav-dropdown')) {
        menuElement.hidden = true;
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });

    const searchInput = document.getElementById('global-search');
    const searchResults = document.getElementById('global-search-results');
    let currentResults = [];
    const navigateToResult = result => { if (result) window.location.href = result.destination; };

    searchInput.addEventListener('input', () => {
      currentResults = renderGlobalSearchResults(searchInput.value, searchResults, navigateToResult);
    });
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        navigateToResult(currentResults[0]);
      }
      if (event.key === 'Escape') searchResults.hidden = true;
      if (event.key === 'ArrowDown') searchResults.querySelector('button')?.focus();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.nav-search-wrap')) searchResults.hidden = true;
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        searchInput.focus();
      }
    });
  }

  renderHeader();

  if (pageName === 'about') {
    fetch(window.APP_CONFIG.data.statisticsDatasetUrl, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Statistikkfilen kunne ikke hentes (${response.status}).`);
        return response.json();
      })
      .then(sourceStatistics => {
        const profileConfiguration = window.APP_CONFIG.hospitalProfiles;
        const hospitals = Object.entries(sourceStatistics.sykehus || {}).map(([id, hospital]) => ({
          id, name: hospital.Navn, region: hospital.Helseregion,
          healthFacilityName: hospital.Helseforetak
        }));
        const healthFacilities = Object.entries(sourceStatistics.helseforetak || {}).map(([id, item]) => ({
          id, name: item.Navn, region: item.Helseregion, type: item.Type,
          searchTerms: item.Soketermer || ''
        }));
        window.APP_DATA = {
          hospitals,
          healthFacilities,
          searchProfiles: [
            { id: profileConfiguration.nationalProfileId, name: profileConfiguration.nationalProfileName, region: 'Norge', subtitle: profileConfiguration.nationalProfileSubtitle, searchTerms: profileConfiguration.nationalSearchTerms },
            { id: profileConfiguration.averageProfileId, name: profileConfiguration.averageProfileName, region: 'Norge', subtitle: profileConfiguration.averageProfileSubtitle, searchTerms: profileConfiguration.averageSearchTerms }
          ],
          national: sourceStatistics[window.APP_CONFIG.data.nationalRecordName]
        };
      })
      .catch(error => console.warn('Søkeforslag kunne ikke lastes.', error));
  }

  window.escapeHtml = escapeHtml;
  window.STAT_ITEMS = statisticsNavigationItems;
})();
