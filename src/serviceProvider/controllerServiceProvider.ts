import GetDevicesController from '../controller/getDevicesController.js';
import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import GetDeviceController from "../controller/getDeviceController.js";
import PatchDeviceController from "../controller/patchDeviceController.js";
import HealthController from "../controller/healthController.js";
import GetScriptsController from "../controller/automation/getScriptsController.js";
import GetScriptController from "../controller/automation/getScriptController.js";
import CreateScriptController from "../controller/automation/createScriptController.js";
import RunScriptController from "../controller/automation/runScriptController.js";
import StopScriptController from "../controller/automation/stopScriptController.js";
import DeleteScriptController from "../controller/automation/deleteScriptController.js";
import GetLogController from "../controller/automation/getLogController.js";
import StatusScriptController from "../controller/automation/statusScriptController.js";
import GetSettingsController from "../controller/settings/getSettingsController.js";
import PutSettingsController from "../controller/settings/putSettingsController.js";
import ServiceMap from "../serviceMap.js";

export default class ControllerServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('controller.health', () => {
            return new HealthController();
        });

        container.set('controller.getDevices', () => {
            return new GetDevicesController(
                container.get('repository.connectedDevices'),
                container.get('serializer.classToPlain'),
            );
        });

        container.set('controller.getDevice', () => {
            return new GetDeviceController(
                container.get('repository.connectedDevices'),
                container.get('serializer.classToPlain'),
            );
        });

        container.set('controller.patchDevice', () => {
            return new PatchDeviceController(
                container.get('repository.connectedDevices'),
                container.get('device.updater'),
            );
        });

        // Automation
        container.set('controller.automation.getScripts', () => {
            return new GetScriptsController(
                container.get('repository.automationScript'),
                container.get('serializer.classToPlain'),
            );
        });

        container.set('controller.automation.getScript', () => {
            return new GetScriptController(
                container.get('repository.automationScript'),
            );
        });

        container.set('controller.automation.createScript', () => {
            return new CreateScriptController(
                container.get('repository.automationScript'),
            );
        });

        container.set('controller.automation.deleteScript', () => {
            return new DeleteScriptController(
                container.get('repository.automationScript'),
            );
        });

        container.set('controller.automation.runScript', () => {
            return new RunScriptController(
                container.get('automation.scriptRuntime'),
            );
        });

        container.set('controller.automation.stopScript', () => {
            return new StopScriptController(
                container.get('automation.scriptRuntime'),
            );
        });

        container.set('controller.automation.statusScript', () => {
            return new StatusScriptController(
                container.get('automation.scriptRuntime'),
            );
        });

        container.set('controller.automation.getLog', () => {
            return new GetLogController(
                container.get('automation.scriptRuntime'),
            );
        });

        container.set('controller.settings.get', () => {
            return new GetSettingsController(
                container.get('settings.manager'),
                container.get('serializer.classToPlain'),
            );
        });

        container.set('controller.settings.put', () => {
            return new PutSettingsController(
                container.get('settings.manager'),
                container.get('serializer.classToPlain'),
                container.get('settings.schema.validator'),
            );
        });
    }
}
