import EventEmitter from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Type } from '@sinclair/typebox';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormatsPlugin from 'ajv-formats';
import DeviceProviderManager from '../../../../src/device/provider/deviceProviderManager.js';
import DeviceProviderFactory from '../../../../src/device/provider/deviceProviderFactory.js';
import DeviceProvider from '../../../../src/device/provider/deviceProvider.js';
import JsonSchemaValidatorFactory from '../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import Settings from '../../../../src/settings/settings.js';
import DeviceSource from '../../../../src/settings/deviceSource.js';
import Logger from '../../../../src/logging/Logger.js';
import DeviceManager from '../../../../src/device/deviceManager.js';

type FakeProviderConfig = { greeting: string };

const fakeProviderConfigSchema = Type.Object({
    greeting: Type.String(),
}, { additionalProperties: false });

type FakeDefaultedProviderConfig = { retries: number };

const fakeDefaultedProviderConfigSchema = Type.Object({
    retries: Type.Number({ default: 3 }),
}, { additionalProperties: false });

class FakeDeviceProvider extends DeviceProvider<FakeProviderConfig> {
    public readonly initMock = vi.fn().mockResolvedValue(undefined);
    public readonly stopMock = vi.fn().mockResolvedValue(undefined);

    public constructor(logger: Logger, config: FakeProviderConfig) {
        super(config, mock<DeviceManager>(), new EventEmitter(), logger);
    }

    public override init(): Promise<void> {
        return this.initMock();
    }

    public override stop(): Promise<void> {
        return this.stopMock();
    }
}

class FakeDeviceProviderFactory implements DeviceProviderFactory<FakeDeviceProvider> {
    public readonly configSchema = fakeProviderConfigSchema;

    public readonly created: FakeDeviceProvider[] = [];

    public constructor(private readonly logger: Logger) {
    }

    public create(config: FakeProviderConfig): FakeDeviceProvider {
        const provider = new FakeDeviceProvider(this.logger, config);
        this.created.push(provider);
        return provider;
    }
}

class FakeDefaultedDeviceProvider extends DeviceProvider<FakeDefaultedProviderConfig> {
    public constructor(logger: Logger, config: FakeDefaultedProviderConfig) {
        super(config, mock<DeviceManager>(), new EventEmitter(), logger);
    }
}

class FakeDefaultedDeviceProviderFactory implements DeviceProviderFactory<FakeDefaultedDeviceProvider> {
    public readonly configSchema = fakeDefaultedProviderConfigSchema;

    public readonly created: FakeDefaultedDeviceProvider[] = [];

    public constructor(private readonly logger: Logger) {
    }

    public create(config: FakeDefaultedProviderConfig): FakeDefaultedDeviceProvider {
        const provider = new FakeDefaultedDeviceProvider(this.logger, config);
        this.created.push(provider);
        return provider;
    }
}

describe('DeviceProviderManager', () => {
    let mockSettings: ReturnType<typeof mock<Settings>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;
    let fakeFactory: FakeDeviceProviderFactory;
    let fakeDefaultedFactory: FakeDefaultedDeviceProviderFactory;
    let manager: DeviceProviderManager;

    beforeEach(() => {
        mockSettings = mock<Settings>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        const ajv = new Ajv2020({ allErrors: true, strict: true });
        ajvFormatsPlugin.default(ajv);
        jsonSchemaValidatorFactory = new JsonSchemaValidatorFactory(ajv);

        fakeFactory = new FakeDeviceProviderFactory(mockLogger);
        fakeDefaultedFactory = new FakeDefaultedDeviceProviderFactory(mockLogger);

        manager = new DeviceProviderManager(
            new Map<string, DeviceProviderFactory<any>>([
                ['fake', fakeFactory],
                ['fakeDefaulted', fakeDefaultedFactory],
            ]),
            jsonSchemaValidatorFactory,
            mockLogger,
        );
    });

    describe('loadFromSettings', () => {
        it('constructs one provider instance per matching device source, even for the same type', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fake', { greeting: 'hi' })],
                ['source-2', new DeviceSource('source-2', 'fake', { greeting: 'hello' })],
            ]));

            manager.loadFromSettings(mockSettings);

            expect(fakeFactory.created).toHaveLength(2);
        });

        it('skips a device source whose type has no registered factory, logging a warning', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'unsupportedType', {})],
            ]));

            manager.loadFromSettings(mockSettings);

            expect(fakeFactory.created).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('unsupportedType'));
        });

        it('throws when a device source config fails schema validation (wrong type)', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fake', { greeting: 123 })],
            ]));

            expect(() => manager.loadFromSettings(mockSettings)).toThrow(/not valid/);
            expect(fakeFactory.created).toHaveLength(0);
        });

        it('throws when a device source config is missing a required field', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fake', {})],
            ]));

            expect(() => manager.loadFromSettings(mockSettings)).toThrow(/not valid/);
        });

        it('throws when a device source config has additional, unknown properties', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fake', { greeting: 'hi', extra: true })],
            ]));

            expect(() => manager.loadFromSettings(mockSettings)).toThrow(/not valid/);
        });

        it('hydrates a missing config field with its schema default before validating/constructing', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fakeDefaulted', {})],
            ]));

            manager.loadFromSettings(mockSettings);

            expect(fakeDefaultedFactory.created).toHaveLength(1);
            expect(fakeDefaultedFactory.created[0]).toMatchObject({ config: { retries: 3 } });
        });

        it('does not mutate the DeviceSource.config object itself while hydrating defaults', () => {
            const rawConfig = {};
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fakeDefaulted', rawConfig)],
            ]));

            manager.loadFromSettings(mockSettings);

            expect(rawConfig).toEqual({});
        });

        it('keeps an explicitly provided value over the schema default', () => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fakeDefaulted', { retries: 7 })],
            ]));

            manager.loadFromSettings(mockSettings);

            expect(fakeDefaultedFactory.created[0]).toMatchObject({ config: { retries: 7 } });
        });
    });

    describe('startProviders / stopProviders', () => {
        beforeEach(() => {
            mockSettings.getDeviceSources.mockReturnValue(new Map([
                ['source-1', new DeviceSource('source-1', 'fake', { greeting: 'hi' })],
                ['source-2', new DeviceSource('source-2', 'fake', { greeting: 'hello' })],
            ]));
            manager.loadFromSettings(mockSettings);
        });

        it('initializes every constructed provider', async () => {
            await manager.startProviders();

            for (const provider of fakeFactory.created) {
                expect(provider.initMock).toHaveBeenCalledOnce();
            }
        });

        it('stops every provider', async () => {
            await manager.stopProviders();

            for (const provider of fakeFactory.created) {
                expect(provider.stopMock).toHaveBeenCalledOnce();
            }
        });

        it('collects errors from failing providers and still stops the rest, then throws', async () => {
            fakeFactory.created[0].stopMock.mockRejectedValueOnce(new Error('boom'));

            await expect(manager.stopProviders()).rejects.toThrow(/Failed to stop 1 device provider/);

            expect(fakeFactory.created[1].stopMock).toHaveBeenCalledOnce();
        });
    });
});
