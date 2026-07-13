import { Value } from '@sinclair/typebox/value';
import Settings from '../../settings/settings.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import Logger from '../../logging/Logger.js';
import DeviceProvider from './deviceProvider.js';
import JsonSchemaValidatorFactory from '../../schemaValidation/JsonSchemaValidatorFactory.js';

export default class DeviceProviderManager
{
    private factories: Map<string, DeviceProviderFactory<any>>;

    private readonly jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;

    private readonly logger: Logger;

    private providers: DeviceProvider<any>[] = [];

    public constructor(
        factories: Map<string, DeviceProviderFactory<any>>,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory,
        logger: Logger
    ) {
        this.factories = factories;
        this.jsonSchemaValidatorFactory = jsonSchemaValidatorFactory;
        this.logger = logger.child({ name: DeviceProviderManager.name });
    }

    public loadFromSettings(settings: Settings): void
    {
        const configuredDeviceSources = settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            const factory = this.factories.get(deviceSource.type)

            if (undefined === factory) {
                this.logger.warn(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            // Clone before hydrating: `Value.Default()` mutates in place, and we don't want to
            // write resolved defaults back into `deviceSource.config` itself (Settings auto-saves
            // on mutation, so that would trigger a spurious settings.json write/broadcast).
            // `structuredClone()` doesn't work here: `Settings` is wrapped in an `on-change` Proxy
            // that deep-proxies nested objects too (including `deviceSource.config`), and the
            // structured clone algorithm can't clone a Proxy. `JsonObject` is JSON-safe by
            // definition, so a plain JSON round-trip clones it fine while transparently reading
            // through the proxy (JSON.stringify just does normal property access).
            const config = Value.Default(factory.configSchema, JSON.parse(JSON.stringify(deviceSource.config)));

            const configValidator = this.jsonSchemaValidatorFactory.create(factory.configSchema);

            if (!configValidator.validate(config)) {
                throw new Error(
                    `Config for device source '${id}' (type '${deviceSource.type}') is not valid: `
                    + configValidator.getValidationErrorsAsText()
                );
            }

            const provider = factory.create(config);

            this.providers.push(provider);
        }
    }

    public async startProviders(): Promise<void> {
        for (const provider of this.providers) {
            await provider.init();
        }
    }

    public async stopProviders(): Promise<void> {
        const errors: unknown[] = [];

        for (const provider of this.providers) {
            try {
                await provider.stop();
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
