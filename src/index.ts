import 'dotenv/config';
import 'reflect-metadata';
import cors from 'cors';
import contentTypeMiddleware from './middleware/contentTypeMiddleware.js';
import express from 'express';
import {Pimple} from '@timesplinter/pimple';
import ControllerServiceProvider from './serviceProvider/controllerServiceProvider.js';
import RepositoryServiceProvider from './serviceProvider/repositoryServiceProvider.js';
import SerializationServiceProvider from './serviceProvider/serializationServiceProvider.js';
import FactoryServiceProvider from './serviceProvider/factoryServiceProvider.js';
import DeviceServiceProvider from "./serviceProvider/deviceServiceProvider.js";
import SettingsServiceProvider from "./serviceProvider/settingsServiceProvider.js";
import SchemaValidationServiceProvider from "./serviceProvider/schemaValidationServiceProvider.js";
import http from 'http'
import SocketServiceProvider from "./serviceProvider/socketServiceProvider.js";
import {DeviceUpdateData} from "./socket/types";
import AutomationServiceProvider from "./serviceProvider/automationServiceProvider.js";
import type Device from "./device/device.js";
import WebSocketEvent from "./device/webSocketEvent.js";
import ServerServiceProvider from "./serviceProvider/serverServiceProvider.js";
import asyncHandler from "express-async-handler"
import AutomationEventType from "./automation/automationEventType.js";
import DeviceManagerEvent from "./device/deviceManagerEvent.js";
import LoggerServiceProvider from "./serviceProvider/loggerServiceProvider.js";
import DeviceDiscriminator from "./serialization/discriminator/deviceDiscriminator.js";
import ServiceMap from "./serviceMap.js";
import SettingsEventType from "./settings/settingsEventType.js";
import type Settings from "./settings/settings.js";

const APP_PORT = process.env.PORT ?? '1337';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.length !== 0
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    : [];

const container = new Pimple<ServiceMap>();
const app = express();
const httpServer = http.createServer(app);

container
    .register(new LoggerServiceProvider())
    .register(new ServerServiceProvider(httpServer))
    .register(new SettingsServiceProvider())
    .register(new DeviceServiceProvider())
    .register(new ControllerServiceProvider())
    .register(new SocketServiceProvider())
    .register(new RepositoryServiceProvider())
    .register(new SerializationServiceProvider())
    .register(new AutomationServiceProvider())
    .register(new FactoryServiceProvider())
    .register(new SchemaValidationServiceProvider())
;

const logger = container.get('logger.default');
const io = container.get('server.websocket');
const deviceManager = container.get('device.manager');
const settingsManager = container.get('settings.manager');
const scriptRuntime = container.get('automation.scriptRuntime');

container.get('device.provider.loader').loadFromSettings();

// Middlewares
app
    .use((req, res, next) => {
        // Required for PNA preflight until https://github.com/expressjs/cors/pull/274 is merged
        if (req.headers['access-control-request-private-network'] === 'true') {
            res.header('Access-Control-Allow-Private-Network', 'true');
        }

        next();
    })
    .use(cors({
        origin: (origin, callback) => {
            if (!origin || ALLOWED_ORIGINS.length === 0) {
                 return callback(null, true);
            }

            return callback(null, ALLOWED_ORIGINS.includes(origin));
        },
    }))
    .use(contentTypeMiddleware)
    .use(express.json())
    .use(express.text())
;

// Routes
app.get('/health', asyncHandler((req, res) => {
    const controller = container.get('controller.health')
    return controller.execute(req, res)
}));

app.get('/devices', (req, res) => {
    const controller = container.get('controller.getDevices')
    return controller.execute(req, res)
});

app.get('/device/:deviceId', (req, res) => {
    const controller = container.get('controller.getDevice')
    return controller.execute(req, res)
});

app.patch('/device/:deviceId', (req, res) => {
    const controller = container.get('controller.patchDevice')
    return controller.execute(req, res)
});

app.get('/automation/scripts', (req, res) => {
    const controller = container.get('controller.automation.getScripts')
    return controller.execute(req, res)
});

app.get('/automation/scripts/:fileName([a-z\\d._-]+.js)', (req, res) => {
    const controller = container.get('controller.automation.getScript')
    return controller.execute(req, res)
});

app.post('/automation/scripts/:fileName([a-z\\d._-]+.js)', (req, res) => {
    const controller = container.get('controller.automation.createScript')
    return controller.execute(req, res)
});

app.delete('/automation/scripts/:fileName([a-z\\d._-]+.js)', (req, res) => {
    const controller = container.get('controller.automation.deleteScript')
    return controller.execute(req, res)
});

app.get('/automation/log', asyncHandler((req, res) => {
    const controller = container.get('controller.automation.getLog')
    return controller.execute(req, res)
}));

app.post('/automation/run', (req, res) => {
    const controller = container.get('controller.automation.runScript')
    return controller.execute(req, res)
});

app.get('/automation/stop', (req, res) => {
    const controller  = container.get('controller.automation.stopScript')
    return controller.execute(req, res)
});

app.get('/automation/status', (req, res) => {
    const controller  = container.get('controller.automation.statusScript')
    return controller.execute(req, res)
});

app.get('/settings', (req, res) => {
    const controller  = container.get('controller.settings.get')
    return controller.execute(req, res)
});

app.put('/settings', (req, res) => {
    const controller  = container.get('controller.settings.put')
    return controller.execute(req, res)
});

app.get('/version', (req, res) => {
    return container.get('controller.version').execute(req, res);
});

// Whenever someone connects this gets executed
io.on('connection', socket => {
    logger.debug(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.debug(`Client disconnected: ${socket.id}`);
    });

    const deviceUpdateHandler = container.get('socket.deviceUpdateHandler');

    socket.on(WebSocketEvent.deviceUpdateReceived, (data) => deviceUpdateHandler.handle(data as DeviceUpdateData));
});

const serializer = container.get('serializer.classToPlain');

const deviceDiscriminator = DeviceDiscriminator.createClassTransformerTypeDiscriminator('type');

deviceManager.on(DeviceManagerEvent.deviceConnected, (device: Device) => {
    io.emit(WebSocketEvent.deviceConnected, serializer.transform(device, deviceDiscriminator));
    scriptRuntime.runForEvent(DeviceManagerEvent.deviceConnected, device);
});

deviceManager.on(DeviceManagerEvent.deviceDisconnected, (device: Device) => {
    io.emit(WebSocketEvent.deviceDisconnected, serializer.transform(device, deviceDiscriminator));
    scriptRuntime.runForEvent(DeviceManagerEvent.deviceDisconnected, device);
});

deviceManager.on(DeviceManagerEvent.deviceRefreshed, (device: Device) => {
    io.emit(WebSocketEvent.deviceRefreshed, serializer.transform(device, deviceDiscriminator));
    scriptRuntime.runForEvent(DeviceManagerEvent.deviceRefreshed, device);
});

settingsManager.on(SettingsEventType.changed, (settings: Settings) => {
    io.emit(SettingsEventType.changed, serializer.transform(settings));
});

// Automation events
scriptRuntime.on(AutomationEventType.consoleLog, (data: any) => io.emit(AutomationEventType.consoleLog, data));

httpServer.listen(APP_PORT, () => {
    logger.info(`Node version: ${process.version}`);
    logger.info(`SlvCtrl+ server listening on port ${APP_PORT}!`);
});

process.on('uncaughtException', (err: Error) => {
    logger.error('Asynchronous error caught.', err);
});
