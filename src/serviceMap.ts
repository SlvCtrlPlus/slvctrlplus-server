import type { Ajv } from 'ajv';
import type ClassToPlainSerializer from './serialization/classToPlainSerializer.js';
import type PlainToClassSerializer from './serialization/plainToClassSerializer.js';
import type Logger from './logging/Logger.js';
import type DeviceManager from './device/deviceManager.js';
import type SerialDeviceTransportFactory from './device/transport/serialDeviceTransportFactory.js';
import type DeviceProviderFactory from './device/provider/deviceProviderFactory.js';
import type SlvCtrlPlusDeviceFactory from './device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js';
import type ButtplugIoDeviceFactory from './device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import type DeviceNameGenerator from './device/deviceNameGenerator.js';
import type DeviceUpdaterInterface from './device/updater/deviceUpdaterInterface.js';
import type UuidFactory from './factory/uuidFactory.js';
import type DateFactory from './factory/dateFactory.js';
import type Settings from './settings/settings.js';
import type SettingsManager from './settings/settingsManager.js';
import type ScriptRuntime from './automation/scriptRuntime.js';
import type ScriptVmFactory from './automation/scriptVmFactory.js';
import type ConnectedDeviceRepository from './repository/connectedDeviceRepository.js';
import type AutomationScriptRepository from './repository/automationScriptRepository.js';
import type DeviceProviderManager from './device/provider/deviceProviderManager.js';
import type DeviceUpdateHandler from './socket/deviceUpdateHandler.js';
import type HealthController from './controller/healthController.js';
import type HealthMetricsCollector from './health/healthMetricsCollector.js';
import type GetDevicesController from './controller/getDevicesController.js';
import type GetDeviceController from './controller/getDeviceController.js';
import type PatchDeviceController from './controller/patchDeviceController.js';
import type GetScriptsController from './controller/automation/getScriptsController.js';
import type GetScriptController from './controller/automation/getScriptController.js';
import type CreateScriptController from './controller/automation/createScriptController.js';
import type DeleteScriptController from './controller/automation/deleteScriptController.js';
import type GetLogController from './controller/automation/getLogController.js';
import type RunScriptController from './controller/automation/runScriptController.js';
import type StopScriptController from './controller/automation/stopScriptController.js';
import type StatusScriptController from './controller/automation/statusScriptController.js';
import type VirtualDeviceProvider from './device/protocol/virtual/virtualDeviceProvider.js';
import type VirtualDeviceProviderFactory from './device/protocol/virtual/virtualDeviceProviderFactory.js';
import type GetSettingsController from './controller/settings/getSettingsController.js';
import type PutSettingsController from './controller/settings/putSettingsController.js';
import type JsonSchemaValidatorFactory from './schemaValidation/JsonSchemaValidatorFactory.js';
import type VersionController from './controller/versionController.js';
import type SerialPortObserver from './device/transport/serialPortObserver.js';
import type Zc95DeviceFactory from './device/protocol/zc95/zc95DeviceFactory.js';
import type VirtualDeviceFactory from './device/protocol/virtual/virtualDeviceFactory.js';
import type SerialPortFactory from './factory/serialPortFactory.js';
import type Estim2bDeviceFactory from './device/protocol/estim2b/estim2bDeviceFactory.js';
import type EventEmitterFactory from './factory/eventEmitterFactory.js';
import type BleObserver from './device/transport/bleObserver.js';
import type SlvCtrlPlusSerialDeviceProvider from './device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import type Zc95SerialDeviceProvider from './device/protocol/zc95/zc95SerialDeviceProvider.js';
import type EStim2bSerialDeviceProvider from './device/protocol/estim2b/estim2bSerialDeviceProvider.js';
import type ButtplugIoWebsocketDeviceProvider from './device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import type AiroticDeviceProvider from './device/protocol/airotic/airoticDeviceProvider.js';
import type AiroticDeviceFactory from './device/protocol/airotic/airoticDeviceFactory.js';
import type KnownDeviceRegistry from './device/knownDeviceRegistry.js';

type ServiceMap = {
    /* serializerServiceProvider */
    'serializer.classToPlain': ClassToPlainSerializer;
    'serializer.plainToClass': PlainToClassSerializer;

    /* loggerServiceProvider */
    'logger.default': Logger;

    /* deviceServiceProvider */
    'device.manager': DeviceManager;
    'device.serial.transport.factory': SerialDeviceTransportFactory;
    'device.provider.factory.virtual': VirtualDeviceProviderFactory;
    'device.serial.factory.slvCtrlPlus': SlvCtrlPlusDeviceFactory;
    'device.factory.zc95': Zc95DeviceFactory;
    'device.factory.estim2b': Estim2bDeviceFactory;
    'device.factory.airotic': AiroticDeviceFactory;
    'device.provider.factory.slvCtrlPlusSerial': DeviceProviderFactory<SlvCtrlPlusSerialDeviceProvider>;
    'device.provider.factory.zc95Serial': DeviceProviderFactory<Zc95SerialDeviceProvider>;
    'device.provider.factory.estim2bSerial': DeviceProviderFactory<EStim2bSerialDeviceProvider>;
    'device.provider.factory.buttplugIoWebsocket': DeviceProviderFactory<ButtplugIoWebsocketDeviceProvider>;
    'device.provider.factory.airotic': DeviceProviderFactory<AiroticDeviceProvider>;
    'device.serial.factory.buttplugIo': ButtplugIoDeviceFactory;
    'device.virtual.provider': VirtualDeviceProvider;
    'device.virtual.factory': VirtualDeviceFactory;
    'device.uniqueNameGenerator': DeviceNameGenerator;
    'device.knownDeviceRegistry': KnownDeviceRegistry;
    'device.updater': DeviceUpdaterInterface;
    'device.observer.serial': SerialPortObserver;
    'device.observer.ble': BleObserver;

    /* factoryServiceProvider */
    'factory.uuid': UuidFactory;
    'factory.date': DateFactory;
    'factory.serialPort': SerialPortFactory;
    'factory.eventEmitter': EventEmitterFactory;

    /* schemaValidationServiceProvider */
    'ajv': Ajv;
    'factory.validator.schema.json': JsonSchemaValidatorFactory;

    /* settingsServiceProvider */
    'settings': Settings;
    'settings.manager': SettingsManager;

    /* automationServiceProvider */
    'automation.scriptVmFactory': ScriptVmFactory;
    'automation.scriptRuntime': ScriptRuntime;

    /* repositoryServiceProvider */
    'repository.connectedDevices': ConnectedDeviceRepository;
    'repository.automationScript': AutomationScriptRepository;

    'device.provider.manager': DeviceProviderManager;
    'socket.deviceUpdateHandler': DeviceUpdateHandler;

    /* controllerServiceProvider */
    'controller.health': HealthController;
    'controller.getDevices': GetDevicesController;
    'controller.getDevice': GetDeviceController;
    'controller.patchDevice': PatchDeviceController;
    'controller.automation.getScripts': GetScriptsController;
    'controller.automation.getScript': GetScriptController;
    'controller.automation.createScript': CreateScriptController;
    'controller.automation.deleteScript': DeleteScriptController;
    'controller.automation.getLog': GetLogController;
    'controller.automation.runScript': RunScriptController;
    'controller.automation.stopScript': StopScriptController;
    'controller.automation.statusScript': StatusScriptController;
    'controller.settings.get': GetSettingsController;
    'controller.settings.put': PutSettingsController;
    'controller.version': VersionController;

    /* healthServiceProvider */
    'health.metricsCollector': HealthMetricsCollector;
};

export default ServiceMap;
