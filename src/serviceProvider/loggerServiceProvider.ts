import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import { default as Pino } from 'pino';
import Logger from '../logging/Logger.js';
import PinoLogger from '../logging/PinoLogger.js';
import ServiceMap from '../serviceMap.js';

export default class LoggerServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('logger.default', (): Logger => {
            const LOG_LEVEL = process.env.LOG_LEVEL;

            return new PinoLogger(Pino({
                name: 'default',
                level: LOG_LEVEL,
                formatters: {
                    level: (label: string) => {
                        return { level: label.toUpperCase() };
                    },
                },
                errorKey: 'error',
            }));
        });
    }
}
