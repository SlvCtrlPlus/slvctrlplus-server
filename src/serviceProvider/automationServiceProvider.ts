import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import ScriptRuntime from "../automation/scriptRuntime.js";

export default class AutomationServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('automation.scriptRuntime', () => {
            return new ScriptRuntime(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository
            );
        });
    }
}
