import Logger from '../../logging/Logger.js';

export default abstract class SharedObserver
{
    protected readonly logger: Logger;

    private activeUsers = 0;

    protected constructor(logger: Logger) {
        this.logger = logger;
    }

    protected async acquire(): Promise<void> {
        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);
            return;
        }

        await this.onFirstStart();
    }

    protected async release(): Promise<void> {
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
