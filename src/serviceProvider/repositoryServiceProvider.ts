import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import AutomationScriptRepository from '../repository/automationScriptRepository.js';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';

export default class RepositoryServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly dataPath: string | undefined;

    public constructor(dataPath?: string) {
        this.dataPath = dataPath;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('repository.connectedDevices', () => {
            return new ConnectedDeviceRepository(
                container.get('device.manager'),
            );
        });

        container.set('repository.automationScript', () => {
            const scriptsPath = `${this.dataPath}/automation-scripts/`;

            if (false === fs.existsSync(scriptsPath)) {
                fs.mkdirSync(scriptsPath);
            }

            return new AutomationScriptRepository(scriptsPath);
        });
    }
}
