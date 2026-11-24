/**
 * ============================================================================
 * ULTRA RAT REPELLER — ANTI-HABITUATION ENGINE
 * Algorithmic Anti-Habituation Intelligence:
 *  - Procedural, non-repeating sequence generation
 *  - Markov/Stochastic state machine
 *  - 4 Operating Modes:
 *      1) RANDOM SWEEP (continuous sweeps, variable rate & directions)
 *      2) RAPID BURST (staccato pulses, unpredictable rhythms)
 *      3) CHAOS PATTERN (hybrid chirps, leaps, glitches, and micro-pauses)
 *      4) AUTO ANTI-HABITUATION (autonomous meta-controller managing all patterns)
 * ============================================================================
 */

class AntiHabituationEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;

    // Configurable parameters
    this.minFreq = 22000;
    this.maxFreq = 25000;
    this.activeDuration = 3.5; // seconds
    this.pauseDuration = 1.8;  // seconds
    this.mode = 'auto'; // 'sweep', 'burst', 'chaos', 'auto'

    // Runtime state
    this.isRunning = false;
    this.currentPhase = 'STANDBY'; // 'EMITTING', 'PAUSED'
    this.timerId = null;
    this.stepTimerId = null;
    this.phaseStartTime = 0;
    this.phaseDuration = 0;
    this.cycleCount = 0;
    this.entropyLevel = 'NORMAL';

    // Auto meta-orchestrator state
    this.autoSubMode = 'sweep';
    this.autoModeTimer = null;
    this.subModesList = ['sweep', 'burst', 'chaos'];

    // Callbacks for UI updates
    this.onTick = null;
    this.onPhaseChange = null;
  }

  setFrequencyRange(min, max) {
    this.minFreq = Math.max(18000, min);
    this.maxFreq = Math.min(30000, max);
  }

  setMode(mode) {
    this.mode = mode;
    if (this.isRunning) {
      this._resetCycle();
    }
  }

  setDurations(activeSec, pauseSec) {
    this.activeDuration = Math.max(0.5, activeSec);
    this.pauseDuration = Math.max(0.1, pauseSec);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.cycleCount = 0;
    this._startEmissionPhase();
  }

  stop() {
    this.isRunning = false;
    this.currentPhase = 'STANDBY';
    clearTimeout(this.timerId);
    clearTimeout(this.stepTimerId);
    clearTimeout(this.autoModeTimer);
    this.audio.setEmissionActive(false, 0.02);
    if (this.onPhaseChange) this.onPhaseChange(this.currentPhase, 'Engine Zastaven');
  }

  _getRandomFreq() {
    return Math.floor(this.minFreq + Math.random() * (this.maxFreq - this.minFreq));
  }

  _startEmissionPhase() {
    if (!this.isRunning) return;

    this.cycleCount++;
    this.currentPhase = 'EMITTING';

    // Procedural variation on active duration (± 25% jitter to prevent habituation)
    const jitterFactor = 0.75 + Math.random() * 0.5;
    this.phaseDuration = this.activeDuration * jitterFactor;
    this.phaseStartTime = performance.now();

    // Turn audio emission ON
    this.audio.setEmissionActive(true, 0.01);

    // Pick active generator mode
    let effectiveMode = this.mode;
    if (this.mode === 'auto') {
      // Pick or switch meta mode procedurally
      const roll = Math.random();
      if (roll < 0.35) this.autoSubMode = 'sweep';
      else if (roll < 0.70) this.autoSubMode = 'burst';
      else this.autoSubMode = 'chaos';
      effectiveMode = this.autoSubMode;
    }

    if (this.onPhaseChange) {
      this.onPhaseChange(this.currentPhase, `AKTIVNÍ (${effectiveMode.toUpperCase()})`);
    }

    // Launch mode sequence generator
    this._runModeSequence(effectiveMode);

    // Schedule transition to pause
    this.timerId = setTimeout(() => {
      this._startPausePhase();
    }, this.phaseDuration * 1000);
  }

  _startPausePhase() {
    if (!this.isRunning) return;

    this.currentPhase = 'PAUSED';
    clearTimeout(this.stepTimerId);

    // Controlled silence
    this.audio.setEmissionActive(false, 0.015);

    // Procedural pause duration (± 30% jitter to keep pests vigilant)
    const jitterFactor = 0.7 + Math.random() * 0.6;
    this.phaseDuration = this.pauseDuration * jitterFactor;
    this.phaseStartTime = performance.now();

    if (this.onPhaseChange) {
      this.onPhaseChange(this.currentPhase, 'KLIDOVÁ PAUZA');
    }

    // Schedule next active cycle
    this.timerId = setTimeout(() => {
      this._startEmissionPhase();
    }, this.phaseDuration * 1000);
  }

  _runModeSequence(mode) {
    clearTimeout(this.stepTimerId);
    if (!this.isRunning || this.currentPhase !== 'EMITTING') return;

    switch (mode) {
      case 'sweep':
        this._executeRandomSweepStep();
        break;
      case 'burst':
        this._executeRapidBurstStep();
        break;
      case 'chaos':
        this._executeChaosStep();
        break;
      default:
        this._executeRandomSweepStep();
        break;
    }
  }

  /**
   * MODE 1: RANDOM SWEEP
   * Continual directional frequency sweeps, changing rates and boundaries
   */
  _executeRandomSweepStep() {
    if (!this.isRunning || this.currentPhase !== 'EMITTING') return;

    const startFreq = this.audio.currentFrequency || this._getRandomFreq();
    // Pick end frequency with minimum span to ensure a real sweep
    let endFreq = this._getRandomFreq();
    while (Math.abs(endFreq - startFreq) < 800) {
      endFreq = this._getRandomFreq();
    }

    // Variable sweep duration: 120ms to 900ms
    const sweepDuration = 0.12 + Math.random() * 0.75;

    this.audio.scheduleSweep(startFreq, endFreq, sweepDuration);
    this.entropyLevel = 'DYNAMIC SWEEP';

    if (this.onTick) {
      this.onTick({
        freq: endFreq,
        stepType: 'SWEEP',
        stepDuration: sweepDuration,
        entropy: `SWEEP ${(Math.abs(endFreq - startFreq) / sweepDuration).toFixed(0)} Hz/s`
      });
    }

    this.stepTimerId = setTimeout(() => {
      this._executeRandomSweepStep();
    }, sweepDuration * 1000);
  }

  /**
   * MODE 2: RAPID BURST
   * High-speed staccato pulses, irregular gaps, unpredictable rhythms
   */
  _executeRapidBurstStep() {
    if (!this.isRunning || this.currentPhase !== 'EMITTING') return;

    // Pick a burst frequency
    const burstFreq = this._getRandomFreq();
    this.audio.setFrequency(burstFreq, 0.005);

    // Pulse duration: 35ms to 160ms (ultra-short disorienting pulses)
    const pulseLen = 0.035 + Math.random() * 0.125;
    // Inter-pulse gap: 25ms to 180ms
    const gapLen = 0.025 + Math.random() * 0.155;

    // Pulse ON
    this.audio.setEmissionActive(true, 0.005);
    this.entropyLevel = 'BURST TRAIN';

    if (this.onTick) {
      this.onTick({
        freq: burstFreq,
        stepType: 'BURST_PULSE',
        stepDuration: pulseLen,
        entropy: `PULSE ${(pulseLen * 1000).toFixed(0)}ms`
      });
    }

    // Pulse OFF after pulseLen
    this.stepTimerId = setTimeout(() => {
      if (!this.isRunning || this.currentPhase !== 'EMITTING') return;
      this.audio.setEmissionActive(false, 0.005);

      // Next pulse after gapLen
      this.stepTimerId = setTimeout(() => {
        this._executeRapidBurstStep();
      }, gapLen * 1000);
    }, pulseLen * 1000);
  }

  /**
   * MODE 3: CHAOS PATTERN
   * Hybrid procedural engine: sweeps, hops, FM warbles, micro-glitches
   */
  _executeChaosStep() {
    if (!this.isRunning || this.currentPhase !== 'EMITTING') return;

    const actionRoll = Math.random();
    let stepDuration = 0.2;
    let stepDescription = '';

    if (actionRoll < 0.35) {
      // 1. Rapid Chirp Sweep
      const startF = this.audio.currentFrequency;
      const endF = this._getRandomFreq();
      stepDuration = 0.08 + Math.random() * 0.25;
      this.audio.scheduleSweep(startF, endF, stepDuration);
      stepDescription = 'CHAOS CHIRP';
    } else if (actionRoll < 0.65) {
      // 2. Discrete Frequency Hop
      const jumpF = this._getRandomFreq();
      this.audio.setFrequency(jumpF, 0.002);
      stepDuration = 0.06 + Math.random() * 0.22;
      stepDescription = 'FREQ JUMP';
    } else if (actionRoll < 0.85) {
      // 3. Multi-hop Glitch (rapid stepped arpeggio)
      const baseF = this._getRandomFreq();
      this.audio.setFrequency(baseF, 0.004);
      stepDuration = 0.05 + Math.random() * 0.1;
      stepDescription = 'MICRO-GLITCH';
    } else {
      // 4. Staccato Micro-mute (50ms sharp silence to trick acoustic reflex)
      this.audio.setEmissionActive(false, 0.005);
      stepDuration = 0.04 + Math.random() * 0.08;
      stepDescription = 'REFLEX DIP';
      setTimeout(() => {
        if (this.isRunning && this.currentPhase === 'EMITTING') {
          this.audio.setEmissionActive(true, 0.005);
        }
      }, stepDuration * 1000);
    }

    this.entropyLevel = 'CHAOS SEED #' + Math.floor(Math.random() * 9999);

    if (this.onTick) {
      this.onTick({
        freq: this.audio.currentFrequency,
        stepType: 'CHAOS',
        stepDuration: stepDuration,
        entropy: stepDescription
      });
    }

    this.stepTimerId = setTimeout(() => {
      this._executeChaosStep();
    }, stepDuration * 1000);
  }

  _resetCycle() {
    clearTimeout(this.timerId);
    clearTimeout(this.stepTimerId);
    if (this.isRunning) {
      this._startEmissionPhase();
    }
  }

  getEntropyMetric() {
    return this.entropyLevel;
  }
}

window.AntiHabituationEngine = AntiHabituationEngine;
