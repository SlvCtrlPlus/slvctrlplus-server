import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import AutomationScriptRepository from "../repository/automationScriptRepository.js";
import os from "os";
import fs from "fs";
import ServiceMap from "../serviceMap.js";

export default class RepositoryServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('repository.connectedDevices', () => {
            return new ConnectedDeviceRepository(
                container.get('device.manager'),
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
