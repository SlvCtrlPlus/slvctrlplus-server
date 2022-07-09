import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import Pino from "pino"
import PinoLogger from "../logger/pinoLogger.js";
import LoggerInterface from "../logger/loggerInterface.js";

export default class LoggerServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('logger', (): LoggerInterface => {
            const pino = Pino({
                name: 'app-name',
                level: 'debug'
            });

            return new PinoLogger(pino);
        });
    }
}
