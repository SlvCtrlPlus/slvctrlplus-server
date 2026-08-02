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
        const joiningRunningObserver = this.activeUsers > 0;

        // Not already running and nobody else currently starting it either
        if (this.activeUsers === 0 && this.startupPromise === undefined) {
            this.startupPromise = this.onFirstStart();
        }

        if (this.startupPromise !== undefined) {
            try {
                await this.startupPromise;
            } finally {
                this.startupPromise = undefined;
            }
        }

        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);
        }
        if (joiningRunningObserver) {
            // Reannounce all detected devices by this observer to a provider joining later
            await this.onSubsequentStart();
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

    /**
     * Runs for every caller that joins an already-running observer (i.e. every start() call
     * except the first). No-op by default - only relevant to observers with multiple consumers
     * per instance, where a newly-joining consumer may need to catch up on state it missed.
     */
    protected async onSubsequentStart(): Promise<void> {
        return Promise.resolve();
    }
}
