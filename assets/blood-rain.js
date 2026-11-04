(() => {
  'use strict';

  const rainConfiguration = window.APP_CONFIG.bloodRain;
  const rainButton = document.getElementById('blood-rain-toggle');
  const reducedMotionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const rainLayer = document.createElement('div');
  rainLayer.className = 'blood-rain-layer';
  rainLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(rainLayer);

  let nextDropTimer = null;
  const activeDrops = new Set();
  let rainEnabled = rainConfiguration.enabledByDefault;

  function getRandomInteger(minimumValue, maximumValue) {
    return Math.floor(Math.random() * (maximumValue - minimumValue + 1)) + minimumValue;
  }

  function updateRainButton() {
    if (!rainButton) return;
    rainButton.setAttribute('aria-pressed', String(rainEnabled));
    rainButton.classList.toggle('is-enabled', rainEnabled);
    const stateLabel = rainButton.querySelector('[data-blood-rain-state]');
    if (stateLabel) stateLabel.textContent = rainEnabled ? 'På' : 'Av';
  }

  function removeActiveDrops() {
    for (const dropElement of activeDrops) dropElement.remove();
    activeDrops.clear();
  }

  function scheduleNextDrop() {
    if (!rainEnabled || reducedMotionPreference?.matches) return;
    const delay = getRandomInteger(
      rainConfiguration.minimumSpawnIntervalMilliseconds,
      rainConfiguration.maximumSpawnIntervalMilliseconds
    );

    nextDropTimer = window.setTimeout(() => {
      createFallingDrop();
      scheduleNextDrop();
    }, delay);
  }

  function createFallingDrop() {
    const dropElement = document.createElement('img');
    const dropSize = getRandomInteger(
      rainConfiguration.minimumDropSizePixels,
      rainConfiguration.maximumDropSizePixels
    );
    const dropRotation = getRandomInteger(rainConfiguration.minimumDropRotationDegrees, rainConfiguration.maximumDropRotationDegrees);

    dropElement.className = 'blood-rain-drop';
    dropElement.src = rainConfiguration.imageUrl;
    dropElement.alt = '';
    dropElement.draggable = false;
    dropElement.style.left = `${Math.random() * rainConfiguration.horizontalPositionPercent}%`;
    dropElement.style.width = `${dropSize}px`;
    dropElement.style.setProperty('--drop-rotation', `${dropRotation}deg`);
    dropElement.style.setProperty('--drop-fall-duration', `${rainConfiguration.fallDurationMilliseconds}ms`);
    activeDrops.add(dropElement);
    rainLayer.appendChild(dropElement);

    window.setTimeout(() => {
      activeDrops.delete(dropElement);
      dropElement.remove();
    }, rainConfiguration.fallDurationMilliseconds + window.APP_CONFIG.timing.bloodDropCleanupGraceMilliseconds);
  }

  function setRainEnabled(shouldEnable) {
    rainEnabled = Boolean(shouldEnable) && !reducedMotionPreference?.matches;
    try {
      window.localStorage.setItem(rainConfiguration.storageKey, String(rainEnabled));
    } catch (storageError) {
      console.warn('Kunne ikke lagre innstillingen for blodregn.', storageError);
    }
    updateRainButton();

    if (nextDropTimer !== null) {
      window.clearTimeout(nextDropTimer);
      nextDropTimer = null;
    }

    if (rainEnabled) {
      scheduleNextDrop();
    } else {
      removeActiveDrops();
    }
  }

  if (rainButton) {
    if (reducedMotionPreference?.matches) {
      rainButton.disabled = true;
      rainButton.title = 'Blodregn er slått av når redusert bevegelse er aktivert.';
    }
    rainButton.addEventListener('click', () => setRainEnabled(!rainEnabled));
  }

  let savedRainPreference = false;
  try {
    savedRainPreference = window.localStorage.getItem(rainConfiguration.storageKey) === 'true';
  } catch (storageError) {
    console.warn('Kunne ikke lese innstillingen for blodregn.', storageError);
  }

  setRainEnabled(savedRainPreference);
  reducedMotionPreference?.addEventListener?.('change', event => {
    if (event.matches) setRainEnabled(false);
  });
})();
