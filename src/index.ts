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
import CreateCarController from "./controller/createCarController.js";
import DeviceManager from "./device/deviceManager.js";
import DeviceServiceProvider from "./serviceProvider/deviceServiceProvider.js";
import GetDeviceController from "./controller/getDeviceController.js";
import PatchDeviceDataController from "./controller/patchDeviceController.js";
import SettingsServiceProvider from "./serviceProvider/settingsServiceProvider.js";

const APP_PORT = process.env.PORT;

const container = new Pimple();
const app = express();

container
    .register(new SettingsServiceProvider())
    .register(new DeviceServiceProvider())
    .register(new ControllerServiceProvider())
    .register(new RepositoryServiceProvider())
    .register(new SerializationServiceProvider())
    .register(new FactoryServiceProvider())
;

const deviceManager = container.get('device.manager') as DeviceManager;

setInterval(  () => { deviceManager.discover().catch(console.log) }, 3000);

// Middlewares
app
    .use(cors())
    .use(contentTypeMiddleware)
    .use(express.json())
;

// Routes
app.get('/car', (req, res) => {
    // eslint-disable-next-line
    const controller: GetDevicesController = container.get('controller.getCars');
    return controller.execute(req, res);
});
app.post('/car', (req, res) => {
    // eslint-disable-next-line
    const controller: CreateCarController = container.get('controller.createCar')
    return controller.execute(req, res)
});

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

app.listen(APP_PORT, () =>
    console.log(`SlvCtrl+ server listening on port ${APP_PORT}!`),
);
