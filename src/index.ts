import 'dotenv/config';
import 'reflect-metadata';
import { createApp, createContainer, SslConfig } from './app.js';
import { parseEnv } from './env.js';
import { logError } from './util/error.js';

const env = parseEnv(process.env);

const allowedOrigins = undefined !== env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.length > 0
    ? env.ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    : [];

const sslConfig: SslConfig | undefined = env.SSL_KEY_FILE !== undefined && env.SSL_CERT_FILE !== undefined
    ? { port: env.HTTPS_PORT, keyFile: env.SSL_KEY_FILE, certFile: env.SSL_CERT_FILE }
    : undefined;

const appOptions = { allowedOrigins, dataPath: env.DATA_PATH };
const container = createContainer(env.DATA_PATH);
const app = createApp(container, appOptions);

const logger = container.get('logger.default');

process.on('uncaughtException', (error: Error) => {
    logger.error('Asynchronous error caught', error);
});

app.serve(env.PORT, sslConfig);

const shutdown = (): void => {
    app.shutdown()
        .catch((err: unknown) => logError(logger, 'Error during shutdown', err))
        .finally(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
