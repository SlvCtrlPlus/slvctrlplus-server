import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import AutomationScriptRepository from "../repository/automationScriptRepository.js";
import DeviceManager from "../device/deviceManager.js";
import os from "os";
import fs from "fs";

export default class RepositoryServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('repository.connectedDevices', () => {
            return new ConnectedDeviceRepository(
                container.get('device.manager') as DeviceManager,
            );
        });

        container.set('repository.automationScript', () => {
            const scriptsPath = `${os.homedir()}/.slvctrlplus/automation-scripts/`;

            if (false === fs.existsSync(scriptsPath)) {
                fs.mkdirSync(scriptsPath);
            }

            return new AutomationScriptRepository(scriptsPath);
        });
    }
}
