import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import SettingsManager from "../settings/settingsManager.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import os from 'os';

export default class SettingsServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('settings.manager', () => {
            const settingsManager = new SettingsManager(
                `${os.homedir()}/slvctrl.settings.json`,
                container.get('serializer.plainToClass') as PlainToClassSerializer,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );

            settingsManager.load();

            return settingsManager;
        });

        container.set('settings', () => {
            return (container.get('settings.manager') as SettingsManager).load();
        })
    }
}
