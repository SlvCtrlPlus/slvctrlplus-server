import cors, { CorsOptions } from 'cors';
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
import SocketServiceProvider from './serviceProvider/socketServiceProvider.js';
import { DeviceUpdateData } from './socket/types.js';
import AutomationServiceProvider from './serviceProvider/automationServiceProvider.js';
import Device from './device/device.js';
import WebSocketEvent from './device/webSocketEvent.js';
import ServerServiceProvider, { SslConfig } from './serviceProvider/serverServiceProvider.js';
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

export type { SslConfig };

export interface AppOptions {
    allowedOrigins?: string[];
    sslConfig?: SslConfig;
    settingsFilePath?: string;
}

export interface AppInstance {
    expressApp: express.Application;
    container: Pimple<ServiceMap>;
    listen: (httpPort: number, httpsPort?: number) => void;
}

const configureRoutes = (app: express.Application, container: Pimple<ServiceMap>): void => {
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

const configureWebsocket = (container: Pimple<ServiceMap>): void => {
    const deviceManager = container.get('device.manager');
    const scriptRuntime = container.get('automation.scriptRuntime');
    const settingsManager = container.get('settings.manager');
    const serializer = container.get('serializer.classToPlain');
    const logger = container.get('logger.default');
    const io = container.get('server.websocket');
    const healthMetricsCollector = container.get('health.metricsCollector');

    const deviceDiscriminator = DeviceDiscriminator.createClassTransformerTypeDiscriminator('type');

    // Health metrics broadcast
    setIntervalAsync(async () => {
        io.emit(WebSocketEvent.healthMetrics, await healthMetricsCollector.collect());
    }, {
        intervalMs: 500,
        timeoutMs: 2_000,
        onError: (err) => logError(logger, 'Health metrics broadcast failed', err),
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
    scriptRuntime.on(AutomationEventType.consoleLog, (data: unknown) => io.emit(AutomationEventType.consoleLog, data));
};

const loadDeviceProviders = (container: Pimple<ServiceMap>): void => {
    const serialPortObserver = container.get('device.observer.serial');
    const logger = container.get('logger.default');

    container.get('device.provider.loader')
        .loadFromSettings()
        .catch(e => logError(logger, `Loading device providers failed`, e));

    serialPortObserver.init().catch(e => logError(logger, `Initializing serial port observer failed`, e));
};

export const createApp = (options: AppOptions = {}): AppInstance => {
    const { allowedOrigins = [], sslConfig, settingsFilePath } = options;

    const corsOptions: CorsOptions = {
        origin: (origin, callback) => {
            if (undefined === origin || allowedOrigins.length === 0) {
                return callback(null, true);
            }

            return callback(null, allowedOrigins.includes(origin));
        },
    };

    const app = express();
    const container = new Pimple<ServiceMap>();

    container
        .register(new LoggerServiceProvider())
        .register(new HealthServiceProvider())
        .register(new ServerServiceProvider(app, corsOptions, sslConfig))
        .register(new SettingsServiceProvider(settingsFilePath))
        .register(new DeviceServiceProvider())
        .register(new ControllerServiceProvider())
        .register(new SocketServiceProvider())
        .register(new RepositoryServiceProvider())
        .register(new SerializationServiceProvider())
        .register(new AutomationServiceProvider())
        .register(new FactoryServiceProvider())
        .register(new SchemaValidationServiceProvider())
    ;

    // Middlewares
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

    // Routes
    configureRoutes(app, container);
    configureWebsocket(container);
    loadDeviceProviders(container);

    return {
        expressApp: app,
        container,
        listen: (httpPort: number, httpsPort?: number): void => {
            const logger = container.get('logger.default');
            const httpServer = container.get('server.http');
            const httpsServer = container.get('server.https');

            httpServer.listen(httpPort, () => {
                logger.info(`Node version: ${process.version}`);
                logger.info(`SlvCtrl+ server listening on http://localhost:${httpPort}`);
            });

            if (httpsServer !== undefined && httpsPort !== undefined) {
                httpsServer.listen(httpsPort, () => {
                    logger.info(`SlvCtrl+ server listening on https://localhost:${httpsPort} (ssl)`);
                });
            }
        }
    };
}