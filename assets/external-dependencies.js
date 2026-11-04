(() => {
  'use strict';

  const dependencies = window.APP_CONFIG.externalDependencies;
  const pageName = document.body.dataset.page;

  function loadScript(scriptUrl) {
    return new Promise((resolve, reject) => {
      const scriptElement = document.createElement('script');
      scriptElement.src = scriptUrl;
      scriptElement.async = false;
      scriptElement.onload = resolve;
      scriptElement.onerror = () => reject(new Error(`Kunne ikke laste ekstern ressurs: ${scriptUrl}`));
      document.head.appendChild(scriptElement);
    });
  }

  function loadStylesheet(stylesheetUrl) {
    return new Promise((resolve, reject) => {
      const stylesheetElement = document.createElement('link');
      stylesheetElement.rel = 'stylesheet';
      stylesheetElement.href = stylesheetUrl;
      stylesheetElement.onload = resolve;
      stylesheetElement.onerror = () => reject(new Error(`Kunne ikke laste stilarket: ${stylesheetUrl}`));
      document.head.appendChild(stylesheetElement);
    });
  }

  const requiredScripts = [dependencies.statisticsChartLibrary.url];
  const requiredStylesheets = [];

  if (pageName === 'home') {
    requiredScripts.push(dependencies.interactiveMapLibrary.url);
    requiredStylesheets.push(dependencies.interactiveMapStylesheet.url);
  }

  async function loadRequiredScriptsInOrder() {
    for (const scriptUrl of requiredScripts) {
      try {
        await loadScript(scriptUrl);
      } catch (error) {
        console.error(error);
      }
    }
  }

  window.EXTERNAL_DEPENDENCIES_READY = Promise.all([
    loadRequiredScriptsInOrder(),
    ...requiredStylesheets.map(loadStylesheet)
  ]).catch(error => {
    console.error(error);
  });
})();
