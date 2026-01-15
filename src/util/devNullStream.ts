import {Writable} from "stream";
import EventEmitter from "events";

export default class DevNullStream extends Writable {
    private readonly timeoutMs: number;
    private timer?: NodeJS.Timeout;
    private readonly events = new EventEmitter();

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

    private resetTimer() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.emit('idle'), this.timeoutMs);
    }
}
