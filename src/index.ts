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
import ObjectTypeOptions from "./serialization/objectTypeOptions.js";
import ClassToPlainSerializer from "./serialization/classToPlainSerializer.js";
import {DeviceUpdateData} from "./socket/types";
import HealthController from "./controller/healthController.js";
import GetScriptsController from "./controller/automation/getScriptsController.js";
import GetScriptController from "./controller/automation/getScriptController.js";
import CreateScriptController from "./controller/automation/createScriptController.js";
import AutomationServiceProvider from "./serviceProvider/automationServiceProvider.js";
import ScriptRuntime from "./automation/scriptRuntime.js";
import type Device from "./device/device.js";
import RunScriptController from "./controller/automation/runScriptController.js";
import StopScriptController from "./controller/automation/stopScriptController.js";
import DeviceEventType from "./device/deviceEventType.js";

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
    .register(new SettingsServiceProvider())
    .register(new DeviceServiceProvider())
    .register(new ControllerServiceProvider())
    .register(new SocketServiceProvider())
    .register(new RepositoryServiceProvider())
    .register(new SerializationServiceProvider())
    .register(new AutomationServiceProvider())
    .register(new FactoryServiceProvider())
;

const deviceManager = container.get('device.manager') as DeviceManager;
const scriptRuntime = container.get('automation.scriptRuntime') as ScriptRuntime;

setInterval(() => { deviceManager.discoverSerialDevices().catch(console.log) }, 3000);

// Middlewares
app
    .use(cors())
    .use(contentTypeMiddleware)
    .use(express.json())
    .use(express.text())
;

// Routes
app.get('/health', (req, res) => {
    const controller = container.get('controller.health') as HealthController
    return controller.execute(req, res)
});

app.get('/devices', (req, res) => {
    const controller  = container.get('controller.getDevices') as GetDevicesController
    return controller.execute(req, res)
});

app.get('/device/:deviceId', (req, res) => {
    const controller  = container.get('controller.getDevice') as GetDeviceController
    return controller.execute(req, res)
});

app.patch('/device/:deviceId', (req, res) => {
    const controller  = container.get('controller.patchDevice') as PatchDeviceDataController
    return controller.execute(req, res)
});

app.get('/automation/scripts', (req, res) => {
    const controller  = container.get('controller.automation.getScripts') as GetScriptsController
    return controller.execute(req, res)
});

app.get('/automation/scripts/:fileName', (req, res) => {
    const controller  = container.get('controller.automation.getScript') as GetScriptController
    return controller.execute(req, res)
});

app.post('/automation/scripts/:fileName', (req, res) => {
    const controller  = container.get('controller.automation.createScript') as CreateScriptController
    return controller.execute(req, res)
});

app.post('/automation/run', (req, res) => {
    const controller  = container.get('controller.automation.runScript') as RunScriptController
    return controller.execute(req, res)
});

app.get('/automation/stop', (req, res) => {
    const controller  = container.get('controller.automation.stopScript') as StopScriptController
    return controller.execute(req, res)
});

// Whenever someone connects this gets executed
io.on('connection', socket => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    const deviceUpdateHandler = container.get('socket.deviceUpdateHandler') as DeviceUpdateHandler;

    socket.on(DeviceEventType.deviceUpdateReceived, (data) => deviceUpdateHandler.handle(data as DeviceUpdateData));
});

const serializer = container.get('serializer.classToPlain') as ClassToPlainSerializer;

deviceManager.on(DeviceEventType.deviceConnected, (device: Device) => {
    io.emit(DeviceEventType.deviceConnected, serializer.transform(device, ObjectTypeOptions.device));
    scriptRuntime.runForEvent(DeviceEventType.deviceConnected, device);
});

deviceManager.on(DeviceEventType.deviceDisconnected, (device: Device) => {
    io.emit(DeviceEventType.deviceDisconnected, serializer.transform(device, ObjectTypeOptions.device));
    scriptRuntime.runForEvent(DeviceEventType.deviceDisconnected, device);
});

deviceManager.on(DeviceEventType.deviceRefreshed, (device: Device) => {
    io.emit(DeviceEventType.deviceRefreshed, serializer.transform(device, ObjectTypeOptions.device));
    scriptRuntime.runForEvent(DeviceEventType.deviceRefreshed, device);
});

httpServer.listen(APP_PORT, () =>
    console.log(`SlvCtrl+ server listening on port ${APP_PORT}!`),
);

process.on('uncaughtException', (err) => {
    console.error('Asynchronous error caught.', err);
});
