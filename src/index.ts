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
    .register(new FactoryServiceProvider())
;

const deviceManager = container.get('device.manager') as DeviceManager;

setInterval(  () => { deviceManager.discoverSerialDevices().catch(console.log) }, 3000);

// Middlewares
app
    .use(cors())
    .use(contentTypeMiddleware)
    .use(express.json())
;

// Routes
app.get('/devices', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDevicesController = container.get('controller.getDevices')
    return controller.execute(req, res)
});

app.get('/device/:deviceId', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDeviceController = container.get('controller.getDevice')
    return controller.execute(req, res)
});

app.patch('/device/:deviceId', (req, res) => {
    // eslint-disable-next-line
    const controller: PatchDeviceDataController = container.get('controller.patchDevice')
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

deviceManager.on('deviceConnected', device =>
    io.emit('deviceConnected', serializer.transform(device, ObjectTypeOptions.device))
);

deviceManager.on('deviceDisconnected', device =>
    io.emit('deviceDisconnected', serializer.transform(device, ObjectTypeOptions.device))
);

deviceManager.on('deviceRefreshed', device =>
    io.emit('deviceRefreshed', serializer.transform(device, ObjectTypeOptions.device))
);

httpServer.listen(APP_PORT, () =>
    console.log(`SlvCtrl+ server listening on port ${APP_PORT}!`),
);
