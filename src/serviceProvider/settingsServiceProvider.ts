import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import SettingsManager from '../settings/settingsManager.js';
import os from 'os';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';
import path from 'path';
import { fileURLToPath } from 'url';

export default class SettingsServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly dataPath: string | undefined;

    public constructor(dataPath?: string) {
        this.dataPath = dataPath;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('settings.schema.validator', () => {
            const jsonSchemaValidatorFactory = container.get('factory.validator.schema.json');

            const dirname = path.dirname(fileURLToPath(import.meta.url));
            const settingsSchemaPath = path.resolve(dirname, '../../resources/schemas/settings.schema.json');

            return jsonSchemaValidatorFactory.createFromFile(settingsSchemaPath);
        });

        container.set('settings.manager', () => {
            const dataPath = this.dataPath ?? `${os.homedir()}/.slvctrlplus`;

            if (false === fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }

            const settingsFilePath = `${dataPath}/settings.json`;

            const settingsManager = new SettingsManager(
                settingsFilePath,
                container.get('serializer.plainToClass'),
                container.get('serializer.classToPlain'),
                container.get('settings.schema.validator'),
                container.get('factory.eventEmitter').create(),
                container.get('logger.default'),
            );

            settingsManager.load();

            return settingsManager;
        });

        container.set('settings', () => {
            return container.get('settings.manager').load();
        })
    }
}
