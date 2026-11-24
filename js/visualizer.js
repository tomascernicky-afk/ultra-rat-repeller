/**
 * ============================================================================
 * ULTRA RAT REPELLER — VISUALIZER STAGE
 * High-performance HTML5 Canvas Visualizer:
 *  - Mode 1: RADAR (Acoustic Sonar Ripples + 22–25 kHz Band Gauge)
 *  - Mode 2: HISTORY (Time-domain strip chart of frequency changes)
 *  - Mode 3: SCOPE (Real-time Audio Analyser oscilloscope & FFT bars)
 * ============================================================================
 */

class UltrasonicVisualizer {
  constructor(canvasElement, audioEngine, antiHabEngine) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.audio = audioEngine;
    this.engine = antiHabEngine;

    this.mode = 'radar'; // 'radar', 'history', 'scope'
    this.animFrameId = null;

    // Sonar Ripple particles
    this.ripples = [];
    this.lastRippleTime = 0;

    // History buffer for frequency timeline (last 120 points)
    this.historyBuffer = [];
    this.maxHistory = 150;

    // High DPI Canvas Scaling
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.start();
  }

  setVisualMode(mode) {
    this.mode = mode;
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  start() {
    const loop = (now) => {
      this.render(now);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  pushHistoryPoint(freq, isActive) {
    this.historyBuffer.push({
      freq,
      isActive,
      time: Date.now()
    });
    if (this.historyBuffer.length > this.maxHistory) {
      this.historyBuffer.shift();
    }
  }

  render(timestamp) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear background
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    // Grid lines for high-tech HUD look
    this._drawGrid(ctx, w, h);

    const isRunning = this.audio.isPlaying;
    const isEmitting = this.engine.currentPhase === 'EMITTING' && !this.audio.isMuted;
    const currentF = this.audio.currentFrequency;

    // Feed history
    if (isRunning && (!this.lastHistoryPush || timestamp - this.lastHistoryPush > 60)) {
      this.pushHistoryPoint(currentF, isEmitting);
      this.lastHistoryPush = timestamp;
    }

    switch (this.mode) {
      case 'radar':
        this._drawRadarView(ctx, w, h, isEmitting, currentF, timestamp);
        break;
      case 'history':
        this._drawHistoryView(ctx, w, h, isEmitting, currentF);
        break;
      case 'scope':
        this._drawScopeView(ctx, w, h, isEmitting);
        break;
      default:
        this._drawRadarView(ctx, w, h, isEmitting, currentF, timestamp);
    }
  }

  _drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(31, 40, 62, 0.4)';
    ctx.lineWidth = 1;

    const stepX = 40;
    const stepY = 30;

    ctx.beginPath();
    for (let x = stepX; x < w; x += stepX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = stepY; y < h; y += stepY) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * MODE 1: RADAR / SONAR VIEW
   */
  _drawRadarView(ctx, w, h, isEmitting, currentF, timestamp) {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) * 0.88;

    // Spawn ripples when emitting
    if (isEmitting && timestamp - this.lastRippleTime > 110) {
      this.ripples.push({
        r: 10,
        alpha: 1.0,
        freq: currentF,
        speed: 2.2 + (currentF - 22000) / 1500
      });
      this.lastRippleTime = timestamp;
    }

    // Static radar rings
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1.2;

    for (let i = 1; i <= 4; i++) {
      const r = (maxR / 4) * i;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Render animated expanding ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.r += rip.speed;
      rip.alpha -= 0.016;

      if (rip.alpha <= 0 || rip.r > maxR * 1.15) {
        this.ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, rip.r, 0, Math.PI * 2);

      // Color based on frequency (cyan 22k -> violet 25k)
      const ratio = Math.max(0, Math.min(1, (rip.freq - 22000) / 3000));
      const red = Math.floor(ratio * 168);
      const green = Math.floor((1 - ratio) * 240 + 85);
      const blue = 255;

      ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${rip.alpha * 0.75})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Central emitter beacon
    ctx.beginPath();
    ctx.arc(cx, cy, isEmitting ? 9 : 5, 0, Math.PI * 2);
    if (isEmitting) {
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
    } else {
      ctx.fillStyle = '#475569';
      ctx.shadowBlur = 0;
    }
    ctx.fill();

    // Frequency Gauge Ring
    if (isEmitting) {
      const angle = ((currentF - 22000) / 3000) * (Math.PI * 1.5) - Math.PI * 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, -Math.PI * 0.75, angle);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * MODE 2: HISTORY TIMELINE VIEW
   */
  _drawHistoryView(ctx, w, h, isEmitting, currentF) {
    ctx.save();

    // 22k - 25k reference guide lines
    const minF = 22000;
    const maxF = 25000;
    const topY = 24;
    const bottomY = h - 24;
    const drawH = bottomY - topY;

    // Helper to map frequency to Y
    const freqToY = (f) => {
      const norm = (f - minF) / (maxF - minF);
      return bottomY - norm * drawH;
    };

    // Reference labels
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText('25.0 kHz', 10, topY + 4);
    ctx.fillText('23.5 kHz', 10, topY + drawH / 2 + 4);
    ctx.fillText('22.0 kHz', 10, bottomY + 4);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(60, topY); ctx.lineTo(w - 10, topY);
    ctx.moveTo(60, topY + drawH / 2); ctx.lineTo(w - 10, topY + drawH / 2);
    ctx.moveTo(60, bottomY); ctx.lineTo(w - 10, bottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw trace from history buffer
    if (this.historyBuffer.length > 1) {
      const startX = 60;
      const availableW = w - startX - 10;
      const stepX = availableW / (this.maxHistory - 1);

      ctx.beginPath();
      let firstPoint = true;

      for (let i = 0; i < this.historyBuffer.length; i++) {
        const pt = this.historyBuffer[i];
        const x = startX + i * stepX;
        const y = freqToY(pt.freq);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = isEmitting ? '#00f0ff' : '#475569';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isEmitting ? '#00f0ff' : 'transparent';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Current cursor pulse
      const lastIndex = this.historyBuffer.length - 1;
      const lastPt = this.historyBuffer[lastIndex];
      const curX = startX + lastIndex * stepX;
      const curY = freqToY(lastPt.freq);

      ctx.beginPath();
      ctx.arc(curX, curY, isEmitting ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isEmitting ? '#a855f7' : '#64748b';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * MODE 3: SCOPE & FFT SPECTRUM VIEW
   */
  _drawScopeView(ctx, w, h, isEmitting) {
    const { freqData, timeData } = this.audio.getAnalyserData();
    if (!freqData || !timeData) return;

    ctx.save();

    // 1. Draw FFT Frequency spectrum bars
    const barCount = 48;
    const barWidth = (w - 20) / barCount;
    const bottomY = h - 12;

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * (freqData.length * 0.9));
      const val = freqData[idx] / 255.0;
      const barH = val * (h * 0.7);

      const x = 10 + i * barWidth;
      const y = bottomY - barH;

      const grad = ctx.createLinearGradient(0, bottomY, 0, y);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0.7)');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth - 2, barH);
    }

    // 2. Draw Oscilloscope waveform curve
    ctx.lineWidth = 2;
    ctx.strokeStyle = isEmitting ? '#00f0ff' : '#475569';
    ctx.shadowColor = isEmitting ? '#00f0ff' : 'transparent';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    const sliceWidth = (w - 20) / timeData.length;
    let x = 10;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * h) / 2.6 + 20;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }
    ctx.stroke();

    ctx.restore();
  }
}

window.UltrasonicVisualizer = UltrasonicVisualizer;
