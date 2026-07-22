import { SequentialTaskQueue } from 'sequential-task-queue';
import Settings from '../../settings/settings.js';
import DeviceSource from '../../settings/deviceSource.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import Logger from '../../logging/Logger.js';
import { AnyDeviceProvider } from './deviceProvider.js';
import { logError } from '../../util/error.js';

type RunningProvider = {
    provider: AnyDeviceProvider;
    sourceFingerprint: string;
};

export default class DeviceProviderManager
{
    private factories: Map<string, DeviceProviderFactory<any>>;

    private readonly logger: Logger;

    private readonly providers: Map<string, RunningProvider> = new Map();

    // Settings can change in rapid succession, so overlapping loadFromSettings()/stopProviders()
    // calls are serialized to avoid racing on the shared providers map
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

        // Snapshotted upfront so each provider's stop()/start() can run concurrently below
        const providersToStop = [...this.providers.entries()].filter(([id, runningProvider]) => {
            const deviceSource = configuredDeviceSources.get(id);

            return undefined === deviceSource
                || !deviceSource.enabled
                || runningProvider.sourceFingerprint !== DeviceProviderManager.fingerprintOf(deviceSource);
        });

        await Promise.allSettled(providersToStop.map(async ([id, runningProvider]) => {
            const deviceSource = configuredDeviceSources.get(id);
            const reason = undefined === deviceSource
                ? 'removed from config'
                : (!deviceSource.enabled ? 'disabled' : 'configuration changed');

            this.logger.info(`Stopping device source '${id}' (${reason})`);

            try {
                await runningProvider.provider.stop();
                // A provider that failed to stop may still be running, so it stays recorded
                // to prevent starting a duplicate for the same source on a later reload
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
                // Only recorded once started successfully, so a failed start doesn't block retries
                this.providers.set(id, {
                    provider,
                    sourceFingerprint: DeviceProviderManager.fingerprintOf(deviceSource),
                });
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

    private static fingerprintOf(deviceSource: DeviceSource): string {
        return JSON.stringify({ type: deviceSource.type, config: deviceSource.config });
    }

    private async doStopProviders(): Promise<void> {
        const results = await Promise.allSettled([...this.providers.entries()].map(async ([id, runningProvider]) => {
            await runningProvider.provider.stop();
            // A provider that failed to stop stays recorded so it isn't mistaken for a free slot
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
