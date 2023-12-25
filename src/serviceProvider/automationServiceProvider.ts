import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import ScriptRuntime from "../automation/scriptRuntime.js";
import os from "os";
import fs from "fs";
import EventEmitter from "events";

export default class AutomationServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('automation.scriptRuntime', () => {
            const logPath = `${os.homedir()}/.slvctrlplus/`;

            if (false === fs.existsSync(logPath)) {
                fs.mkdirSync(logPath);
            }

            return new ScriptRuntime(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                logPath,
                new EventEmitter()
            );
        });
    }
}
