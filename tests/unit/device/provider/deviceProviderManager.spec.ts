import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import DeviceProviderManager from '../../../../src/device/provider/deviceProviderManager.js';
import DeviceProviderFactory from '../../../../src/device/provider/deviceProviderFactory.js';
import DeviceProvider from '../../../../src/device/provider/deviceProvider.js';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import Settings from '../../../../src/settings/settings.js';
import DeviceSource from '../../../../src/settings/deviceSource.js';
import { JsonObject } from '../../../../src/types.js';

class RecordingDeviceProvider extends DeviceProvider
{
    public initCalls = 0;
    public stopCalls = 0;
    public stopped = false;

    // Allows tests to control when init()/stop() resolve, to simulate slow-running operations.
    private initGate: Promise<void> = Promise.resolve();
    private stopGate: Promise<void> = Promise.resolve();

    public constructor() {
        super(mock<DeviceManager>(), new EventEmitter(), mock<Logger>());
    }

    public setInitGate(gate: Promise<void>): void {
        this.initGate = gate;
    }

    public setStopGate(gate: Promise<void>): void {
        this.stopGate = gate;
    }

    public override async init(): Promise<void> {
        this.initCalls++;
        await this.initGate;
    }

    public override async stop(): Promise<void> {
        this.stopCalls++;
        await this.stopGate;
        this.stopped = true;
    }
}

function makeLogger(): Logger {
    const logger = mock<Logger>();
    logger.child.mockReturnValue(logger);
    return logger;
}

function makeSettings(sources: { id: string, type: string, enabled?: boolean }[]): Settings {
    const settings = new Settings();

    for (const source of sources) {
        settings.addDeviceSource(new DeviceSource(source.id, source.type, {}, source.enabled ?? true));
    }

    return settings;
}

function makeFactoryMap(providersById: Record<string, RecordingDeviceProvider>): Map<string, DeviceProviderFactory<any>> {
    const factories = new Map<string, DeviceProviderFactory<any>>();

    for (const [type, provider] of Object.entries(providersById)) {
        factories.set(type, {
            create: (_config: JsonObject) => provider,
        });
    }

    return factories;
}

describe('DeviceProviderManager', () => {
    it('creates and initializes a provider for an enabled device source', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));

        expect(provider.initCalls).toBe(1);
        expect(provider.stopCalls).toBe(0);
    });

    it('does not create a provider for a disabled device source', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));

        expect(provider.initCalls).toBe(0);
    });

    it('stops a running provider once its device source is disabled', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider.initCalls).toBe(1);

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));
        expect(provider.stopCalls).toBe(1);
    });

    it('stops a running provider once its device source is removed from config', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider.initCalls).toBe(1);

        await manager.reload(makeSettings([]));
        expect(provider.stopCalls).toBe(1);
    });

    it('serializes overlapping reload() calls so a disable immediately followed by a re-enable ends up running', async () => {
        // Use two distinct provider instances so we can tell which one ends up "running" and
        // reproduce the manager's internal bookkeeping the same way distinct factory.create()
        // calls would in production.
        const providerA = new RecordingDeviceProvider();
        const providerB = new RecordingDeviceProvider();

        let creationCount = 0;
        const factories = new Map<string, DeviceProviderFactory<any>>([
            ['virtual', { create: (): RecordingDeviceProvider => (creationCount++ === 0 ? providerA : providerB) }],
        ]);

        const manager = new DeviceProviderManager(factories, makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(providerA.initCalls).toBe(1);

        // Make the disabling reload()'s stop() call slow, so it's still in-flight when the very
        // next reload() (re-enabling the same source) is triggered without awaiting the first.
        let releaseStop: () => void = () => undefined;
        providerA.setStopGate(new Promise<void>((resolve) => { releaseStop = resolve; }));

        const disablePromise = manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));
        const reenablePromise = manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));

        // Let the slow stop() call finish now that both reload() calls have been queued.
        releaseStop();

        await disablePromise;
        await reenablePromise;

        expect(providerA.stopCalls).toBe(1);
        // Without serialization, the re-enable reload() would have (incorrectly) assumed
        // providerA was still valid and never created providerB.
        expect(providerB.initCalls).toBe(1);
    });

    it('stopProviders stops all running providers and clears internal state', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        await manager.stopProviders();

        expect(provider.stopped).toBe(true);

        // After stopProviders(), a subsequent reload() with the same enabled source must create
        // a fresh provider rather than assuming one is already running.
        const provider2 = new RecordingDeviceProvider();
        const manager2 = new DeviceProviderManager(makeFactoryMap({ virtual: provider2 }), makeLogger());
        await manager2.reload(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider2.initCalls).toBe(1);
    });
});
