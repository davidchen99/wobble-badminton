import type { Side } from '../physics/ShuttlePhysics';

interface ToneOpts {
  f0: number;
  f1?: number; // 频率下扫目标（省略则恒定）
  dur: number;
  type: OscillatorType;
  peak: number;
  delay?: number;
}

interface NoiseOpts {
  f0: number;
  f1?: number;
  dur: number;
  peak: number;
  q?: number;
  lowpass?: boolean;
  delay?: number;
}

/**
 * SoundManager：Web Audio API 程序化音效（无素材文件）。
 * 击球声分层：低频拍面撞击 + 中频敲击 + 高频脆响，随挥速变调；
 * 总线挂轻混响（程序化脉冲响应）增加空间感。
 * AudioContext 必须在用户手势后创建（ensure 在开始游戏/按键时调用）。
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** 在用户手势（点击/按键）里调用，创建/恢复音频上下文 */
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // 干声总线 + 湿声（混响）并联
      this.bus = this.ctx.createGain();
      this.bus.gain.value = 1;
      this.bus.connect(this.ctx.destination);
      const convolver = this.ctx.createConvolver();
      convolver.buffer = this.buildImpulse(this.ctx, 0.45, 2.8);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.22;
      this.bus.connect(convolver).connect(wet).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** 击球：分层撞击声，挥速越快越响越亮 */
  hit(speed = 2): void {
    if (!this.ready()) return;
    const s = Math.min(4, Math.max(0.5, speed));
    // 低频拍面撞击（带下扫）
    this.tone({ f0: 150 + 30 * s, f1: 70, dur: 0.09, type: 'sine', peak: 0.32 + 0.05 * s });
    // 中频敲击
    this.tone({ f0: 850 + 180 * s, f1: 480, dur: 0.035, type: 'triangle', peak: 0.12 });
    // 高频脆响
    this.noise({ f0: 2600 + 400 * s, dur: 0.045, peak: 0.2 + 0.04 * s, q: 0.9 });
  }

  /** 挥空：下扫气流声 */
  whiff(): void {
    if (!this.ready()) return;
    this.noise({ f0: 900, f1: 240, dur: 0.22, peak: 0.13, q: 0.7 });
  }

  /** 触网：闷响 + 网面沙沙声 */
  net(): void {
    if (!this.ready()) return;
    this.tone({ f0: 140, f1: 90, dur: 0.12, type: 'sine', peak: 0.16 });
    this.noise({ f0: 480, dur: 0.18, peak: 0.15, lowpass: true });
  }

  /** 落地：短促软弹跳 */
  bounce(): void {
    if (!this.ready()) return;
    this.tone({ f0: 120, f1: 80, dur: 0.07, type: 'sine', peak: 0.13 });
    this.noise({ f0: 800, dur: 0.03, peak: 0.05, lowpass: true });
  }

  /** 得分：玩家得分上行琶音，AI 得分下行低音 */
  point(winner: Side): void {
    if (!this.ready()) return;
    if (winner === 'player') {
      this.tone({ f0: 523, dur: 0.09, type: 'sine', peak: 0.24 });
      this.tone({ f0: 659, dur: 0.09, type: 'sine', peak: 0.24, delay: 0.08 });
      this.tone({ f0: 784, dur: 0.16, type: 'sine', peak: 0.26, delay: 0.16 });
    } else {
      this.tone({ f0: 220, f1: 165, dur: 0.25, type: 'sine', peak: 0.2 });
    }
  }

  /**
   * 人群欢呼（M13）：宽频噪声 swell + 几声口哨点缀，平时保持安静。
   * strength 0~1：玩家得分/扣杀更嗨，AI 得分只给一声低落的小骚动。
   */
  cheer(strength = 1): void {
    if (!this.ready()) return;
    const s = Math.min(1, Math.max(0, strength));
    // 人群噪声主体：带通上扫的"哗——"
    this.noise({ f0: 600, f1: 1500, dur: 0.6 + 0.4 * s, peak: 0.06 + 0.16 * s, q: 0.5 });
    // 口哨点缀（仅较嗨时）
    if (s > 0.45) {
      this.tone({ f0: 1900 + Math.random() * 300, f1: 2400, dur: 0.16, type: 'sine', peak: 0.05 * s, delay: 0.1 });
      this.tone({ f0: 2300 + Math.random() * 300, f1: 1700, dur: 0.14, type: 'sine', peak: 0.04 * s, delay: 0.28 });
    }
  }

  // ---- 内部 ----

  private ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running' && this.bus !== null;
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(o.peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    osc.connect(gain).connect(this.bus!);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private noise(o: NoiseOpts): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.lowpass ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    }
    filter.Q.value = o.q ?? 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    src.connect(filter).connect(gain).connect(this.bus!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.dur + 0.02);
  }

  /** 程序化混响脉冲响应：指数衰减白噪声（立体声） */
  private buildImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }
}
