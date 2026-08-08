import type { CancellationToken } from '@timesplinter/sequential-task-queue';
import { SequentialTaskQueue } from '@timesplinter/sequential-task-queue';

export default class LatestOnlyTaskQueue<T> {
    private readonly queue = new SequentialTaskQueue();

    public async run(
        task: (token: CancellationToken) => Promise<T>,
    ): Promise<T> {
        void this.queue.cancel();
        return this.queue.push(task);
    }

    public async cancel(reason?: unknown): Promise<unknown> {
        return this.queue.cancel(reason);
    }
}
