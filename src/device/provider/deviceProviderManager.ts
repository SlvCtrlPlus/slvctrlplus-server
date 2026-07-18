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
    private operationQueue: Promise<void> = Promise.resolve();

    public constructor(
        factories: Map<string, DeviceProviderFactory<any>>,
        logger: Logger
    ) {
        this.factories = factories;
        this.logger = logger.child({ name: DeviceProviderManager.name });
    }

    /**
     * (Re-)synchronizes the running device providers with the given settings: providers for
     * device sources that were removed or disabled are stopped, providers for device sources
     * that are new or were (re-)enabled are created and started. Already running providers for
     * device sources that are still enabled are left untouched. Known devices being individually
     * enabled/disabled is handled centrally by `DeviceManager`, not here.
     */
    public loadFromSettings(settings: Settings): Promise<void>
    {
        return this.enqueueOperation(() => this.doReload(settings));
    }

    public stopProviders(): Promise<void> {
        return this.enqueueOperation(() => this.doStopProviders());
    }

    private enqueueOperation(operation: () => Promise<void>): Promise<void> {
        const result = this.operationQueue.then(operation, operation);

        // Swallow rejections in the chain itself (each caller still gets the real
        // rejection via `result`), so a failed operation doesn't permanently wedge the queue.
        this.operationQueue = result.catch(() => undefined);

        return result;
    }

    private async doReload(settings: Settings): Promise<void>
    {
        const configuredDeviceSources = settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        for (const [id, provider] of this.providers) {
            const deviceSource = configuredDeviceSources.get(id);

            if (undefined !== deviceSource && deviceSource.enabled) {
                continue;
            }

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
        }

        for (const [id, deviceSource] of configuredDeviceSources) {
            if (!deviceSource.enabled || this.providers.has(id)) {
                continue;
            }

            const factory = this.factories.get(deviceSource.type);

            if (undefined === factory) {
                this.logger.warn(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const provider = factory.create(deviceSource.config);

            try {
                await provider.init();
                // Only record the provider once it initialized successfully, so a failed start
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
        }
    }

    private async doStopProviders(): Promise<void> {
        const errors: unknown[] = [];

        for (const [id, provider] of this.providers) {
            try {
                await provider.stop();
                // Remove only providers that actually stopped; a failed stop stays recorded so it
                // isn't mistaken for a free slot on a later reload.
                this.providers.delete(id);
            } catch (error: unknown) {
                errors.push(error);
                this.logger.error('Failed to stop device provider', error);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Failed to stop ${errors.length} device provider(s)`);
        }
    }
}
