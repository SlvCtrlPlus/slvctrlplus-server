import 'dotenv/config';
import 'reflect-metadata';
import { createApp } from './app.js';
import { SslConfig } from './serviceProvider/serverServiceProvider.js';
import { logError } from './util/error.js';
import { setIntervalAsync } from './util/async.js';
import WebSocketEvent from './device/webSocketEvent.js';

const APP_HTTP_PORT = process.env.PORT ?? '1337';
const APP_HTTPS_PORT = process.env.HTTPS_PORT ?? '1338';
const ALLOWED_ORIGINS = undefined !== process.env.ALLOWED_ORIGINS && null !== process.env.ALLOWED_ORIGINS.length
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    : [];

const SSL_KEY_FILE = process.env.SSL_KEY;
const SSL_CERT_FILE = process.env.SSL_CERT;

const sslConfig: SslConfig | undefined = SSL_KEY_FILE !== undefined && SSL_CERT_FILE !== undefined
    ? { keyFile: SSL_KEY_FILE, certFile: SSL_CERT_FILE }
    : undefined;

const { container, httpServer, httpsServer } = createApp({
    allowedOrigins: ALLOWED_ORIGINS,
    sslConfig,
});

const logger = container.get('logger.default');
const io = container.get('server.websocket');
const serialPortObserver = container.get('device.observer.serial');
const healthMetricsCollector = container.get('health.metricsCollector');

container.get('device.provider.loader')
    .loadFromSettings()
    .catch(e => logError(logger, `Loading device providers failed`, e));

void serialPortObserver.init();

// Health metrics broadcast
setIntervalAsync(async () => {
    io.emit(WebSocketEvent.healthMetrics, await healthMetricsCollector.collect());
}, {
    intervalMs: 500,
    timeoutMs: 2_000,
    onError: (err) => logError(logger, 'Health metrics broadcast failed', err),
});

httpServer.listen(APP_HTTP_PORT, () => {
    logger.info(`Node version: ${process.version}`);
    logger.info(`SlvCtrl+ server listening on http://localhost:${APP_HTTP_PORT}`);
});

if (httpsServer !== undefined) {
    httpsServer.listen(APP_HTTPS_PORT, () => {
        logger.info(`SlvCtrl+ server listening on https://localhost:${APP_HTTPS_PORT} (ssl)`);
    });
}

process.on('uncaughtException', (error: Error) => {
    logger.error('Asynchronous error caught', error);
});
