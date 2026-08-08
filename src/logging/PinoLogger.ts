import type { ChildLoggerBindings, ChildLoggerOptions } from './Logger.js';
import type Logger from './Logger.js';
import type pino from 'pino/pino.js';

export default class PinoLogger implements Logger
{
    private readonly pino: pino.Logger;

    public constructor(logger: pino.Logger) {
        this.pino = logger;
    }

    public child(bindings?: ChildLoggerBindings, options?: ChildLoggerOptions): Logger {
        return new PinoLogger(this.pino.child(
            bindings ?? {},
            options ?? undefined,
        ));
    }

    public trace(msg: string, context?: unknown): void {
        this.pino.trace(context, msg);
    }

    public debug(msg: string, context?: unknown): void {
        this.pino.debug(context, msg);
    }

    public info(msg: string, context?: unknown): void {
        this.pino.info(context, msg);
    }

    public warn(msg: string, context?: unknown): void {
        this.pino.warn(context, msg);
    }

    public error(msg: string, context?: unknown): void {
        this.pino.error(context, msg);
    }

    public fatal(msg: string, context?: unknown): void {
        this.pino.fatal(context, msg);
    }
}
