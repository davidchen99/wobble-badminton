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

    let stream: MediaStream;
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
      throw new Error(describeCameraError(err));
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
      case 'OverconstrainedError':
        return '摄像头不支持请求的分辨率，请更换摄像头或修改配置。';
      case 'SecurityError':
        return '安全限制：摄像头需要 HTTPS 或 localhost 环境。';
    }
  }
  return `摄像头启动失败：${err instanceof Error ? err.message : String(err)}`;
}
