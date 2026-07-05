import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import BleDeviceProvider from '../../../../src/device/provider/bleDeviceProvider.js';
import BleProtocolFactory from '../../../../src/device/provider/bleProtocolFactory.js';
import BleDevice from '../../../../src/device/bleDevice.js';
import { DeviceId } from '../../../../src/device/deviceId.js';

const mockNoble = vi.hoisted(() => ({
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    waitForPoweredOnAsync: vi.fn(),
    startScanningAsync: vi.fn(),
    stopScanningAsync: vi.fn(),
    stop: vi.fn(),
}));

vi.mock('@stoprocent/noble', () => ({ default: mockNoble }));

describe('BleDeviceProvider', () => {
    let mockDeviceManager: ReturnType<typeof mock<DeviceManager>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;

    function createProvider(): BleDeviceProvider {
        return new BleDeviceProvider(mockDeviceManager, new EventEmitter(), mockLogger);
    }

    function getNobleListener(event: string) {
        return mockNoble.on.mock.calls.find(([e]) => e === event)?.[1];
    }

    function createPeripheral(rssi: number, id: string): ReturnType<typeof mock<Peripheral>> {
        const peripheral = mock<Peripheral>();
        Object.defineProperty(peripheral, 'rssi', { get: () => rssi, configurable: true });
        Object.defineProperty(peripheral, 'id', { get: () => id, configurable: true });
        peripheral.state = 'disconnected';
        return peripheral;
    }

    function createFactory(protocolName: string): ReturnType<typeof mock<BleProtocolFactory<any>>> {
        const factory = mock<BleProtocolFactory<any>>();
        Object.defineProperty(factory, 'protocolName', { get: () => protocolName, configurable: true });
        return factory;
    }

    beforeEach(() => {
        vi.resetAllMocks();

        mockDeviceManager = mock<DeviceManager>();
        mockDeviceManager.getConnectedDevice.mockReturnValue(null);
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        mockNoble.waitForPoweredOnAsync.mockResolvedValue(undefined);
        mockNoble.startScanningAsync.mockResolvedValue(undefined);
        mockNoble.stopScanningAsync.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('creates a child logger with the provider class name', () => {
            createProvider();

            expect(mockLogger.child).toHaveBeenCalledWith({ name: BleDeviceProvider.name });
        });
    });

    describe('init', () => {
        it('registers discover, stateChange and scanStop listeners on noble', async () => {
            const provider = createProvider();

            await provider.init();

            expect(mockNoble.on).toHaveBeenCalledWith('discover', expect.any(Function));
            expect(mockNoble.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
            expect(mockNoble.on).toHaveBeenCalledWith('scanStop', expect.any(Function));
        });

        it('calls waitForPoweredOnAsync and startScanningAsync with the UART UUID', async () => {
            const provider = createProvider();

            await provider.init();

            expect(mockNoble.waitForPoweredOnAsync).toHaveBeenCalledOnce();
            expect(mockNoble.startScanningAsync).toHaveBeenCalledWith(
                ['6e400001b5a3f393e0a9e50e24dcca9e'],
                true,
            );
        });

        it('does not scan again when stateChange poweredOn fires while already scanning', async () => {
            const provider = createProvider();
            await provider.init();

            getNobleListener('stateChange')?.('poweredOn');
            await vi.waitFor(() => expect(mockNoble.startScanningAsync).toHaveBeenCalledTimes(1));
        });

        it('logs info when scanStop fires', async () => {
            const provider = createProvider();
            await provider.init();

            getNobleListener('scanStop')?.();

            expect(mockLogger.info).toHaveBeenCalledWith('Noble scanning stopped');
        });

        it('handles waitForPoweredOnAsync rejection gracefully', async () => {
            mockNoble.waitForPoweredOnAsync.mockRejectedValue(new Error('BLE unavailable'));
            const provider = createProvider();

            await expect(provider.init()).resolves.not.toThrow();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('onDiscover (via discover event)', () => {
        it('ignores a peripheral whose RSSI is below the minimum threshold', async () => {
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);
            await provider.init();

            await getNobleListener('discover')?.(createPeripheral(-80, 'weak-device'));

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });

        it('tries registered factories in registration order until one connects', async () => {
            const provider = createProvider();
            const failingFactory = createFactory('failing');
            failingFactory.tryConnect.mockResolvedValue(undefined);
            const successfulDevice = mock<BleDevice<any, any, any>>();
            const successfulFactory = createFactory('successful');
            successfulFactory.tryConnect.mockResolvedValue(successfulDevice);
            const untriedFactory = createFactory('untried');

            provider.registerFactory(failingFactory).registerFactory(successfulFactory).registerFactory(untriedFactory);
            await provider.init();

            const peripheral = createPeripheral(-50, 'device-1');
            getNobleListener('discover')?.(peripheral);

            await vi.waitFor(() => expect(mockDeviceManager.addDevice).toHaveBeenCalledWith(successfulDevice));

            expect(failingFactory.tryConnect).toHaveBeenCalledWith(DeviceId.create('device-1'), peripheral);
            expect(successfulFactory.tryConnect).toHaveBeenCalledWith(DeviceId.create('device-1'), peripheral);
            expect(untriedFactory.tryConnect).not.toHaveBeenCalled();
        });

        it('disconnects the peripheral when no registered factory recognizes it', async () => {
            const provider = createProvider();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(undefined);
            provider.registerFactory(factory);
            await provider.init();

            const peripheral = createPeripheral(-50, 'device-1');
            peripheral.state = 'connected';

            getNobleListener('discover')?.(peripheral);

            await vi.waitFor(() => expect(peripheral.disconnectAsync).toHaveBeenCalledOnce());
            expect(mockDeviceManager.addDevice).not.toHaveBeenCalled();
        });

        it('cancels an in-progress connection attempt when no factory recognizes the peripheral', async () => {
            const provider = createProvider();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(undefined);
            provider.registerFactory(factory);
            await provider.init();

            const peripheral = createPeripheral(-50, 'device-1');
            peripheral.state = 'connecting';

            getNobleListener('discover')?.(peripheral);

            await vi.waitFor(() => expect(peripheral.cancelConnect).toHaveBeenCalledOnce());
        });

        it('logs and disconnects when a factory throws', async () => {
            const provider = createProvider();
            const factory = createFactory('broken');
            factory.tryConnect.mockRejectedValue(new Error('handshake exploded'));
            provider.registerFactory(factory);
            await provider.init();

            const peripheral = createPeripheral(-50, 'device-1');
            peripheral.state = 'connected';

            getNobleListener('discover')?.(peripheral);

            await vi.waitFor(() => expect(peripheral.disconnectAsync).toHaveBeenCalledOnce());
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('does not re-attempt a peripheral that is already connected', async () => {
            mockDeviceManager.getConnectedDevice.mockReturnValue(mock());
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);
            await provider.init();

            await getNobleListener('discover')?.(createPeripheral(-50, 'already-connected'));

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });

        it('does not start a second attempt while one is already in flight for the same peripheral', async () => {
            const provider = createProvider();
            const factory = createFactory('slow');
            let resolveTryConnect: (device: undefined) => void = () => {};
            factory.tryConnect.mockReturnValue(new Promise((resolve) => { resolveTryConnect = resolve; }));
            provider.registerFactory(factory);
            await provider.init();

            const peripheral = createPeripheral(-50, 'device-1');
            const firstAttempt = getNobleListener('discover')?.(peripheral);
            await getNobleListener('discover')?.(peripheral);

            expect(factory.tryConnect).toHaveBeenCalledOnce();

            resolveTryConnect(undefined);
            await firstAttempt;
        });
    });

    describe('stop', () => {
        it('removes noble listeners and stops scanning', async () => {
            const provider = createProvider();
            await provider.init();

            await provider.stop();

            expect(mockNoble.removeAllListeners).toHaveBeenCalledOnce();
            expect(mockNoble.stopScanningAsync).toHaveBeenCalledOnce();
            expect(mockNoble.stop).toHaveBeenCalledOnce();
        });

        it('closes all connected devices', async () => {
            const provider = createProvider();
            const device = mock<BleDevice<any, any, any>>();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(device);
            provider.registerFactory(factory);
            await provider.init();

            getNobleListener('discover')?.(createPeripheral(-50, 'device-1'));
            await vi.waitFor(() => expect(mockDeviceManager.addDevice).toHaveBeenCalledWith(device));

            await provider.stop();

            expect(device.close).toHaveBeenCalledOnce();
        });
    });
});
