export type FrameTrigger = 'init' | 'tap' | 'gps' | 'tick' | 'heading';

export type FrameSample = {
  at: string;
  bytes: number;
  fetchMs: number;
  sdkMs: number;
  totalMs: number;
  sdkResult: string;
  trigger: FrameTrigger;
};

const MAX_SAMPLES = 24;

export class FrameMetrics {
  private samples: FrameSample[] = [];

  record(sample: FrameSample) {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  getSamples(): FrameSample[] {
    return [...this.samples];
  }

  last(): FrameSample | undefined {
    return this.samples.at(-1);
  }

  average(field: 'fetchMs' | 'sdkMs' | 'totalMs'): number {
    if (!this.samples.length) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s[field], 0);
    return sum / this.samples.length;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  /** G2 ステータス行向け（短い） */
  formatG2Status(sample: FrameSample): string {
    const kb = this.formatBytes(sample.bytes);
    const avg = Math.round(this.average('sdkMs'));
    return `送信 ${Math.round(sample.totalMs)}ms (${kb}) SDK ${Math.round(sample.sdkMs)}ms 平均${avg}ms`;
  }

  formatPhoneReport(): string {
    const last = this.last();
    if (!last) return 'まだ計測がありません。G2 でタップすると再送計測します。';
    const lines = [
      '検証 3 — 送信性能（直近サンプル）',
      `時刻: ${last.at}`,
      `サイズ: ${this.formatBytes(last.bytes)}`,
      `fetch: ${last.fetchMs.toFixed(0)} ms`,
      `trigger: ${last.trigger}`,
      `updateImageRawData: ${last.sdkMs.toFixed(0)} ms (${last.sdkResult})`,
      `合計: ${last.totalMs.toFixed(0)} ms`,
      '',
      `平均 (${this.samples.length} 回): fetch ${this.average('fetchMs').toFixed(0)} ms · SDK ${this.average('sdkMs').toFixed(0)} ms · 合計 ${this.average('totalMs').toFixed(0)} ms`
    ];
    return lines.join('\n');
  }
}
