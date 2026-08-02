import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import SettingsManager from '../settings/settingsManager.js';
import os from 'os';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';

export default class SettingsServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly dataPath: string | undefined;

    public constructor(dataPath?: string) {
        this.dataPath = dataPath;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('settings.manager', () => {
            const dataPath = this.dataPath ?? `${os.homedir()}/.slvctrlplus`;

            if (false === fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }

            const settingsFilePath = `${dataPath}/settings.json`;

            return new SettingsManager(
                settingsFilePath,
                container.get('serializer.plainToClass'),
                container.get('serializer.classToPlain'),
                container.get('factory.eventEmitter').create(),
                container.get('logger.default'),
            );
        });

        container.set('settings', () => {
            return container.get('settings.manager').load();
        })
    }
}
