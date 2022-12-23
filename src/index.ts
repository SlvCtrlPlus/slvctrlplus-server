import 'dotenv/config';
import 'reflect-metadata';
import cors from 'cors';
import contentTypeMiddleware from './middleware/contentTypeMiddleware.js';
import express from 'express';
import { Pimple } from '@timesplinter/pimple';
import ControllerServiceProvider from './serviceProvider/controllerServiceProvider.js';
import RepositoryServiceProvider from './serviceProvider/repositoryServiceProvider.js';
import SerializationServiceProvider from './serviceProvider/serializationServiceProvider.js';
import FactoryServiceProvider from './serviceProvider/factoryServiceProvider.js';
import GetDevicesController from "./controller/getDevicesController.js";
import DeviceManager from "./device/deviceManager.js";
import DeviceServiceProvider from "./serviceProvider/deviceServiceProvider.js";
import GetDeviceController from "./controller/getDeviceController.js";
import PatchDeviceDataController from "./controller/patchDeviceController.js";
import SettingsServiceProvider from "./serviceProvider/settingsServiceProvider.js";
import {Server} from "socket.io";
import * as http from 'http'
import SocketServiceProvider from "./serviceProvider/socketServiceProvider.js";
import DeviceUpdateHandler from "./socket/deviceUpdateHandler.js";
import ClassToPlainSerializer from "./serialization/classToPlainSerializer.js";
import AutomationServiceProvider from "./serviceProvider/automationServiceProvider.js";
import RuleExecutor from "./automation/rule/RuleExecutor.js";
import DistanceDevice from "./device/distance/distanceDevice.js";
import AirValveDevice from "./device/airValve/airValveDevice.js";
import LoggerServiceProvider from "./serviceProvider/loggerServiceProvider.js"
import GetDeviceIosController from "./controller/getDeviceIosController.js";
import HealthController from "./controller/healthController.js";
import GetRulesController from "./controller/getRulesController.js";
import MappingRuleDefinition from "./entity/automation/rule/mappingRuleDefinition.js";
import IoDeviceMapInput from "./entity/automation/rule/ioDeviceMapInput.js";
import IoDeviceMapOutput from "./entity/automation/rule/ioDeviceMapOutput.js";
import MemoryRuleDefinitionRepository from "./repository/memoryRuleDefinitionRepository.js";
import IoReference from "./entity/automation/rule/ioReference.js";
import RangeValueMapper from "./entity/automation/rule/valueMapper/RangeValueMapper.js";
import DeviceDiscriminator from "./serialization/discriminator/deviceDiscriminator.js";
import {DeviceUpdateData} from "./socket/types";

const APP_PORT = process.env.PORT;

const container = new Pimple();
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH"]
    }
});

container
    .register(new LoggerServiceProvider())
    .register(new SettingsServiceProvider())
    .register(new DeviceServiceProvider())
    .register(new AutomationServiceProvider())
    .register(new ControllerServiceProvider())
    .register(new SocketServiceProvider())
    .register(new RepositoryServiceProvider())
    .register(new SerializationServiceProvider())
    .register(new FactoryServiceProvider())
;

const deviceManager = container.get('device.manager') as DeviceManager;
const ruleManager = container.get('automation.ruleManager') as RuleExecutor;
const ruleDefinitionRepository = container.get('repository.ruleDefinition') as MemoryRuleDefinitionRepository;

// TODO dummy rule
const myRule2 = new MappingRuleDefinition(
    'uuid-here',
    'My 1st rule',
    '94ab2b85-b873-477e-93ad-c0d1cf7bc857',
    new IoDeviceMapOutput(
        new IoReference('distance', 'distance'),
    ),
    new IoDeviceMapInput(
        'e341e483-d99f-45ae-bfae-33e6bf4b1694',
        new IoReference('airValve', 'flow'),
    ),
    new RangeValueMapper(
        DistanceDevice.getOutputs().distance.getLowerBound,
        DistanceDevice.getOutputs().distance.getUpperBound,
        AirValveDevice.getInputs().flow.getLowerBound,
        AirValveDevice.getInputs().flow.getUpperBound,
        true,
    )
);

ruleDefinitionRepository.add(myRule2);

/*const myRule = new MappingRule(
    'uuid-here',
    'My 1st rule',
    '94ab2b85-b873-477e-93ad-c0d1cf7bc857',
    [
        {
            from: DistanceDevice.getOutputs().distance,
            to: {
                device: () => deviceManager.getConnectedDevice('e341e483-d99f-45ae-bfae-33e6bf4b1694'),
                input: AirValveDevice.getInputs().flow,
                mapper: RangeValueMapper.fromDeviceIOs(
                    DistanceDevice.getOutputs().distance,
                    AirValveDevice.getInputs().flow,
                    true
                )
                /* mapper: new SegmentedValueMapper<number, number>([
                    {
                        start: 0,
                        end: 91,
                        segment: 100,
                    },
                    {
                        start: 92,
                        end: 183,
                        segment: 50,
                    },
                ])//
            }
        }
    ]
);*/
/*const myRule = new MappingRule(
    'uuid-here',
    'My 2nd rule',
    '94ab2b85-b873-477e-93ad-c0d1cf7bc857', // distance device
    [
        {
            from: DistanceDevice.getOutputs().distance,
            to: {
                device: () => deviceManager.getConnectedDevice('093de091-8817-4b12-adac-5eedefde78a7'), // et312 device
                input: Et312Device.getInputs().levelA,
                mapper: RangeValueMapper.fromDeviceIOs(
                    DistanceDevice.getOutputs().distance,
                    Et312Device.getInputs().levelA,
                    false
                )
            }
        }
    ]
);*/
ruleManager.addRuleFromDefinition(myRule2);

deviceManager.discoverSerialDevices().catch(console.log)
setInterval(() => { deviceManager.discoverSerialDevices().catch(console.log) }, 3000);

// TODO use this instead of the interval
/* usb.on('attach', (device: usb.Device) => {

    console.log(`===> added device: ${device.deviceAddress}`);
});*/

// Middlewares
app
    .use(cors())
    .use(contentTypeMiddleware)
    .use(express.json())
;

// Routes
app.get('/health', (req, res) => (container.get('controller.health') as HealthController).execute(req, res));

app.get('/devices', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDevicesController = container.get('controller.getDevices')
    return controller.execute(req, res)
});

app.patch('/device/:deviceId', (req, res) => {
    // eslint-disable-next-line
    const controller: PatchDeviceDataController = container.get('controller.patchDevice')
    return controller.execute(req, res)
});

app.get('/device/:deviceId', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDeviceController = container.get('controller.getDevice')
    return controller.execute(req, res)
});

app.get('/device/:deviceId/io', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDeviceIosController = container.get('controller.getDeviceIos')
    return controller.execute(req, res)
});

app.get('/rules', (req, res) => {
    // eslint-disable-next-line
    const controller: GetRulesController = container.get('controller.getRules')
    return controller.execute(req, res)
});

// Whenever someone connects this gets executed
io.on('connection', socket => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    const deviceUpdateHandler = container.get('socket.deviceUpdateHandler') as DeviceUpdateHandler;

    socket.on('deviceUpdate', (data) => deviceUpdateHandler.handle(data as DeviceUpdateData));
});

const serializer = container.get('serializer.classToPlain') as ClassToPlainSerializer;
const deviceDiscriminator = DeviceDiscriminator.createClassTransformerTypeDiscriminator('type');

deviceManager.on('deviceConnected', device =>
    io.emit('deviceConnected', serializer.transform(device, deviceDiscriminator))
);

deviceManager.on('deviceDisconnected', device =>
    io.emit('deviceDisconnected', serializer.transform(device, deviceDiscriminator))
);

deviceManager.on('deviceRefreshed', async device => {
    io.emit('deviceRefreshed', serializer.transform(device, deviceDiscriminator))
    ruleManager.applyRules(device);
});

httpServer.listen(APP_PORT, () => console.log(`SlvCtrl+ server listening on port ${APP_PORT}!`));

