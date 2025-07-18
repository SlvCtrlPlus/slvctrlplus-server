import ClassToPlainSerializer from "./serialization/classToPlainSerializer.js";
import PlainToClassSerializer from "./serialization/plainToClassSerializer.js";
import Logger from "./logging/Logger.js";
import {Server} from "socket.io/dist/index.js";
import DeviceManager from "./device/deviceManager.js";
import SerialDeviceTransportFactory from "./device/transport/serialDeviceTransportFactory.js";
import DeviceProviderFactory from "./device/provider/deviceProviderFactory.js";
import SlvCtrlPlusDeviceFactory from "./device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js";
import ButtplugIoDeviceFactory from "./device/protocol/buttplugIo/buttplugIoDeviceFactory.js";
import DeviceNameGenerator from "./device/deviceNameGenerator.js";
import DeviceUpdaterInterface from "./device/updater/deviceUpdaterInterface.js";
import UuidFactory from "./factory/uuidFactory.js";
import DateFactory from "./factory/dateFactory.js";
import Settings from "./settings/settings.js";
import SettingsManager from "./settings/settingsManager.js";
import ScriptRuntime from "./automation/scriptRuntime.js";
import ConnectedDeviceRepository from "./repository/connectedDeviceRepository.js";
import AutomationScriptRepository from "./repository/automationScriptRepository.js";
import DeviceProviderLoader from "./device/provider/deviceProviderLoader.js";
import DeviceUpdateHandler from "./socket/deviceUpdateHandler.js";
import HealthController from "./controller/healthController.js";
import GetDevicesController from "./controller/getDevicesController.js";
import GetDeviceController from "./controller/getDeviceController.js";
import PatchDeviceController from "./controller/patchDeviceController.js";
import GetScriptsController from "./controller/automation/getScriptsController.js";
import GetScriptController from "./controller/automation/getScriptController.js";
import CreateScriptController from "./controller/automation/createScriptController.js";
import DeleteScriptController from "./controller/automation/deleteScriptController.js";
import GetLogController from "./controller/automation/getLogController.js";
import RunScriptController from "./controller/automation/runScriptController.js";
import StopScriptController from "./controller/automation/stopScriptController.js";
import StatusScriptController from "./controller/automation/statusScriptController.js";
import DelegatedVirtualDeviceFactory from "./device/protocol/virtual/delegatedVirtualDeviceFactory.js";
import VirtualDeviceProvider from "./device/protocol/virtual/virtualDeviceProvider.js";
import VirtualDeviceProviderFactory from "./device/protocol/virtual/virtualDeviceProviderFactory.js";
import GenericVirtualDeviceFactory from "./device/protocol/virtual/genericVirtualDeviceFactory.js";
import DisplayVirtualDeviceLogic from "./device/protocol/virtual/display/displayVirtualDeviceLogic.js";
import RandomGeneratorVirtualDeviceLogic from "./device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js";
import TtsVirtualDeviceLogic from "./device/protocol/virtual/audio/ttsVirtualDeviceLogic.js";
import GetSettingsController from "./controller/settings/getSettingsController.js";
import PutSettingsController from "./controller/settings/putSettingsController.js";
import JsonSchemaValidatorFactory from "./schemaValidation/JsonSchemaValidatorFactory.js";
import JsonSchemaValidator from "./schemaValidation/JsonSchemaValidator.js";
import VersionController from "./controller/versionController.js";
import Ajv from "ajv/dist/2020.js";

/* eslint-disable  @typescript-eslint/naming-convention */
type ServiceMap = {
    /* serializerServiceProvider */
    'serializer.classToPlain': ClassToPlainSerializer,
    'serializer.plainToClass': PlainToClassSerializer,

    /* loggerServiceProvider */
    'logger.default': Logger,

    /* serverServiceProvider */
    'server.websocket': Server,

    /* deviceServiceProvider */
    'device.manager': DeviceManager,
    'device.serial.transport.factory': SerialDeviceTransportFactory,
    'device.provider.factory.slvCtrlPlusSerial': DeviceProviderFactory,
    'device.provider.factory.virtual': VirtualDeviceProviderFactory,
    'device.serial.factory.slvCtrlPlus': SlvCtrlPlusDeviceFactory,
    'device.provider.factory.buttplugIoWebsocket': DeviceProviderFactory,
    'device.serial.factory.buttplugIo': ButtplugIoDeviceFactory,
    'device.virtual.provider': VirtualDeviceProvider,
    'device.virtual.factory.delegated': DelegatedVirtualDeviceFactory,
    'device.virtual.factory.randomGenerator': GenericVirtualDeviceFactory<RandomGeneratorVirtualDeviceLogic>,
    'device.virtual.factory.display': GenericVirtualDeviceFactory<DisplayVirtualDeviceLogic>,
    'device.virtual.factory.tts': GenericVirtualDeviceFactory<TtsVirtualDeviceLogic>,
    'device.uniqueNameGenerator': DeviceNameGenerator,
    'device.updater': DeviceUpdaterInterface,

    /* factoryServiceProvider */
    'factory.uuid': UuidFactory,
    'factory.date': DateFactory,

    /* schemaValidationServiceProvider */
    'ajv': Ajv,
    'factory.validator.schema.json': JsonSchemaValidatorFactory,

    /* settingsServiceProvider */
    'settings': Settings,
    'settings.manager': SettingsManager,
    'settings.schema.validator': JsonSchemaValidator,

    /* automationServiceProvider */
    'automation.scriptRuntime': ScriptRuntime,

    /* repositoryServiceProvider */
    'repository.connectedDevices': ConnectedDeviceRepository,
    'repository.automationScript': AutomationScriptRepository,

    'device.provider.loader': DeviceProviderLoader,
    'socket.deviceUpdateHandler': DeviceUpdateHandler,

    /* controllerServiceProvider */
    'controller.health': HealthController,
    'controller.getDevices': GetDevicesController,
    'controller.getDevice': GetDeviceController,
    'controller.patchDevice': PatchDeviceController,
    'controller.automation.getScripts': GetScriptsController,
    'controller.automation.getScript': GetScriptController,
    'controller.automation.createScript': CreateScriptController,
    'controller.automation.deleteScript': DeleteScriptController,
    'controller.automation.getLog': GetLogController,
    'controller.automation.runScript': RunScriptController,
    'controller.automation.stopScript': StopScriptController,
    'controller.automation.statusScript': StatusScriptController,
    'controller.settings.get': GetSettingsController,
    'controller.settings.put': PutSettingsController,
    'controller.version': VersionController,
}

export default ServiceMap;
