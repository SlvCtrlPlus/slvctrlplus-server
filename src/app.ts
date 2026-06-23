import cors, { CorsOptions } from 'cors';
import contentTypeMiddleware from './middleware/contentTypeMiddleware.js';
import express from 'express';
import { Container, Pimple } from '@timesplinter/pimple';
import ControllerServiceProvider from './serviceProvider/controllerServiceProvider.js';
import RepositoryServiceProvider from './serviceProvider/repositoryServiceProvider.js';
import SerializationServiceProvider from './serviceProvider/serializationServiceProvider.js';
import FactoryServiceProvider from './serviceProvider/factoryServiceProvider.js';
import DeviceServiceProvider from './serviceProvider/deviceServiceProvider.js';
import SettingsServiceProvider from './serviceProvider/settingsServiceProvider.js';
import SchemaValidationServiceProvider from './serviceProvider/schemaValidationServiceProvider.js';
import SocketServiceProvider from './serviceProvider/socketServiceProvider.js';
import { ClientToServerEvents, ServerToClientEvents, WebsocketServer } from './socket/types.js';
import AutomationServiceProvider from './serviceProvider/automationServiceProvider.js';
import Device from './device/device.js';
import WebSocketEvent from './device/webSocketEvent.js';
import AutomationEventType from './automation/automationEventType.js';
import LoggerServiceProvider from './serviceProvider/loggerServiceProvider.js';
import DeviceDiscriminator from './serialization/discriminator/deviceDiscriminator.js';
import ServiceMap from './serviceMap.js';
import SettingsEventType from './settings/settingsEventType.js';
import type Settings from './settings/settings.js';
import { executeController } from './util/expressUtils.js';
import { DeviceManagerEvent } from './device/deviceManager.js';
import HealthServiceProvider from './serviceProvider/healthServiceProvider.js';
import { setIntervalAsync } from './util/async.js';
import { logError } from './util/error.js';
import http from 'http'
import https from 'https'
import fs from 'fs'
import BaseError from 'modern-errors';
import { Server } from 'socket.io';

export type SslConfig = { port: number, keyFile: string, certFile: string };

export interface AppOptions {
    allowedOrigins: string[];
    dataPath: string;
}

export interface ServeResult {
    httpServer: http.Server;
    httpsServer?: https.Server;
}

export interface AppInstance {
    instance: express.Application;
    websocket: WebsocketServer;
    serve: (httpPort: number, sslConfig?: SslConfig) => ServeResult;
}

const configureRoutes = (app: express.Application, container: Container<ServiceMap>): void => {
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
}

const configureWebsocket = (io: WebsocketServer, container: Container<ServiceMap>): void => {
    const deviceManager = container.get('device.manager');
    const scriptRuntime = container.get('automation.scriptRuntime');
    const settingsManager = container.get('settings.manager');
    const serializer = container.get('serializer.classToPlain');
    const logger = container.get('logger.default');
    const healthMetricsCollector = container.get('health.metricsCollector');

    const deviceDiscriminator = DeviceDiscriminator.createClassTransformerTypeDiscriminator('type');

    // Health metrics: start background refresh, then broadcast cached value on each tick
    healthMetricsCollector.start(1000);

    setIntervalAsync(async () => {
        const metrics = healthMetricsCollector.collect();
        if (metrics !== null) {
            io.emit(WebSocketEvent.healthMetrics, metrics);
        }
    }, {
        intervalMs: 500,
        timeoutMs: 1_000,
        onError: (err) => logError(logger, 'Health metrics broadcast failed', err),
    });

    // Whenever someone connects this gets executed
    io.on('connection', socket => {
        logger.debug(`Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.debug(`Client disconnected: ${socket.id}`);
        });

        const deviceUpdateHandler = container.get('socket.deviceUpdateHandler');

        socket.on(WebSocketEvent.deviceUpdateReceived, (data) => deviceUpdateHandler.handle(data));
    });

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
    scriptRuntime.on(AutomationEventType.consoleLog, (data: string) => io.emit(AutomationEventType.consoleLog, data));
};

const loadDeviceProviders = (container: Container<ServiceMap>): void => {
    const serialPortObserver = container.get('device.observer.serial');
    const logger = container.get('logger.default');
    const settings = container.get('settings');
    const deviceProviderManager = container.get('device.provider.loader');

    deviceProviderManager.loadFromSettings(settings);

    deviceProviderManager
        .startProviders()
        .catch(e => logError(logger, `Loading device providers failed`, e));

    serialPortObserver.start().catch(e => logError(logger, `Initializing serial port observer failed`, e));
};

const buildCorsOptions = (allowedOrigins: string[]): CorsOptions => ({
    origin: (origin, callback): void => {
        if (undefined === origin || allowedOrigins.length === 0) {
            return callback(null, true);
        }
        return callback(null, allowedOrigins.includes(origin));
    },
});

export const createContainer = (dataPath: string): Pimple<ServiceMap> => (new Pimple<ServiceMap>())
    .register(new LoggerServiceProvider())
    .register(new HealthServiceProvider())
    .register(new SettingsServiceProvider(dataPath))
    .register(new DeviceServiceProvider())
    .register(new ControllerServiceProvider())
    .register(new SocketServiceProvider())
    .register(new RepositoryServiceProvider(dataPath))
    .register(new SerializationServiceProvider())
    .register(new AutomationServiceProvider(dataPath))
    .register(new FactoryServiceProvider())
    .register(new SchemaValidationServiceProvider())
;

const getPortFromServer = (server: http.Server): number => {
    const address = server.address();
    if (address === null || address === undefined || typeof address !== 'object') {
        throw new Error('Could not obtain server address');
    }

    return address.port;
}

export const createApp = (container: Container<ServiceMap>, options: AppOptions): AppInstance => {
    const corsOptions = buildCorsOptions(options.allowedOrigins);
    const websocketServer: WebsocketServer = new Server<ClientToServerEvents, ServerToClientEvents>(undefined, {
        cors: corsOptions,
    });
    const app = express();

    app
        .use((req, res, next) => {
            // Required for PNA preflight until https://github.com/expressjs/cors/pull/274 is merged
            if (req.headers['access-control-request-private-network'] === 'true') {
                res.header('Access-Control-Allow-Private-Network', 'true');
            }

            next();
        })
        .use(cors(corsOptions))
        .use(contentTypeMiddleware)
        .use(express.json())
        .use(express.text())
    ;

    configureRoutes(app, container);
    configureWebsocket(websocketServer, container);
    loadDeviceProviders(container);

    return {
        instance: app,
        websocket: websocketServer,
        serve: (httpPort: number, sslConfig?: SslConfig): ServeResult => {

            const logger = container.get('logger.default');
            const httpServer = http.createServer(app);

            websocketServer.attach(httpServer);

            const serveResult: ServeResult = { httpServer };

            httpServer.listen(httpPort, () => {
                logger.info(`SlvCtrl+ server listening on http://localhost:${getPortFromServer(httpServer)}`);
            });

            if (sslConfig === undefined) {
                return serveResult;
            }

            try {
                const key = fs.readFileSync(sslConfig.keyFile);
                const cert = fs.readFileSync(sslConfig.certFile);
                const httpsServer = https.createServer({ key, cert }, app);

                websocketServer.attach(httpsServer);

                serveResult.httpsServer = httpsServer;

                httpsServer.listen(sslConfig.port, () => {
                    logger.info(`SlvCtrl+ server listening on https://localhost:${getPortFromServer(httpsServer)} (ssl)`);
                });
            } catch (err) {
                const baseError = BaseError.normalize(err);
                logger.error(`Failed to load SSL certificates: ${baseError.message}`);
                logger.warn('HTTPS server will not be started');
            }

            return serveResult;
        }
    };
}
