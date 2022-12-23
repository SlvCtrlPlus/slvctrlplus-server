import LoggerInterface from "./loggerInterface.js";
import pino from "pino"

export default class PinoLogger implements LoggerInterface
{
    private readonly logger: pino.Logger;

    public constructor(logger: pino.Logger) {
        this.logger = logger;
    }

    public info(msg: string): void {
        this.logger.error(msg)
    }

    public error(msg: string): void {
        this.logger.error(msg);
    }

    public warn(msg: string): void {
        this.logger.warn(msg);
    }
}
