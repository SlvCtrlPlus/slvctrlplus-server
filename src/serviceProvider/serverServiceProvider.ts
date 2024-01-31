import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import * as http from 'http'
import {Server} from "socket.io";
import {ServiceMap} from "../types.js";

export default class ServerServiceProvider implements ServiceProvider<ServiceMap>
{
    private readonly httpServer: http.Server;

    public constructor(server: http.Server) {
        this.httpServer = server;
    }

    public register(container: Pimple<ServiceMap>): void {
        container.set('server.websocket', () => {
            return new Server(this.httpServer, {
                cors: {
                    origin: "*",
                    methods: ["GET", "POST", "PATCH"]
                }
            });
        });
    }
}
