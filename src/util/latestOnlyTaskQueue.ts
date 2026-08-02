import { SequentialTaskQueue, CancellationToken, CancellablePromiseLike } from '@timesplinter/sequential-task-queue';

export default class LatestOnlyTaskQueue<T> {
  private queue = new SequentialTaskQueue();

  public run(
    task: (token: CancellationToken) => Promise<T>
  ): CancellablePromiseLike<T> {
    void this.queue.cancel();
    return this.queue.push(task);
  }

  public cancel(reason?: unknown): Promise<unknown> {
    return this.queue.cancel(reason);
  }
}