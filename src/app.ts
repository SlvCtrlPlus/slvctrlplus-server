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
import { SerializedDevice } from './device/serializedTypes.js';
import { SerializedSettings } from './settings/serializedTypes.js';
import AutomationServiceProvider from './serviceProvider/automationServiceProvider.js';
import { AnyDevice } from './device/device.js';
import WebSocketEvent from './device/webSocketEvent.js';
import AutomationEventType from './automation/automationEventType.js';
import LoggerServiceProvider from './serviceProvider/loggerServiceProvider.js';
import deviceDiscriminator from './serialization/discriminator/deviceDiscriminator.js';
import ServiceMap from './serviceMap.js';
import SettingsEventType from './settings/settingsEventType.js';
import type Settings from './settings/settings.js';
import { executeController } from './util/expressUtils.js';
import { DeviceManagerEvent } from './device/deviceManager.js';
import HealthServiceProvider from './serviceProvider/healthServiceProvider.js';
import { logError } from './util/error.js';
import { HealthMetricsCollectorEvent } from './health/healthMetricsCollector.js';
import { SerializedHealthMetrics } from './health/serializedTypes.js';
import http from 'http';
import https from 'https';
import fs from 'fs';
import BaseError from 'modern-errors';
import { Server } from 'socket.io';

export type SslConfig = {
    port: number;
    keyFile: string;
    certFile: string;
};

export type AppOptions = {
    allowedOrigins: string[];
    dataPath: string;
};

export type ServeResult = {
    httpServer: http.Server;
    httpsServer?: https.Server;
};

export type AppInstance = {
    websocket: WebsocketServer;
    serve: (httpPort: number, sslConfig?: SslConfig) => ServeResult;
    shutdown: () => Promise<void>;
};

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
};

const configureWebsocket = (io: WebsocketServer, container: Container<ServiceMap>): void => {
    const deviceManager = container.get('device.manager');
    const scriptRuntime = container.get('automation.scriptRuntime');
    const settingsManager = container.get('settings.manager');
    const serializer = container.get('serializer.classToPlain');
    const logger = container.get('logger.default');
    const healthMetricsCollector = container.get('health.metricsCollector');

    const deviceDiscriminatorInstance = deviceDiscriminator.createClassTransformerTypeDiscriminator('type');

    // Health metrics: start background refresh, broadcast over WebSocket on each collection
    healthMetricsCollector.start(1000);
    healthMetricsCollector.on(HealthMetricsCollectorEvent.collected, (metrics: SerializedHealthMetrics) => {
        io.emit(WebSocketEvent.healthMetrics, metrics);
    });

    // Whenever someone connects this gets executed
    io.on('connection', socket => {
        logger.debug(`Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.debug(`Client disconnected: ${socket.id}`);
        });

        const deviceUpdateHandler = container.get('socket.deviceUpdateHandler');

        socket.on(WebSocketEvent.deviceUpdateReceived, data => deviceUpdateHandler.handle(data));
    });

    deviceManager.on(DeviceManagerEvent.deviceConnected, (device: AnyDevice) => {
        io.emit(WebSocketEvent.deviceConnected, serializer.transform<SerializedDevice>(device, deviceDiscriminatorInstance));
        void scriptRuntime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device, args: [] });
    });

    deviceManager.on(DeviceManagerEvent.deviceDisconnected, (device: AnyDevice) => {
        io.emit(WebSocketEvent.deviceDisconnected, serializer.transform<SerializedDevice>(device, deviceDiscriminatorInstance));
        void scriptRuntime.runForEvent({ type: DeviceManagerEvent.deviceDisconnected, device, args: [] });
    });

    deviceManager.on(DeviceManagerEvent.deviceRefreshed, (device: AnyDevice) => {
        io.emit(WebSocketEvent.deviceRefreshed, serializer.transform<SerializedDevice>(device, deviceDiscriminatorInstance));
        void scriptRuntime.runForEvent({ type: DeviceManagerEvent.deviceRefreshed, device, args: [] });
    });

    deviceManager.on(DeviceManagerEvent.deviceNotification, (device: AnyDevice, notification) => {
        io.emit(WebSocketEvent.deviceNotification, serializer.transform<SerializedDevice>(device, deviceDiscriminatorInstance), notification);
        void scriptRuntime.runForEvent({ type: DeviceManagerEvent.deviceNotification, device, args: [notification] });
    });

    settingsManager.on(SettingsEventType.changed, (settings: Settings) => {
        io.emit(SettingsEventType.changed, serializer.transform<SerializedSettings>(settings));
    });

    // Automation events
    scriptRuntime.on(AutomationEventType.consoleLog, (data: string) => io.emit(AutomationEventType.consoleLog, data));
};

const startDeviceProviders = (container: Container<ServiceMap>): void => {
    const logger = container.get('logger.default');
    const settingsManager = container.get('settings.manager');
    const settings = container.get('settings');
    const deviceProviderManager = container.get('device.provider.manager');
    const deviceManager = container.get('device.manager');

    deviceProviderManager
        .loadFromSettings(settings)
        .catch(e => logError(logger, `Loading device providers failed`, e));

    settingsManager.on(SettingsEventType.changed, (changedSettings: Settings) => {
        // Reload device sources first so re-enabled devices are only re-announced once their provider runs again
        deviceProviderManager
            .loadFromSettings(changedSettings)
            .catch(e => logError(logger, 'Failed to reload device sources after settings change', e))
            .then(() => deviceManager.onSettingsChanged())
            .catch(e => logError(logger, 'Failed to apply device enabled/disabled changes', e));
    });
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
};

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

    const settingsManager = container.get('settings.manager');
    settingsManager.load();
    settingsManager.startWatching();

    configureRoutes(app, container);
    configureWebsocket(websocketServer, container);
    startDeviceProviders(container);

    let serveResult: ServeResult | undefined;
    let canBeShutDown = false;

    return {
        websocket: websocketServer,
        serve: (httpPort: number, sslConfig?: SslConfig): ServeResult => {
            const logger = container.get('logger.default');
            const httpServer = http.createServer(app);

            websocketServer.attach(httpServer);

            serveResult = { httpServer, httpsServer: undefined };

            httpServer.listen(httpPort, () => {
                logger.info(`SlvCtrl+ server listening on http://localhost:${getPortFromServer(httpServer)}`);
            });

            if (sslConfig !== undefined) {
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
            }

            canBeShutDown = true;

            return serveResult;
        },
        shutdown: async (): Promise<void> => {
            if (!canBeShutDown) {
                return;
            }

            canBeShutDown = false;

            const logger = container.get('logger.default');
            logger.info('Shutting down...');

            try {
                await container.get('settings.manager').stopWatching();
            } catch (e: unknown) {
                logError(logger, 'Failed to stop settings file watcher during shutdown', e);
            }

            try {
                await container.get('automation.scriptRuntime').stop();
            } catch (e: unknown) {
                logError(logger, 'Failed to stop automation script runtime during shutdown', e);
            }

            try {
                await container.get('device.provider.manager').stopProviders();
            } catch (e: unknown) {
                logError(logger, 'Failed to stop device providers during shutdown', e);
            }

            container.get('health.metricsCollector').stop();

            await websocketServer.close();

            if (serveResult) {
                serveResult.httpServer.closeAllConnections();
                serveResult.httpServer.close();
                if (serveResult.httpsServer) {
                    serveResult.httpsServer.closeAllConnections();
                    serveResult.httpsServer.close();
                }
            }
        },
    };
};
