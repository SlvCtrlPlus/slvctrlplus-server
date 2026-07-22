import Logger from '../../logging/Logger.js';

export default abstract class SharedObserver
{
    protected readonly logger: Logger;

    private activeUsers = 0;

    // Lets concurrent start() callers await an in-flight onFirstStart() instead of re-running it
    private startupPromise: Promise<void> | undefined;

    protected constructor(logger: Logger) {
        this.logger = logger;
    }

    public async start(): Promise<void> {
        // Not already running and nobody else currently starting it either - I'm the first
        if (this.activeUsers === 0 && this.startupPromise === undefined) {
            this.startupPromise = this.onFirstStart();
        }

        if (this.startupPromise !== undefined) {
            try {
                // Only count as an active user once startup actually succeeded - a rejection
                // here propagates out of start() without incrementing, for every concurrent
                // caller awaiting the same promise, so a failed startup doesn't leave anyone
                // thinking the observer is running
                await this.startupPromise;
            } finally {
                this.startupPromise = undefined;
            }
        }

        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);
        }
    }

    public async stop(): Promise<void> {
        if (this.activeUsers === 0) {
            return;
        }

        this.activeUsers--;

        if (this.activeUsers > 0) {
            this.logger.debug(`Still used by ${this.activeUsers} provider(s), not stopping`);
            return;
        }

        await this.onLastStop();
    }

    /**
     * Runs once, when the first caller acquires this observer.
     */
    protected abstract onFirstStart(): Promise<void>;

    /**
     * Runs once, when the last remaining caller releases this observer.
     */
    protected abstract onLastStop(): Promise<void>;
}
