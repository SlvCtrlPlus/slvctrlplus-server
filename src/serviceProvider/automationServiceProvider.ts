import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ScriptRuntime from '../automation/scriptRuntime.js';
import ScriptVmFactory from '../automation/scriptVmFactory.js';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';

export default class AutomationServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly dataPath: string | undefined;

    public constructor(dataPath: string) {
        this.dataPath = dataPath;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('automation.scriptVmFactory', () => {
            return new ScriptVmFactory(
                container.get('repository.connectedDevices'),
                container.get('logger.default'),
            );
        });

        container.set('automation.scriptRuntime', () => {
            const logPath = `${this.dataPath}/automation-logs`;

            if (false === fs.existsSync(logPath)) {
                fs.mkdirSync(logPath, { recursive: true });
            }

            return new ScriptRuntime(
                container.get('automation.scriptVmFactory'),
                logPath,
                container.get('factory.eventEmitter').create(),
                container.get('logger.default'),
            );
        });
    }
}
