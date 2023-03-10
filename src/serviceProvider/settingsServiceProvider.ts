import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import SettingsManager from "../settings/settingsManager.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import os from 'os';
import fs from "fs";

export default class SettingsServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('settings.manager', () => {
            const settingsPath = `${os.homedir()}/.slvctrlplus/`;

            if (false === fs.existsSync(settingsPath)) {
                fs.mkdirSync(settingsPath);
            }

            const settingsManager = new SettingsManager(
                `${settingsPath}settings.json`,
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
