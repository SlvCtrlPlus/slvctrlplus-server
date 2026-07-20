import { SequentialTaskQueue } from 'sequential-task-queue';
import Settings from '../../settings/settings.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import Logger from '../../logging/Logger.js';
import { AnyDeviceProvider } from './deviceProvider.js';
import { logError } from '../../util/error.js';

export default class DeviceProviderManager
{
    private factories: Map<string, DeviceProviderFactory<any>>;

    private readonly logger: Logger;

    private readonly providers: Map<string, AnyDeviceProvider> = new Map();

    /**
     * `reload()` and `stopProviders()` mutate the shared `providers` map asynchronously.
     * Since settings can change in rapid succession (e.g. a device source being disabled and
     * immediately re-enabled), overlapping calls need to be serialized to avoid racing on that
     * map, otherwise a later call could observe a half-finished earlier one and reach the wrong
     * conclusion about whether a provider is already running.
     */
    private readonly operationQueue: SequentialTaskQueue = new SequentialTaskQueue();

    public constructor(
        factories: Map<string, DeviceProviderFactory<any>>,
        logger: Logger
    ) {
        this.factories = factories;
        this.logger = logger.child({ name: DeviceProviderManager.name });
    }

    public loadFromSettings(settings: Settings): Promise<void>
    {
        return this.enqueueOperation(() => this.doLoadFromSettings(settings));
    }

    public stopProviders(): Promise<void> {
        return this.enqueueOperation(() => this.doStopProviders());
    }

    private async enqueueOperation(operation: () => Promise<void>): Promise<void> {
        await this.operationQueue.push(operation);
    }

    private async doLoadFromSettings(settings: Settings): Promise<void>
    {
        const configuredDeviceSources = settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        // Snapshotted upfront (rather than iterated live) so each provider's stop()/start() can run
        // concurrently below without one slow provider delaying every other, unrelated device source
        const providersToStop = [...this.providers.entries()].filter(([id]) => {
            const deviceSource = configuredDeviceSources.get(id);

            return undefined === deviceSource || !deviceSource.enabled;
        });

        await Promise.allSettled(providersToStop.map(async ([id, provider]) => {
            const deviceSource = configuredDeviceSources.get(id);
            const reason = undefined === deviceSource ? 'removed from config' : 'disabled';

            this.logger.info(`Stopping device source '${id}' (${reason})`);

            try {
                await provider.stop();
                // Only forget the provider once it actually stopped. A provider that failed to
                // stop may still be running, so keeping it recorded prevents a duplicate from
                // being started for the same source on a later reload.
                this.providers.delete(id);
            } catch (error: unknown) {
                logError(this.logger, `Failed to stop device provider for device source '${id}'`, error);
            }
        }));

        const sourcesToStart = [...configuredDeviceSources.entries()].filter(([id, deviceSource]) => {
            return deviceSource.enabled && !this.providers.has(id);
        });

        await Promise.allSettled(sourcesToStart.map(async ([id, deviceSource]) => {
            const factory = this.factories.get(deviceSource.type);

            if (undefined === factory) {
                this.logger.warn(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                return;
            }

            const provider = factory.create(deviceSource.config);

            try {
                await provider.start();
                // Only record the provider once it started successfully, so a failed start
                // doesn't leave a stuck entry that blocks all future retries for this source.
                this.providers.set(id, provider);
            } catch (error: unknown) {
                logError(this.logger, `Failed to start device provider for device source '${id}'`, error);

                try {
                    await provider.stop();
                } catch (cleanupError: unknown) {
                    logError(this.logger, `Failed to clean up half-started device provider for device source '${id}'`, cleanupError);
                }
            }
        }));
    }

    private async doStopProviders(): Promise<void> {
        const results = await Promise.allSettled([...this.providers.entries()].map(async ([id, provider]) => {
            await provider.stop();
            // Remove only providers that actually stopped; a failed stop stays recorded so it
            // isn't mistaken for a free slot on a later reload.
            this.providers.delete(id);
        }));

        const errors = results
            .filter((result): result is PromiseRejectedResult => 'rejected' === result.status)
            .map((result) => result.reason);

        for (const error of errors) {
            this.logger.error('Failed to stop device provider', error);
        }

        if (errors.length > 0) {
            throw new Error(`Failed to stop ${errors.length} device provider(s)`);
        }
    }
}
