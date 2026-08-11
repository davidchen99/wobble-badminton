import type { Side } from '../physics/ShuttlePhysics';

/**
 * SoundManager：Web Audio API 程序化音效，不依赖任何音频素材文件。
 * AudioContext 必须在用户手势后创建（ensure 在开始游戏时调用）。
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** 在用户手势（点击/按键）里调用，创建/恢复音频上下文 */
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** 击球：短促噪声爆 + 高频嘀，速度越快越响越亮 */
  hit(speed = 2): void {
    const ctx = this.ready();
    if (!ctx) return;
    const gain = Math.min(0.5, 0.25 + speed * 0.06);
    this.noiseBurst(0.06, 2500 + speed * 500, gain);
    this.tone(320 + speed * 40, 0.09, 'triangle', gain * 0.9, 0.004);
  }

  /** 挥空：低频下扫的气流声 */
  whiff(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.noiseBurst(0.18, 700, 0.12, 300);
  }

  /** 得分：玩家得分上行双音，AI 得分低沉单音 */
  point(winner: Side): void {
    const ctx = this.ready();
    if (!ctx) return;
    if (winner === 'player') {
      this.tone(523, 0.1, 'sine', 0.25, 0.005);
      this.tone(784, 0.16, 'sine', 0.25, 0.005, 0.09);
    } else {
      this.tone(196, 0.22, 'sine', 0.22, 0.01);
    }
  }

  private ready(): AudioContext | null {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    attack: number,
    delay = 0,
  ): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 噪声爆：白噪声经带通滤波，endFreq 低于 startFreq 时产生下扫感 */
  private noiseBurst(dur: number, startFreq: number, peak: number, endFreq?: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq, t0);
    if (endFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    }
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }
}
