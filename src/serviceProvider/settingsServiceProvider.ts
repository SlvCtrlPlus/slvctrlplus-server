import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import SettingsManager from '../settings/settingsManager.js';
import os from 'os';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';
import path from 'path';
import { fileURLToPath } from 'url';

export default class SettingsServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly customSettingsFilePath: string | undefined;

    public constructor(settingsFilePath?: string) {
        this.customSettingsFilePath = settingsFilePath;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('settings.schema.validator', () => {
            const jsonSchemaValidatorFactory = container.get('factory.validator.schema.json');

            const dirname = path.dirname(fileURLToPath(import.meta.url));
            const settingsSchemaPath = path.resolve(dirname, '../../resources/schemas/settings.schema.json');

            return jsonSchemaValidatorFactory.createFromFile(settingsSchemaPath);
        });

        container.set('settings.manager', () => {
            let settingsFilePath: string;

            if (this.customSettingsFilePath !== undefined) {
                settingsFilePath = this.customSettingsFilePath;
                const settingsDir = path.dirname(settingsFilePath);

                if (false === fs.existsSync(settingsDir)) {
                    fs.mkdirSync(settingsDir, { recursive: true });
                }
            } else {
                const settingsPath = `${os.homedir()}/.slvctrlplus/`;

                if (false === fs.existsSync(settingsPath)) {
                    fs.mkdirSync(settingsPath);
                }

                settingsFilePath = `${settingsPath}settings.json`;
            }

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
