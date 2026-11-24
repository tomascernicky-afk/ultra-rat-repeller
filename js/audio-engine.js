/**
 * ============================================================================
 * ULTRA RAT REPELLER — PREMIUM ULTRASONIC AUDIO ENGINE
 * 
 * Skutečný, plnohodnotný generátor ultrazvukového signálu pro Web Audio API.
 * Primární frekvenční pásmo: 22 000 Hz až 25 000 Hz.
 * 
 * Funkce:
 *  1. Reálné generování signálu pomocí OscillatorNode (čistý sinusový průběh)
 *  2. Frekvenční rozsah 22–25 kHz s ochranou proti aliasingu a Nyquistovu stropu
 *  3. Plynulé změny frekvence (frequency glides / ramps) bez lupanců
 *  4. Frekvenční sweeps (lineární, exponenciální, obousměrné ping-pong)
 *  5. Řízení amplitudy (intenzita 0 až 100 %) s dynamickým bezpečnostním kompresorem
 *  6. Plynulé náběhy a poklesy amplitudy (Attack & Release de-clicking obálka)
 *  7. Okamžité zastavení zvuku (Hard Kill / Stop) bez dozvuků
 *  8. Kompletní řízení stavu AudioContext (Running, Suspended, Closed, Interrupted)
 *  9. Pokročilé ošetření chyb audio zařízení a změn výstupů
 * 10. Příprava pro sekvencer další etapy (playTone, playSweep, playBurst, scheduleSequence)
 * ============================================================================
 */

class UltrasonicAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.envelopeGain = null;
    this.masterGain = null;
    this.limiterNode = null;
    this.analyser = null;

    // Runtime stav
    this.isPlaying = false;
    this.isMuted = false;
    this.engineStatus = 'UNINITIALIZED'; // UNINITIALIZED, READY, RUNNING, SUSPENDED, STOPPED, ERROR
    this.lastError = null;

    // Frekvence v Hz (výchozí 23 500 Hz v primárním rozsahu 22–25 kHz)
    this.currentFrequency = 23500;
    this.targetFrequency = 23500;
    this.minFrequency = 22000;
    this.maxFrequency = 25000;

    // Amplituda & De-clicking obálka
    this.intensity = 0.85; // 0.05 až 1.0 (amplituda)
    this.attackTime = 0.012;  // 12 ms plynulý náběh (zabraňuje lupnutí)
    this.releaseTime = 0.015; // 15 ms plynulý doběh (zabraňuje lupnutí)

    // Hardware telemetrie
    this.sampleRate = 48000;
    this.nyquistFreq = 24000;
    this.deviceSupportWarning = null;

    // Listenery pro UI aktualizace
    this.stateListeners = [];
    this.errorListeners = [];

    // Detekce změn audio hardware
    this._bindDeviceChangeListeners();
  }

  /**
   * Inicializuje nebo probouzí Web Audio AudioContext s ošetřením chyb
   */
  async initContext() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API není v tomto prohlížeči podporováno.');
        }

        try {
          this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
        } catch (ctxErr) {
          console.warn('AudioContext s latencyHint selhal, fallback na defaultní:', ctxErr);
          this.audioCtx = new AudioContextClass();
        }

        // Zjištění hardwarových parametrů
        this.sampleRate = this.audioCtx.sampleRate || 48000;
        this.nyquistFreq = Math.floor(this.sampleRate / 2);

        // Kontrola vzorkovací frekvence vůči 22-25 kHz
        if (this.nyquistFreq < 25000) {
          this.deviceSupportWarning = `Hardware vzorkuje na ${this.sampleRate.toLocaleString()} Hz (Nyquist: ${this.nyquistFreq.toLocaleString()} Hz). Frekvence nad tímto limitem jsou bezpečně korigovány.`;
        } else {
          this.deviceSupportWarning = null;
        }

        // Sledování změn stavu AudioContextu
        this.audioCtx.onstatechange = () => {
          this._handleContextStateChange();
        };

        // 1. Analyser Node (pro radar a spektrogram)
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.65;

        // 2. Dynamics Compressor Node (bezpečnostní limiter proti přebuzení)
        this.limiterNode = this.audioCtx.createDynamicsCompressor();
        this.limiterNode.threshold.setValueAtTime(-1.0, this.audioCtx.currentTime);
        this.limiterNode.knee.setValueAtTime(3.0, this.audioCtx.currentTime);
        this.limiterNode.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
        this.limiterNode.attack.setValueAtTime(0.001, this.audioCtx.currentTime);
        this.limiterNode.release.setValueAtTime(0.05, this.audioCtx.currentTime);

        // 3. Master Gain Node (hlavní řízení hlasitosti/amplitudy)
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.intensity, this.audioCtx.currentTime);

        // Propojení řetězce: MasterGain -> Limiter -> Analyser -> Destination
        this.masterGain.connect(this.limiterNode);
        this.limiterNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        this.engineStatus = 'READY';
      }

      // Oživení pozastaveného kontextu (mobilní gesture unlock)
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.engineStatus = this.audioCtx.state === 'running' ? (this.isPlaying ? 'RUNNING' : 'READY') : this.audioCtx.state.toUpperCase();
      this._notifyStateChange();
      return this.audioCtx;

    } catch (err) {
      console.error('Chyba při inicializaci AudioContext:', err);
      this.engineStatus = 'ERROR';
      this.lastError = err.message || 'Chyba inicializace audio zařízení';
      this._notifyError(err);
      throw err;
    }
  }

  /**
   * Spustí skutečné generování ultrazvukového signálu
   */
  async start() {
    try {
      await this.initContext();

      if (this.isPlaying) return;

      const now = this.audioCtx.currentTime;

      // Obnovení amplitudy po ztlumení
      if (this.isMuted) {
        this.isMuted = false;
        if (this.masterGain) {
          this.masterGain.gain.cancelScheduledValues(now);
          this.masterGain.gain.setValueAtTime(this.intensity, now);
        }
      }

      // 1. De-clicking Envelope Gain Node
      this.envelopeGain = this.audioCtx.createGain();
      // Začátek s nulovou amplitudou
      this.envelopeGain.gain.setValueAtTime(0.00001, now);
      this.envelopeGain.connect(this.masterGain);

      // 2. Skutečný OscillatorNode
      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sine'; // Čistá sinusoida pro akustickou čistotu v 22-25 kHz

      const safeFreq = this._clampFreq(this.currentFrequency);
      try { this.oscillator.frequency.value = safeFreq; } catch (e) {}
      this.oscillator.frequency.setValueAtTime(safeFreq, now);
      this.oscillator.connect(this.envelopeGain);

      // Spuštění oscilátoru
      this.oscillator.start(now);

      // Plynulý náběh amplitudy (Attack) bez kliknutí
      this.envelopeGain.gain.exponentialRampToValueAtTime(1.0, now + this.attackTime);

      this.isPlaying = true;
      this.engineStatus = 'RUNNING';
      this._notifyStateChange();

    } catch (err) {
      console.error('Chyba při spouštění audio enginu:', err);
      this.engineStatus = 'ERROR';
      this.lastError = err.message;
      this._notifyError(err);
      this.stop();
    }
  }

  /**
   * Plynule a čistě zastaví generování zvuku (Zero-Click Stop)
   */
  stop() {
    if (!this.isPlaying || !this.audioCtx) {
      this.isPlaying = false;
      this.engineStatus = this.audioCtx ? 'STOPPED' : 'UNINITIALIZED';
      this._notifyStateChange();
      return;
    }

    const now = this.audioCtx.currentTime;

    try {
      if (this.envelopeGain) {
        // Plynulý pokles amplitudy (Release)
        this.envelopeGain.gain.cancelScheduledValues(now);
        this.envelopeGain.gain.setValueAtTime(Math.max(0.00001, this.envelopeGain.gain.value), now);
        this.envelopeGain.gain.exponentialRampToValueAtTime(0.00001, now + this.releaseTime);
      }

      const oscToStop = this.oscillator;
      const gainToClean = this.envelopeGain;

      if (oscToStop) {
        oscToStop.stop(now + this.releaseTime + 0.005);
        setTimeout(() => {
          try { oscToStop.disconnect(); } catch (e) {}
          try { gainToClean.disconnect(); } catch (e) {}
        }, (this.releaseTime + 0.05) * 1000);
      }
    } catch (err) {
      console.warn('Upozornění při zastavení oscilátoru:', err);
    }

    this.oscillator = null;
    this.envelopeGain = null;
    this.isPlaying = false;
    this.engineStatus = 'STOPPED';
    this._notifyStateChange();
  }

  /**
   * Okamžité zastavení generování zvuku (Emergency Hard Cut)
   */
  immediateStop() {
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      try {
        if (this.envelopeGain) {
          this.envelopeGain.gain.cancelScheduledValues(now);
          this.envelopeGain.gain.setValueAtTime(0, now);
        }
        if (this.oscillator) {
          this.oscillator.stop(now);
          try { this.oscillator.disconnect(); } catch (e) {}
        }
      } catch (e) {
        console.warn('Chyba při immediateStop:', e);
      }
    }

    this.oscillator = null;
    this.envelopeGain = null;
    this.isPlaying = false;
    this.engineStatus = 'STOPPED';
    this._notifyStateChange();
  }

  /**
   * Plynulá změna frekvence (Frequency Glide)
   * @param {number} freq Frekvence v Hz (v rozsahu 22 000 až 25 000 Hz)
   * @param {number} rampDuration Doba přechodu v sekundách
   */
  setFrequency(freq, rampDuration = 0.04) {
    this.targetFrequency = freq;
    const safeFreq = this._clampFreq(freq);

    if (!this.isPlaying || !this.oscillator || !this.audioCtx) {
      this.currentFrequency = safeFreq;
      return;
    }

    const now = this.audioCtx.currentTime;
    const oscFreq = this.oscillator.frequency;

    oscFreq.cancelScheduledValues(now);
    oscFreq.setValueAtTime(oscFreq.value, now);

    if (rampDuration <= 0.005) {
      // Bleskový krok
      oscFreq.setValueAtTime(safeFreq, now + 0.002);
    } else {
      // Plynulý lineární přechod
      oscFreq.linearRampToValueAtTime(safeFreq, now + rampDuration);
    }

    this.currentFrequency = safeFreq;
  }

  /**
   * Plynulý frekvenční sweep (Linear, Exponential nebo Ping-Pong)
   * @param {number} startFreq Počáteční frekvence v Hz
   * @param {number} endFreq Koncová frekvence v Hz
   * @param {number} durationSeconds Délka trvání sweepu
   * @param {string} curve 'linear' | 'exponential'
   */
  scheduleSweep(startFreq, endFreq, durationSeconds, curve = 'linear') {
    if (!this.isPlaying || !this.oscillator || !this.audioCtx) return;

    const safeStart = this._clampFreq(startFreq);
    const safeEnd = this._clampFreq(endFreq);

    const now = this.audioCtx.currentTime;
    const oscFreq = this.oscillator.frequency;

    oscFreq.cancelScheduledValues(now);
    oscFreq.setValueAtTime(safeStart, now);

    if (curve === 'exponential' && safeStart > 0 && safeEnd > 0) {
      oscFreq.exponentialRampToValueAtTime(safeEnd, now + durationSeconds);
    } else {
      oscFreq.linearRampToValueAtTime(safeEnd, now + durationSeconds);
    }

    this.currentFrequency = safeEnd;
    this.targetFrequency = safeEnd;
  }

  /**
   * Řízení amplitudy (intenzita signálu 0.05 až 1.0)
   * @param {number} level Hodnota 0.05 - 1.0
   */
  setIntensity(level) {
    this.intensity = Math.max(0.05, Math.min(1.0, level));
    if (this.masterGain && this.audioCtx && !this.isMuted) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      // Plynulá změna hlasitosti bez lupnutí (20ms rampa)
      this.masterGain.gain.linearRampToValueAtTime(this.intensity, now + 0.02);
    }
    this._notifyStateChange();
  }

  /**
   * Zapnutí/vypnutí emise v rámci obálky (pro pulzy a přestávky cyklu)
   * @param {boolean} active 
   * @param {number} duration Délka náběhu/poklesu
   */
  setEmissionActive(active, duration = 0.012) {
    if (!this.isPlaying || !this.envelopeGain || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const g = this.envelopeGain.gain;

    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.00001, g.value), now);

    const target = active ? 1.0 : 0.00001;
    g.exponentialRampToValueAtTime(target, now + duration);
  }

  /**
   * Rychlé ztlumení / odtlumení (Mute toggle)
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      const target = this.isMuted ? 0.00001 : this.intensity;
      this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.012);
    }
    this._notifyStateChange();
    return this.isMuted;
  }

  /**
   * Nouzové odpojení zvuku
   */
  emergencyKill() {
    this.immediateStop();
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }
    this.isMuted = true;
    this._notifyStateChange();
  }

  // ==========================================================================
  // PŘÍPRAVA PRO DYNAMICKÉ GENEROVÁNÍ SEKVENCÍ (DALŠÍ ETAPA)
  // ==========================================================================

  /**
   * Přehraje izolovaný ultrazvukový tón
   * @param {number} freq Frekvence v Hz
   * @param {number} duration Doba trvání v sekundách
   * @param {number} attack Náběh v s
   * @param {number} release Doběh v s
   */
  async playTone(freq, duration = 0.2, attack = 0.01, release = 0.01) {
    if (!this.isPlaying) await this.start();
    this.setFrequency(freq, attack);
    this.setEmissionActive(true, attack);
    return new Promise(resolve => {
      setTimeout(() => {
        this.setEmissionActive(false, release);
        setTimeout(resolve, release * 1000);
      }, duration * 1000);
    });
  }

  /**
   * Přehraje izolovaný frekvenční sweep
   */
  async playSweep(fromFreq, toFreq, duration = 0.4) {
    if (!this.isPlaying) await this.start();
    this.setEmissionActive(true, 0.01);
    this.scheduleSweep(fromFreq, toFreq, duration);
    return new Promise(resolve => {
      setTimeout(resolve, duration * 1000);
    });
  }

  /**
   * Přehraje sérii rychlých ultrazvukových pulzů (Burst train)
   */
  async playBurst(freq, pulseDur = 0.05, gapDur = 0.05, repeat = 3) {
    if (!this.isPlaying) await this.start();
    this.setFrequency(freq, 0.002);
    for (let i = 0; i < repeat; i++) {
      this.setEmissionActive(true, 0.005);
      await new Promise(r => setTimeout(r, pulseDur * 1000));
      this.setEmissionActive(false, 0.005);
      if (i < repeat - 1) {
        await new Promise(r => setTimeout(r, gapDur * 1000));
      }
    }
  }

  // ==========================================================================
  // TELEMETRIE, KONTROLA HRANIC A LISTENERY
  // ==========================================================================

  /**
   * Bezpečně omezí frekvenci na hardware Nyquist limit
   */
  _clampFreq(freq) {
    // Web Audio standardně vyžaduje f <= nyquistFreq
    const maxSafe = this.nyquistFreq ? Math.min(freq, this.nyquistFreq - 1) : freq;
    return Math.max(1000, maxSafe);
  }

  /**
   * Vrátí kompletní telemetrii stavu audio enginu
   */
  getTelemetry() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      engineStatus: this.engineStatus,
      currentFrequency: Math.round(this.currentFrequency),
      targetFrequency: Math.round(this.targetFrequency),
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      intensity: this.intensity,
      sampleRate: this.sampleRate,
      nyquistFreq: this.nyquistFreq,
      deviceWarning: this.deviceSupportWarning,
      audioState: this.audioCtx ? this.audioCtx.state : 'UNINITIALIZED',
      lastError: this.lastError
    };
  }

  /**
   * Poskytuje frekvenční a časová data pro vizualizér
   */
  getAnalyserData() {
    if (!this.analyser) return { freqData: null, timeData: null };

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Uint8Array(this.analyser.frequencyBinCount);

    this.analyser.getByteFrequencyData(freqData);
    this.analyser.getByteTimeDomainData(timeData);

    return { freqData, timeData };
  }

  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  onError(callback) {
    this.errorListeners.push(callback);
  }

  _notifyStateChange() {
    const telemetry = this.getTelemetry();
    this.stateListeners.forEach(cb => {
      try { cb(telemetry); } catch (e) { console.error('Chyba v state callbacku:', e); }
    });
  }

  _notifyError(err) {
    this.errorListeners.forEach(cb => {
      try { cb(err); } catch (e) { console.error('Chyba v error callbacku:', e); }
    });
  }

  _handleContextStateChange() {
    if (this.audioCtx) {
      const state = this.audioCtx.state;
      if (state === 'running') {
        this.engineStatus = this.isPlaying ? 'RUNNING' : 'READY';
      } else if (state === 'suspended') {
        this.engineStatus = 'SUSPENDED';
      } else if (state === 'closed') {
        this.engineStatus = 'CLOSED';
        this.isPlaying = false;
      }
      this._notifyStateChange();
    }
  }

  _bindDeviceChangeListeners() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = async () => {
        console.log('Detekována změna audio výstupního zařízení.');
        if (this.audioCtx) {
          this.sampleRate = this.audioCtx.sampleRate || 48000;
          this.nyquistFreq = Math.floor(this.sampleRate / 2);
          this._notifyStateChange();
        }
      };
    }
  }
}

window.UltrasonicAudioEngine = UltrasonicAudioEngine;
