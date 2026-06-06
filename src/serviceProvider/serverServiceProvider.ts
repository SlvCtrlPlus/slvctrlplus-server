import BaseError from 'modern-errors';
import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import http from 'http'
import https from 'https'
import fs from 'fs'
import { Server } from 'socket.io';
import ServiceMap from '../serviceMap.js';
import { CorsOptions } from 'cors';
import express from 'express';

export type SslConfig = { keyFile: string, certFile: string };

export default class ServerServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly app: express.Application;
    private readonly corsOptions: CorsOptions;
    private readonly sslConfig?: SslConfig;

    public constructor(app: express.Application, corsOptions: CorsOptions, sslConfig?: SslConfig) {
        this.app = app;
        this.corsOptions = corsOptions;
        this.sslConfig = sslConfig;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('server.websocket', () => new Server(undefined, {
            cors: this.corsOptions
        }));

        container.set('server.http', () => {
            const server = http.createServer(this.app);

            container.get('server.websocket').attach(server);

            return server;
        });

        container.set('server.https', () => {
            if (this.sslConfig === undefined) {
                return undefined;
            }

            const logger = container.get('logger.default');

            try {
                const key = fs.readFileSync(this.sslConfig.keyFile);
                const cert = fs.readFileSync(this.sslConfig.certFile);
                const server = https.createServer({ key, cert }, this.app);

                container.get('server.websocket').attach(server);

                return server;
            } catch (err) {
                const baseError = BaseError.normalize(err);
                logger.error(`Failed to load SSL certificates: ${baseError.message}`);
                logger.warn('HTTPS server will not be started');
                return undefined;
            }
        });
    }
}
