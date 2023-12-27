import Logger from "./Logger.js";
import pino from "pino/pino.js";

export default class PinoLogger implements Logger
{
    private logger: pino.Logger;

    public constructor(logger: pino.Logger) {
        this.logger = logger;
    }

    public trace(msg: string, ...args: any[]): void {
        this.logger.trace(msg, args);
    }

    public debug(msg: string, ...args: any[]): void {
        this.logger.debug(msg, args);
    }

    public info(msg: string, ...args: any[]): void {
        this.logger.info(msg, args);
    }

    public warn(msg: string, ...args: any[]): void {
        this.logger.warn(msg, args);
    }

    public error(msg: string, ...args: any[]): void {
        this.logger.error(msg, args);
    }

    public fatal(msg: string, ...args: any[]): void {
        this.logger.fatal(msg, args);
    }
}
