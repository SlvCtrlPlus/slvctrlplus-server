import GetDevicesController from '../controller/getDevicesController.js';
import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import GetDeviceController from "../controller/getDeviceController.js";
import PatchDeviceController from "../controller/patchDeviceController.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/deviceUpdaterInterface.js";
import HealthController from "../controller/healthController.js";
import GetScriptsController from "../controller/automation/getScriptsController.js";
import AutomationScriptRepositoryInterface from "../repository/automationScriptRepositoryInterface.js";
import GetScriptController from "../controller/automation/getScriptController.js";
import CreateScriptController from "../controller/automation/createScriptController.js";
import RunScriptController from "../controller/automation/runScriptController.js";
import ScriptRuntime from "../automation/scriptRuntime.js";
import StopScriptController from "../controller/automation/stopScriptController.js";

export default class ControllerServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('controller.health', () => {
            return new HealthController();
        });

        container.set('controller.getDevices', () => {
            return new GetDevicesController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );
        });

        container.set('controller.getDevice', () => {
            return new GetDeviceController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );
        });

        container.set('controller.patchDevice', () => {
            return new PatchDeviceController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('device.updater') as DeviceUpdaterInterface,
            );
        });

        // Automation
        container.set('controller.automation.getScripts', () => {
            return new GetScriptsController(
                container.get('repository.automationScript') as AutomationScriptRepositoryInterface,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );
        });

        container.set('controller.automation.getScript', () => {
            return new GetScriptController(
                container.get('repository.automationScript') as AutomationScriptRepositoryInterface,
            );
        });

        container.set('controller.automation.createScript', () => {
            return new CreateScriptController(
                container.get('repository.automationScript') as AutomationScriptRepositoryInterface,
            );
        });

        container.set('controller.automation.runScript', () => {
            return new RunScriptController(
                container.get('automation.scriptRuntime') as ScriptRuntime,
            );
        });

        container.set('controller.automation.stopScript', () => {
            return new StopScriptController(
                container.get('automation.scriptRuntime') as ScriptRuntime,
            );
        });
    }
}
