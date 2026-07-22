import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import DeviceProviderManager from '../../../../src/device/provider/deviceProviderManager.js';
import DeviceProviderFactory from '../../../../src/device/provider/deviceProviderFactory.js';
import DeviceProvider from '../../../../src/device/provider/deviceProvider.js';
import DeviceManager, { DeviceDetectionInfo } from '../../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../../src/device/device.js';
import Logger from '../../../../src/logging/Logger.js';
import Settings from '../../../../src/settings/settings.js';
import DeviceSource from '../../../../src/settings/deviceSource.js';
import { JsonObject } from '../../../../src/types.js';

class RecordingDeviceProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public startCalls = 0;
    public stopCalls = 0;
    public stopResolved = false;

    // Allows tests to control when start()/stop() resolve, to simulate slow-running operations.
    private startGate: Promise<void> = Promise.resolve();
    private stopGate: Promise<void> = Promise.resolve();

    public constructor() {
        super(mock<DeviceManager>(), new EventEmitter(), mock<Logger>());
    }

    public setStartGate(gate: Promise<void>): void {
        this.startGate = gate;
    }

    public setStopGate(gate: Promise<void>): void {
        this.stopGate = gate;
    }

    protected override async doStart(): Promise<void> {
        this.startCalls++;
        await this.startGate;
    }

    protected override async doStop(): Promise<void> {
        this.stopCalls++;
        await this.stopGate;
        this.stopResolved = true;
    }

    // This test double never actually detects devices; it only exercises the lifecycle.
    protected canHandleDeviceDetectionInfo(_deviceDetectionInfo: DeviceDetectionInfo): _deviceDetectionInfo is DeviceDetectionInfo {
        return false;
    }

    protected createDevice(_deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice | undefined> {
        return Promise.resolve(undefined);
    }
}

function makeLogger(): Logger {
    const logger = mock<Logger>();
    logger.child.mockReturnValue(logger);
    return logger;
}

function makeSettings(sources: { id: string, type: string, enabled?: boolean, config?: JsonObject }[]): Settings {
    const settings = new Settings();

    for (const source of sources) {
        settings.addDeviceSource(new DeviceSource(source.id, source.type, source.config ?? {}, source.enabled ?? true));
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

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));

        expect(provider.startCalls).toBe(1);
        expect(provider.stopCalls).toBe(0);
    });

    it('does not create a provider for a disabled device source', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));

        expect(provider.startCalls).toBe(0);
    });

    it('stops a running provider once its device source is disabled', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider.startCalls).toBe(1);

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));
        expect(provider.stopCalls).toBe(1);
    });

    it('stops a running provider once its device source is removed from config', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider.startCalls).toBe(1);

        await manager.loadFromSettings(makeSettings([]));
        expect(provider.stopCalls).toBe(1);
    });

    it('restarts a provider when its device source configuration changes', async () => {
        const providerA = new RecordingDeviceProvider();
        const providerB = new RecordingDeviceProvider();
        let creationCount = 0;
        const factories = new Map<string, DeviceProviderFactory<any>>([
            ['virtual', { create: (): RecordingDeviceProvider => (creationCount++ === 0 ? providerA : providerB) }],
        ]);
        const manager = new DeviceProviderManager(factories, makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', config: { url: 'a' } }]));
        expect(providerA.startCalls).toBe(1);

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', config: { url: 'b' } }]));

        expect(providerA.stopCalls).toBe(1);
        expect(providerB.startCalls).toBe(1);
    });

    it('keeps a provider running when its device source configuration is unchanged', async () => {
        const provider = new RecordingDeviceProvider();
        const manager = new DeviceProviderManager(makeFactoryMap({ virtual: provider }), makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', config: { url: 'a' } }]));
        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', config: { url: 'a' } }]));

        expect(provider.startCalls).toBe(1);
        expect(provider.stopCalls).toBe(0);
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

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(providerA.startCalls).toBe(1);

        // Make the disabling reload()'s stop() call slow, so it's still in-flight when the very
        // next reload() (re-enabling the same source) is triggered without awaiting the first.
        let releaseStop: () => void = () => undefined;
        providerA.setStopGate(new Promise<void>((resolve) => { releaseStop = resolve; }));

        const disablePromise = manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: false }]));
        const reenablePromise = manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));

        // Let the slow stop() call finish now that both reload() calls have been queued.
        releaseStop();

        await disablePromise;
        await reenablePromise;

        expect(providerA.stopCalls).toBe(1);
        // Without serialization, the re-enable reload() would have (incorrectly) assumed
        // providerA was still valid and never created providerB.
        expect(providerB.startCalls).toBe(1);
    });

    it('initializes multiple newly-enabled device sources concurrently, not one at a time', async () => {
        const slowProvider = new RecordingDeviceProvider();
        const fastProvider = new RecordingDeviceProvider();

        let releaseSlowStart: () => void = () => undefined;
        slowProvider.setStartGate(new Promise<void>((resolve) => { releaseSlowStart = resolve; }));

        const manager = new DeviceProviderManager(makeFactoryMap({ slow: slowProvider, fast: fastProvider }), makeLogger());

        // 'source-slow' is listed first - with a sequential loop, the still-pending slow provider
        // would block 'source-fast' from even starting its own start() call.
        const reloadPromise = manager.loadFromSettings(makeSettings([
            { id: 'source-slow', type: 'slow', enabled: true },
            { id: 'source-fast', type: 'fast', enabled: true },
        ]));

        await vi.waitFor(() => {
            expect(slowProvider.startCalls).toBe(1);
            expect(fastProvider.startCalls).toBe(1);
        });

        releaseSlowStart();
        await reloadPromise;
    });

    it('stopProviders stops all running providers and clears internal state', async () => {
        const provider = new RecordingDeviceProvider();
        const provider2 = new RecordingDeviceProvider();
        let creationCount = 0;
        const factories = new Map<string, DeviceProviderFactory<any>>([
            ['virtual', { create: (): RecordingDeviceProvider => (creationCount++ === 0 ? provider : provider2) }],
        ]);
        const manager = new DeviceProviderManager(factories, makeLogger());

        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        await manager.stopProviders();

        expect(provider.stopResolved).toBe(true);

        // After stopProviders(), a subsequent reload() on the SAME manager with the same enabled
        // source must create a fresh provider - proving stopProviders() cleared its internal state.
        await manager.loadFromSettings(makeSettings([{ id: 'source-1', type: 'virtual', enabled: true }]));
        expect(provider2.startCalls).toBe(1);
    });
});
