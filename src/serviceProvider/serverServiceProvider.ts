import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import http from 'http'
import { Server } from 'socket.io';
import ServiceMap from '../serviceMap.js';

export default class ServerServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly httpServer: http.Server;
    private readonly httpsServer?: http.Server;

    public constructor(server: http.Server, httpsServer?: http.Server) {
        this.httpServer = server;
        this.httpsServer = httpsServer;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('server.websocket', () => {
            const socketIoServer = new Server(undefined, {
                cors: {
                    origin: '*',
                    methods: ['GET', 'POST', 'PATCH']
                }
            });

            socketIoServer.attach(this.httpServer);

            if (this.httpsServer) {
                socketIoServer.attach(this.httpsServer);
            }

            return socketIoServer;
        });
    }
}
