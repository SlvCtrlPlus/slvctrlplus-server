import Logger, {ChildLoggerBindings, ChildLoggerOptions} from "./Logger.js";
import pino from "pino/pino.js";

export default class PinoLogger implements Logger
{
    private pino: pino.Logger;

    public constructor(logger: pino.Logger) {
        this.pino = logger;
    }

    public child(bindings?: ChildLoggerBindings, options?: ChildLoggerOptions): Logger {
        return this.pino.child(
            bindings ?? {} as pino.Bindings,
            undefined === options ? undefined : options as pino.ChildLoggerOptions
        );
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
