/**
 * CameraManager：摄像头申请、错误处理、生命周期。
 * 所有错误转成用户能看懂的中文文案抛出，由调用方显示到 HUD（TECH_SPEC 要求）。
 */
export class CameraManager {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }

  async start(): Promise<void> {
    if (!window.isSecureContext) {
      throw new Error('摄像头需要 HTTPS 或 localhost 环境，请通过 localhost 访问游戏页面。');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头 API，请使用最新版 Chrome/Edge。');
    }

    let stream: MediaStream | null = null;
    let lastErr: unknown;
    // 摄像头偶发启动超时（多个游戏页面/程序抢占用、驱动初始化慢）：
    // 可重试的错误隔 1.2s 再试一次，仍失败才报错给用户
    for (let attempt = 0; attempt < 2 && !stream; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });
      } catch (err) {
        lastErr = err;
        if (!isRetriableCameraError(err)) break; // 权限拒绝等硬错误不必重试
      }
    }
    if (!stream) {
      throw new Error(describeCameraError(lastErr));
    }

    this.stream = stream;
    this.video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      this.video.onloadedmetadata = () => resolve();
      this.video.onerror = () => reject(new Error('摄像头视频流加载失败。'));
    });
    await this.video.play();
  }

  get ready(): boolean {
    return this.stream !== null && this.video.readyState >= 2;
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}

/** 可重试的临时错误：超时/占用类值得再试一次，权限/无设备等硬错误直接报 */
function isRetriableCameraError(err: unknown): boolean {
  if (err instanceof DOMException) {
    if (err.name === 'AbortError' || err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return true;
    }
  }
  return err instanceof Error && /timeout/i.test(err.message);
}

function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return '摄像头权限被拒绝。请在浏览器地址栏允许摄像头权限后刷新页面。';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '没有找到摄像头。请确认摄像头已连接且未被禁用。';
      case 'NotReadableError':
      case 'TrackStartError':
        return '摄像头被其他程序占用，请关闭其他使用摄像头的应用后刷新。';
      case 'AbortError':
        return '摄像头启动超时。多半是别的窗口/程序正占着摄像头：请关掉多余的游戏页面、会议或视频软件，然后刷新重试。';
      case 'OverconstrainedError':
        return '摄像头不支持请求的分辨率，请更换摄像头或修改配置。';
      case 'SecurityError':
        return '安全限制：摄像头需要 HTTPS 或 localhost 环境。';
    }
  }
  if (err instanceof Error && /timeout/i.test(err.message)) {
    return '摄像头启动超时。请关闭其他游戏页面/视频软件后刷新重试。';
  }
  return `摄像头启动失败：${err instanceof Error ? err.message : String(err)}`;
}
