import 'dotenv/config';
import 'reflect-metadata';
import { createApp } from './app.js';
import { SslConfig } from './serviceProvider/serverServiceProvider.js';
import { parseEnv } from './env.js';

const env = parseEnv(process.env);

const allowedOrigins = undefined !== env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.length > 0
    ? env.ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    : [];

const sslConfig: SslConfig | undefined = env.SSL_KEY_FILE !== undefined && env.SSL_CERT_FILE !== undefined
    ? { keyFile: env.SSL_KEY_FILE, certFile: env.SSL_CERT_FILE }
    : undefined;

const app = createApp({
    allowedOrigins,
    sslConfig,
    dataPath: env.DATA_PATH,
});

const logger = app.container.get('logger.default');

process.on('uncaughtException', (error: Error) => {
    logger.error('Asynchronous error caught', error);
});

app.listen(env.PORT, env.HTTPS_PORT);
