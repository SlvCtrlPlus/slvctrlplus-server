import Logger from '../../logging/Logger.js';

export default abstract class SharedObserver
{
    protected readonly logger: Logger;

    private activeUsers = 0;

    // Used to let all providers who want to acquire this observer wait for the first start() to finish, without having to re-run onFirstStart() for each of them.
    private startupPromise: Promise<void> | undefined;

    protected constructor(logger: Logger) {
        this.logger = logger;
    }

    public async start(): Promise<void> {
        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);

            if (this.startupPromise !== undefined) {
                await this.startupPromise;
            }

            return;
        }

        this.startupPromise = this.onFirstStart();

        try {
            await this.startupPromise;
        } finally {
            this.startupPromise = undefined;
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
