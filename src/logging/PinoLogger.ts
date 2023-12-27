import Logger from "./Logger.js";
import pino from "pino/pino.js";

export default class PinoLogger implements Logger
{
    private pino: pino.Logger;

    public constructor(logger: pino.Logger) {
        this.pino = logger;
    }

    public trace(msg: string, ...args: any[]): void {
        this.pino.trace(msg, args);
    }

    public debug(msg: string, ...args: any[]): void {
        this.pino.debug(msg, args);
    }

    public info(msg: string, ...args: any[]): void {
        this.pino.info(msg, args);
    }

    public warn(msg: string, ...args: any[]): void {
        this.pino.warn(msg, args);
    }

    public error(msg: string, ...args: any[]): void {
        this.pino.error(msg, args);
    }

    public fatal(msg: string, ...args: any[]): void {
        this.pino.fatal(msg, args);
    }
}
