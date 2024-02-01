import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ScriptRuntime from "../automation/scriptRuntime.js";
import os from "os";
import fs from "fs";
import EventEmitter from "events";
import ServiceMap from "../serviceMap.js";

export default class AutomationServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('automation.scriptRuntime', () => {
            const logPath = `${os.homedir()}/.slvctrlplus/`;

            if (false === fs.existsSync(logPath)) {
                fs.mkdirSync(logPath);
            }

            return new ScriptRuntime(
                container.get('repository.connectedDevices'),
                logPath,
                new EventEmitter()
            );
        });
    }
}
