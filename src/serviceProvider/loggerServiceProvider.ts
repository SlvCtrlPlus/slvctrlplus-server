import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import { default as Pino } from 'pino';
import Logger from "../logging/Logger.js";
import PinoLogger from "../logging/PinoLogger.js";

export default class LoggerServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('logger.default', (): Logger => {
            const LOG_LEVEL = process.env.LOG_LEVEL;

            return new PinoLogger(Pino({
                name: 'default',
                level: LOG_LEVEL,
                formatters: {
                    level: (label) => {
                        return { level: label.toUpperCase() };
                    },
                },
            }));
        });
    }
}
