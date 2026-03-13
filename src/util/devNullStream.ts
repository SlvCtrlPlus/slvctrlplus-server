import { Writable } from 'stream';

export default class DevNullStream extends Writable {
    private readonly timeoutMs: number;
    private timer?: NodeJS.Timeout;

    public constructor(timeoutMs: number = 500) {
        super();
        this.timeoutMs = timeoutMs;
        this.resetTimer();
    }

    public _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
        this.resetTimer();
        callback();
    }

    public _final(callback: (error?: Error | null) => void): void {
        if (this.timer) clearTimeout(this.timer);
        callback();
    }

    private resetTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.emit('idle'), this.timeoutMs);
    }
}
