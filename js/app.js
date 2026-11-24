/**
 * ============================================================================
 * ULTRA RAT REPELLER — APPLICATION ORCHESTRATOR
 * Propojení Web Audio Engine, Anti-Habituation procedurálního enginu a UI.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializace Audio Enginu a Procedurálního Algoritmu
  const audioEngine = new UltrasonicAudioEngine();
  const antiHabEngine = new AntiHabituationEngine(audioEngine);

  const canvasElem = document.getElementById('vizCanvas');
  const visualizer = new UltrasonicVisualizer(canvasElem, audioEngine, antiHabEngine);

  // 2. DOM Reference
  const masterBtn = document.getElementById('masterTriggerBtn');
  const masterBtnText = document.getElementById('masterBtnText');
  const masterBtnSub = document.getElementById('masterBtnSub');
  const stopEmergencyBtn = document.getElementById('stopEmergencyBtn');
  const quickMuteBtn = document.getElementById('quickMuteBtn');
  const muteIcon = document.getElementById('muteIcon');

  const freqValueElem = document.getElementById('freqValue');
  const freqBarFill = document.getElementById('freqBarFill');
  const cycleStatusBadge = document.getElementById('cycleStatusBadge');
  const hudActiveMode = document.getElementById('hudActiveMode');
  const hudRuntime = document.getElementById('hudRuntime');
  const hudOutputLevel = document.getElementById('hudOutputLevel');
  const hudEntropy = document.getElementById('hudEntropy');

  // Engine status indicators
  const engineActiveDot = document.getElementById('engineActiveDot');
  const engineStatusText = document.getElementById('engineStatusText');
  const engineRangeText = document.getElementById('engineRangeText');

  const vizPulse = document.getElementById('vizPulse');
  const canvasPhaseIndicator = document.getElementById('canvasPhaseIndicator');
  const canvasTargetFreq = document.getElementById('canvasTargetFreq');

  const modeCards = document.querySelectorAll('.mode-card');
  const vizPillBtns = document.querySelectorAll('.viz-pill-btn');

  const intensitySlider = document.getElementById('intensitySlider');
  const intensityValue = document.getElementById('intensityValue');
  const burstDurationSlider = document.getElementById('burstDurationSlider');
  const burstDurationValue = document.getElementById('burstDurationValue');
  const pauseDurationSlider = document.getElementById('pauseDurationSlider');
  const pauseDurationValue = document.getElementById('pauseDurationValue');

  const rangePresetBtns = document.querySelectorAll('.range-preset-btn');
  const freqRangeValue = document.getElementById('freqRangeValue');
  const timerChips = document.querySelectorAll('.chip-btn');
  const timerValue = document.getElementById('timerValue');

  // Manuální testování audio enginu
  const manualFreqSlider = document.getElementById('manualFreqSlider');
  const manualFreqValue = document.getElementById('manualFreqValue');
  const manualToneBtns = document.querySelectorAll('.manual-tone-btn');
  const manualTestSweepBtn = document.getElementById('manualTestSweepBtn');

  // Hardwarová diagnostika a modální okno
  const hwInfoBtn = document.getElementById('hwInfoBtn');
  const hwModalBackdrop = document.getElementById('hwModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalOkBtn = document.getElementById('modalOkBtn');

  const diagSampleRate = document.getElementById('diagSampleRate');
  const diagNyquist = document.getElementById('diagNyquist');
  const diagAudioState = document.getElementById('diagAudioState');
  const hwSampleRateNotice = document.getElementById('hwSampleRateNotice');
  const hwStatusDot = document.getElementById('hwStatusDot');

  // 3. Stav aplikace
  let sessionStartTime = null;
  let runtimeInterval = null;
  let autoShutdownSeconds = 0; // 0 = nepřetržitě
  let autoShutdownTimeout = null;

  // Názvy režimů
  const MODE_NAMES = {
    'sweep': 'MODE 1 (RANDOM SWEEP)',
    'burst': 'MODE 2 (RAPID BURST)',
    'chaos': 'MODE 3 (CHAOS PATTERN)',
    'auto': 'MODE 4 (AUTO ANTI-HAB)'
  };

  // Formátování frekvence s mezerami / čárkami
  function formatFreq(hz) {
    return Math.round(hz).toLocaleString('cs-CZ');
  }

  // Formátování času do HH:MM:SS
  function formatTime(totalSec) {
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }

  // Aktualizace indikátorů stavu Audio Enginu v UI
  function updateAudioEngineIndicators() {
    const t = audioEngine.getTelemetry();

    // Vzorkovací frekvence a akustický limit
    if (diagSampleRate) diagSampleRate.textContent = `${t.sampleRate.toLocaleString('cs-CZ')} Hz`;
    if (diagNyquist) diagNyquist.textContent = `${t.nyquistFreq.toLocaleString('cs-CZ')} Hz`;
    if (diagAudioState) diagAudioState.textContent = t.audioState.toUpperCase();

    // Stav audio enginu v banneru
    if (engineStatusText && engineActiveDot) {
      if (t.lastError) {
        engineStatusText.textContent = `CHYBA (${t.lastError})`;
        engineStatusText.style.color = 'var(--danger)';
        engineActiveDot.className = 'hud-dot';
      } else if (t.isPlaying && !t.isMuted) {
        engineStatusText.textContent = `AKTIVNÍ (${formatFreq(t.currentFrequency)} Hz)`;
        engineStatusText.style.color = 'var(--cyan)';
        engineActiveDot.className = 'hud-dot active';
      } else if (t.isPlaying && t.isMuted) {
        engineStatusText.textContent = 'ZTLUMENO (MUTED)';
        engineStatusText.style.color = 'var(--warning)';
        engineActiveDot.className = 'hud-dot';
      } else if (t.engineStatus === 'READY') {
        engineStatusText.textContent = 'PŘIPRAVEN (READY)';
        engineStatusText.style.color = 'var(--text-muted)';
        engineActiveDot.className = 'hud-dot';
      } else {
        engineStatusText.textContent = 'ZASTAVENO (STANDBY)';
        engineStatusText.style.color = 'var(--text-dim)';
        engineActiveDot.className = 'hud-dot';
      }
    }

    // Hardware status dot a doporučení
    if (t.nyquistFreq < 24000) {
      if (hwSampleRateNotice) {
        hwSampleRateNotice.textContent = `Aktivní limit kodeku: ${t.nyquistFreq} Hz (Doporučen režim 20-24 kHz)`;
        hwSampleRateNotice.style.color = '#f59e0b';
      }
      if (hwStatusDot) hwStatusDot.className = 'badge-dot';
    } else {
      if (hwSampleRateNotice) {
        hwSampleRateNotice.textContent = `Hardware schopen plného pásma 22–${Math.min(25, Math.floor(t.nyquistFreq/1000))} kHz`;
        hwSampleRateNotice.style.color = '#10b981';
      }
      if (hwStatusDot) hwStatusDot.className = 'badge-dot good';
    }
  }

  // 4. Hlavní řízení START / STOP
  async function toggleMasterTrigger() {
    if (!audioEngine.isPlaying) {
      // START GENERATOR
      try {
        await audioEngine.start();
        antiHabEngine.start();

        quickMuteBtn.classList.remove('danger-active');
        muteIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />`;

        masterBtn.className = 'master-btn running';
        masterBtnText.textContent = 'STOP GENERATOR';
        masterBtnSub.textContent = 'ULTRAZVUKOVÁ EMISE AKTIVNÍ';
        stopEmergencyBtn.removeAttribute('disabled');

        vizPulse.classList.add('active');
        sessionStartTime = Date.now();
        runtimeInterval = setInterval(updateRuntimeCounter, 1000);

        // Časovač automatického vypnutí
        if (autoShutdownSeconds > 0) {
          clearTimeout(autoShutdownTimeout);
          autoShutdownTimeout = setTimeout(() => {
            stopAll();
            alert('Časovač automatického vypnutí ukončil generování.');
          }, autoShutdownSeconds * 1000);
        }
      } catch (err) {
        alert('Nepodařilo se spustit audio zařízení: ' + (err.message || err));
      }
    } else {
      // STOP GENERATOR
      stopAll();
    }
    updateAudioEngineIndicators();
  }

  // Úplné bezpečné zastavení
  function stopAll() {
    antiHabEngine.stop();
    audioEngine.stop();

    masterBtn.className = 'master-btn stopped';
    masterBtnText.textContent = 'START GENERATOR';
    masterBtnSub.textContent = '22.0 – 25.0 kHz ULTRA ENGINE';
    stopEmergencyBtn.setAttribute('disabled', 'true');

    vizPulse.classList.remove('active');
    cycleStatusBadge.textContent = 'STANDBY';
    cycleStatusBadge.className = 'hud-tag';
    canvasPhaseIndicator.textContent = 'STANDBY';
    hudEntropy.textContent = 'SEEKING';

    clearInterval(runtimeInterval);
    clearTimeout(autoShutdownTimeout);
    updateAudioEngineIndicators();
  }

  function updateRuntimeCounter() {
    if (!sessionStartTime || !audioEngine.isPlaying) return;
    const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    hudRuntime.textContent = formatTime(elapsedSec);
  }

  // 5. Propojení Anti-Habituation událostí
  antiHabEngine.onTick = (data) => {
    const freq = data.freq;
    freqValueElem.textContent = formatFreq(freq);

    // Aktualizace indikátoru frekvenčního sloupce
    const norm = Math.max(0, Math.min(1, (freq - antiHabEngine.minFreq) / (antiHabEngine.maxFreq - antiHabEngine.minFreq)));
    freqBarFill.style.width = `${(norm * 100).toFixed(1)}%`;

    canvasTargetFreq.textContent = `${(freq / 1000).toFixed(2)} kHz`;
    if (data.entropy) {
      hudEntropy.textContent = data.entropy;
    }
    updateAudioEngineIndicators();
  };

  antiHabEngine.onPhaseChange = (phase, label) => {
    if (phase === 'EMITTING') {
      cycleStatusBadge.textContent = label || 'AKTIVNÍ EMISE';
      cycleStatusBadge.className = 'hud-tag active';
      canvasPhaseIndicator.textContent = label;
      vizPulse.classList.add('active');
    } else if (phase === 'PAUSED') {
      cycleStatusBadge.textContent = 'KLIDOVÁ PAUZA';
      cycleStatusBadge.className = 'hud-tag pause';
      canvasPhaseIndicator.textContent = 'PAUZA';
      vizPulse.classList.remove('active');
      hudEntropy.textContent = 'REST INTERVAL';
    } else {
      cycleStatusBadge.textContent = 'STANDBY';
      cycleStatusBadge.className = 'hud-tag';
      canvasPhaseIndicator.textContent = 'READY';
      vizPulse.classList.remove('active');
    }
    updateAudioEngineIndicators();
  };

  // 6. Přepínání 4 provozních režimů
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const selectedMode = card.getAttribute('data-mode');
      antiHabEngine.setMode(selectedMode);
      hudActiveMode.textContent = MODE_NAMES[selectedMode] || selectedMode.toUpperCase();
    });
  });

  // 7. Přepínání režimů vizualizéru
  vizPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      vizPillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const vizMode = btn.getAttribute('data-viz');
      visualizer.setVisualMode(vizMode);
    });
  });

  // 8. Posuvníky parametrů (Amplituda, délky cyklů)
  intensitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    intensityValue.textContent = `${val} %`;
    hudOutputLevel.textContent = `${val} %`;
    audioEngine.setIntensity(val / 100.0);
  });

  burstDurationSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    burstDurationValue.textContent = `${val.toFixed(1)} s`;
    antiHabEngine.setDurations(val, parseFloat(pauseDurationSlider.value));
  });

  pauseDurationSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    pauseDurationValue.textContent = `${val.toFixed(1)} s`;
    antiHabEngine.setDurations(parseFloat(burstDurationSlider.value), val);
  });

  // Předvolby frekvenčního rozsahu
  rangePresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rangePresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const minF = parseInt(btn.getAttribute('data-min'), 10);
      const maxF = parseInt(btn.getAttribute('data-max'), 10);
      antiHabEngine.setFrequencyRange(minF, maxF);
      freqRangeValue.textContent = `${(minF / 1000).toFixed(1)} – ${(maxF / 1000).toFixed(1)} kHz`;
      if (engineRangeText) {
        engineRangeText.textContent = `${(minF / 1000).toFixed(0)} 000 – ${(maxF / 1000).toFixed(0)} 000 Hz`;
      }
    });
  });

  // Čipy automatického vypnutí
  timerChips.forEach(chip => {
    chip.addEventListener('click', () => {
      timerChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const sec = parseInt(chip.getAttribute('data-time'), 10);
      autoShutdownSeconds = sec;
      timerValue.textContent = chip.textContent;

      if (audioEngine.isPlaying && autoShutdownSeconds > 0) {
        clearTimeout(autoShutdownTimeout);
        autoShutdownTimeout = setTimeout(() => {
          stopAll();
          alert('Časovač automatického vypnutí ukončil generování.');
        }, autoShutdownSeconds * 1000);
      }
    });
  });

  // 9. Manuální testování audio enginu (Plynulé ladění frekvence 22–25 kHz)
  if (manualFreqSlider && manualFreqValue) {
    manualFreqSlider.addEventListener('input', (e) => {
      const freq = parseInt(e.target.value, 10);
      manualFreqValue.textContent = `${formatFreq(freq)} Hz`;

      // Plynulá změna na živém oscilátoru
      audioEngine.setFrequency(freq, 0.03);
      freqValueElem.textContent = formatFreq(freq);

      const norm = Math.max(0, Math.min(1, (freq - antiHabEngine.minFreq) / (antiHabEngine.maxFreq - antiHabEngine.minFreq)));
      freqBarFill.style.width = `${(norm * 100).toFixed(1)}%`;
      canvasTargetFreq.textContent = `${(freq / 1000).toFixed(2)} kHz`;
      updateAudioEngineIndicators();
    });
  }

  // Tlačítka pro manuální přednastavené tóny
  manualToneBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const f = parseInt(btn.getAttribute('data-freq'), 10);
      if (manualFreqSlider) manualFreqSlider.value = f;
      if (manualFreqValue) manualFreqValue.textContent = `${formatFreq(f)} Hz`;

      if (!audioEngine.isPlaying) {
        await audioEngine.start();
        masterBtn.className = 'master-btn running';
        masterBtnText.textContent = 'STOP GENERATOR';
        stopEmergencyBtn.removeAttribute('disabled');
      }

      audioEngine.setFrequency(f, 0.04);
      audioEngine.setEmissionActive(true, 0.01);
      freqValueElem.textContent = formatFreq(f);

      const norm = Math.max(0, Math.min(1, (f - antiHabEngine.minFreq) / (antiHabEngine.maxFreq - antiHabEngine.minFreq)));
      freqBarFill.style.width = `${(norm * 100).toFixed(1)}%`;
      canvasTargetFreq.textContent = `${(f / 1000).toFixed(2)} kHz`;
      updateAudioEngineIndicators();
    });
  });

  // Tlačítko pro spuštění plynulého testovacího sweepu
  if (manualTestSweepBtn) {
    manualTestSweepBtn.addEventListener('click', async () => {
      if (!audioEngine.isPlaying) {
        await audioEngine.start();
        masterBtn.className = 'master-btn running';
        masterBtnText.textContent = 'STOP GENERATOR';
        stopEmergencyBtn.removeAttribute('disabled');
      }

      cycleStatusBadge.textContent = 'TEST SWEEP';
      cycleStatusBadge.className = 'hud-tag active';
      hudEntropy.textContent = 'TEST 22 -> 25 kHz';

      // 1. Sweep nahoru 22k -> 25k (1.2 s)
      await audioEngine.playSweep(22000, 25000, 1.2);
      // 2. Krátká prodleva
      await new Promise(r => setTimeout(r, 100));
      // 3. Sweep dolů 25k -> 22k (1.2 s)
      await audioEngine.playSweep(25000, 22000, 1.2);

      updateAudioEngineIndicators();
    });
  }

  // 10. Rychlé ztlumení (Mute) & Nouzové zastavení (Emergency Stop)
  quickMuteBtn.addEventListener('click', () => {
    const muted = audioEngine.toggleMute();
    if (muted) {
      quickMuteBtn.classList.add('danger-active');
      muteIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />`;
      cycleStatusBadge.textContent = 'MUTED';
      cycleStatusBadge.className = 'hud-tag';
    } else {
      quickMuteBtn.classList.remove('danger-active');
      muteIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />`;
      if (audioEngine.isPlaying) {
        cycleStatusBadge.textContent = 'AKTIVNÍ EMISE';
        cycleStatusBadge.className = 'hud-tag active';
      }
    }
    updateAudioEngineIndicators();
  });

  // Nouzové okamžité zastavení
  stopEmergencyBtn.addEventListener('click', () => {
    audioEngine.emergencyKill();
    stopAll();
  });

  // Tlačítko START / STOP
  masterBtn.addEventListener('click', () => {
    toggleMasterTrigger();
  });

  // 11. Modální okno s diagnostikou hardware
  hwInfoBtn.addEventListener('click', () => {
    updateAudioEngineIndicators();
    hwModalBackdrop.classList.add('open');
  });

  modalCloseBtn.addEventListener('click', () => {
    hwModalBackdrop.classList.remove('open');
  });

  modalOkBtn.addEventListener('click', () => {
    hwModalBackdrop.classList.remove('open');
  });

  hwModalBackdrop.addEventListener('click', (e) => {
    if (e.target === hwModalBackdrop) {
      hwModalBackdrop.classList.remove('open');
    }
  });

  // Událost změny stavu v Audio Enginu
  audioEngine.onStateChange(() => {
    updateAudioEngineIndicators();
  });

  audioEngine.onError((err) => {
    console.error('Audio engine reportuje chybu:', err);
    updateAudioEngineIndicators();
  });

  // Úvodní inicializace stavu
  updateAudioEngineIndicators();
});
