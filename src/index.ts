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
import DeviceServiceProvider from './serviceProvider/deviceServiceProvider.js';
import SettingsServiceProvider from './serviceProvider/settingsServiceProvider.js';
import SchemaValidationServiceProvider from './serviceProvider/schemaValidationServiceProvider.js';
import http from 'http'
import https from 'https'
import fs from 'fs'
import SocketServiceProvider from './serviceProvider/socketServiceProvider.js';
import { DeviceUpdateData } from './socket/types.js';
import AutomationServiceProvider from './serviceProvider/automationServiceProvider.js';
import Device from './device/device.js';
import WebSocketEvent from './device/webSocketEvent.js';
import ServerServiceProvider from './serviceProvider/serverServiceProvider.js';
import AutomationEventType from './automation/automationEventType.js';
import LoggerServiceProvider from './serviceProvider/loggerServiceProvider.js';
import DeviceDiscriminator from './serialization/discriminator/deviceDiscriminator.js';
import ServiceMap from './serviceMap.js';
import SettingsEventType from './settings/settingsEventType.js';
import type Settings from './settings/settings.js';
import { executeController } from './util/expressUtils.js';
import { DeviceManagerEvent } from './device/deviceManager.js';
import { logError } from './util/error.js';
import { setIntervalAsync } from './util/async.js';
import HealthServiceProvider from './serviceProvider/healthServiceProvider.js';

const APP_HTTP_PORT = process.env.PORT ?? '1337';
const APP_HTTPS_PORT = process.env.HTTPS_PORT ?? '1338';
const ALLOWED_ORIGINS = undefined !== process.env.ALLOWED_ORIGINS && null !== process.env.ALLOWED_ORIGINS.length
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    : [];

const SSL_KEY_FILE = process.env.SSL_KEY;
const SSL_CERT_FILE = process.env.SSL_CERT;

const container = new Pimple<ServiceMap>();
const app = express();
const httpServer = http.createServer(app);
const httpsServer = SSL_KEY_FILE !== undefined && SSL_CERT_FILE !== undefined
    ? https.createServer({ key: fs.readFileSync(SSL_KEY_FILE), cert: fs.readFileSync(SSL_CERT_FILE) }, app)
    : undefined;

container
    .register(new LoggerServiceProvider())
    .register(new HealthServiceProvider())
    .register(new ServerServiceProvider(httpServer, httpsServer))
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
const serialPortObserver = container.get('device.observer.serial');
const settingsManager = container.get('settings.manager');
const scriptRuntime = container.get('automation.scriptRuntime');

container.get('device.provider.loader')
    .loadFromSettings()
    .catch(e => logError(logger, `Loading device providers failed`, e));

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
            if (undefined === origin || ALLOWED_ORIGINS.length === 0) {
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
app.get('/devices', executeController(container, 'controller.getDevices'));
app.get('/device/:deviceId', executeController(container, 'controller.getDevice'));
app.patch('/device/:deviceId', executeController(container, 'controller.patchDevice'));

app.get('/automation/scripts', executeController(container, 'controller.automation.getScripts'));
app.get('/automation/scripts/:fileName', executeController(container, 'controller.automation.getScript'));

app.post('/automation/scripts/:fileName', executeController(container, 'controller.automation.createScript'));
app.delete('/automation/scripts/:fileName', executeController(container, 'controller.automation.deleteScript'));

app.get('/automation/log', executeController(container, 'controller.automation.getLog'));
app.post('/automation/run', executeController(container, 'controller.automation.runScript'));
app.get('/automation/stop', executeController(container, 'controller.automation.stopScript'));
app.get('/automation/status', executeController(container, 'controller.automation.statusScript'));

app.get('/settings', executeController(container, 'controller.settings.get'));
app.put('/settings', executeController(container, 'controller.settings.put'));

app.get('/health', executeController(container, 'controller.health'));
app.get('/version', executeController(container, 'controller.version'));

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

void serialPortObserver.init();

deviceManager.on(DeviceManagerEvent.deviceConnected, (device: Device) => {
    io.emit(WebSocketEvent.deviceConnected, serializer.transform(device, deviceDiscriminator));
    void scriptRuntime.runForEvent(DeviceManagerEvent.deviceConnected, device);
});

deviceManager.on(DeviceManagerEvent.deviceDisconnected, (device: Device) => {
    io.emit(WebSocketEvent.deviceDisconnected, serializer.transform(device, deviceDiscriminator));
    void scriptRuntime.runForEvent(DeviceManagerEvent.deviceDisconnected, device);
});

deviceManager.on(DeviceManagerEvent.deviceRefreshed, (device: Device) => {
    io.emit(WebSocketEvent.deviceRefreshed, serializer.transform(device, deviceDiscriminator));
    void scriptRuntime.runForEvent(DeviceManagerEvent.deviceRefreshed, device);
});

settingsManager.on(SettingsEventType.changed, (settings: Settings) => {
    io.emit(SettingsEventType.changed, serializer.transform(settings));
});

// Automation events
scriptRuntime.on(AutomationEventType.consoleLog, (data: any) => io.emit(AutomationEventType.consoleLog, data));

// Health metrics broadcast
const healthMetricsCollector = container.get('health.metricsCollector');
setIntervalAsync(async () => {
    io.emit(WebSocketEvent.healthMetrics, await healthMetricsCollector.collect());
}, {
    intervalMs: 500,
    timeoutMs: 2_000,
    onError: (err) => logError(logger, 'Health metrics broadcast failed', err),
});

httpServer.listen(APP_HTTP_PORT, () => {
    logger.info(`Node version: ${process.version}`);
    logger.info(`SlvCtrl+ server listening on http://localhost:${APP_HTTP_PORT} (http)`);
});

if (httpsServer !== undefined) {
    httpsServer.listen(APP_HTTPS_PORT, () => {
        logger.info(`SlvCtrl+ server listening on https://localhost:${APP_HTTPS_PORT} (https)`);
    });
}

process.on('uncaughtException', (error: Error) => {
    logger.error('Asynchronous error caught', error);
});
