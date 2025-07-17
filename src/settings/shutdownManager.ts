import EventEmitter from "events";
import Logger from "../logging/Logger";
import ShutdownEventType from "./shutdownEventType.js";

type ShutdownHook = () => Promise<void>;

type ShutdownEvents = {
    [ShutdownEventType.beforeShutdown]: ShutdownHook,
}

export default class ShutdownManager {

    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    public constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    public async runBeforeShutdown(): Promise<void> {
        const listeners = this.eventEmitter.listeners(ShutdownEventType.beforeShutdown) as ShutdownHook[];
        this.logger.info(`Running ${listeners.length} shutdown hook(s)...`);

        const results = await Promise.allSettled(listeners.map(fn => fn()));

        for (const [index, result] of results.entries()) {
            if (result.status === 'rejected') {
                this.logger.error(`Shutdown hook #${index + 1} failed:`, result.reason);
            }
        }
    }

    public on<E extends keyof ShutdownEvents> (event: E, listener: ShutdownEvents[E]): this
    {
        this.eventEmitter.on(event, listener as (...args: any[]) => void);
        return this;
    }
}
