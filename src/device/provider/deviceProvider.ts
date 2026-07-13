import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import DeviceManager from '../deviceManager.js';

/**
 * `TConfig` is the provider's own settings.json `DeviceSource.config` shape, named/typed by each
 * concrete provider rather than passed around as a loose `JsonObject`. Every provider is paired
 * with a TypeBox schema for `TConfig` on its `DeviceProviderFactory`, which validates a
 * `DeviceSource`'s raw config against it before constructing the provider. Providers that don't
 * need any configuration still use a config type (the shared `NoDeviceProviderConfig`) for
 * uniformity - see
 * `SlvCtrlPlusSerialDeviceProvider`/`Zc95SerialDeviceProvider`/`EStim2bSerialDeviceProvider`/
 * `AiroticDeviceProvider`.
 *
 * `config` is deliberately the FIRST constructor parameter across every `DeviceProvider`
 * subclass - `GenericDeviceProviderFactory` relies on that fixed convention to generically
 * prepend the validated config to whatever other ("dependency") constructor arguments were
 * captured when the factory itself was wired up.
 */
export default abstract class DeviceProvider<TConfig>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    protected readonly config: TConfig;

    protected constructor(config: TConfig, deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        this.config = config;
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public async init(): Promise<void> {
        return Promise.resolve();
    }

    public async stop(): Promise<void> {
        return Promise.resolve();
    }
}
