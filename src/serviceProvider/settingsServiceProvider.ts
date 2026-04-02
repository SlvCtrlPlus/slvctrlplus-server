import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import SettingsManager from '../settings/settingsManager.js';
import os from 'os';
import fs from 'fs';
import ServiceMap from '../serviceMap.js';
import { SettingsSchema } from '../settings/settings.js';

export default class SettingsServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('settings.schema.validator', () => {
            const jsonSchemaValidatorFactory = container.get('factory.validator.schema.json');

            return jsonSchemaValidatorFactory.create(SettingsSchema);
        });

        container.set('settings.manager', () => {
            const settingsPath = `${os.homedir()}/.slvctrlplus/`;

            if (false === fs.existsSync(settingsPath)) {
                fs.mkdirSync(settingsPath);
            }

            const settingsManager = new SettingsManager(
                `${settingsPath}settings.json`,
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
