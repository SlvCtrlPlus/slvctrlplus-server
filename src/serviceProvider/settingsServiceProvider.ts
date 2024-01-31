import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import SettingsManager from "../settings/settingsManager.js";
import os from 'os';
import fs from "fs";
import {ServiceMap} from "../types.js";

export default class SettingsServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('settings.manager', () => {
            const settingsPath = `${os.homedir()}/.slvctrlplus/`;

            if (false === fs.existsSync(settingsPath)) {
                fs.mkdirSync(settingsPath);
            }

            const settingsManager = new SettingsManager(
                `${settingsPath}settings.json`,
                container.get('serializer.plainToClass'),
                container.get('serializer.classToPlain'),
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
