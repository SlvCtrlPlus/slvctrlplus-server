import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Peripheral } from '@stoprocent/noble';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import BleObserver from '../../../../src/device/transport/bleObserver.js';
import { DeviceId } from '../../../../src/device/deviceId.js';

const mockNoble = vi.hoisted(() => ({
    on: vi.fn(),
    waitForPoweredOnAsync: vi.fn(),
    startScanningAsync: vi.fn(),
    stopScanningAsync: vi.fn(),
}));

vi.mock('@stoprocent/noble', () => ({ default: mockNoble }));

describe('BleObserver', () => {
    let mockDeviceManager: ReturnType<typeof mock<DeviceManager>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;

    function createObserver(): BleObserver {
        return new BleObserver(mockDeviceManager, mockLogger);
    }

    function getNobleListener(event: string) {
        return mockNoble.on.mock.calls.find(([e]) => e === event)?.[1];
    }

    beforeEach(() => {
        vi.resetAllMocks();

        mockDeviceManager = mock<DeviceManager>();
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
        it('creates a child logger with the observer class name', () => {
            createObserver();

            expect(mockLogger.child).toHaveBeenCalledWith({ name: BleObserver.name });
        });
    });

    describe('init', () => {
        it('registers a discover listener on noble', async () => {
            const observer = createObserver();

            await observer.init();

            expect(mockNoble.on).toHaveBeenCalledWith('discover', expect.any(Function));
        });

        it('registers a stateChange listener on noble', async () => {
            const observer = createObserver();

            await observer.init();

            expect(mockNoble.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
        });

        it('registers a scanStop listener on noble', async () => {
            const observer = createObserver();

            await observer.init();

            expect(mockNoble.on).toHaveBeenCalledWith('scanStop', expect.any(Function));
        });

        it('calls waitForPoweredOnAsync and startScanningAsync with the UART UUID', async () => {
            const observer = createObserver();

            await observer.init();

            expect(mockNoble.waitForPoweredOnAsync).toHaveBeenCalledOnce();
            expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            expect(mockNoble.startScanningAsync).toHaveBeenCalledWith(
                ['6e400001b5a3f393e0a9e50e24dcca9e'],
                true,
            );
        });

        it('does not call startScanningAsync a second time when stateChange poweredOn fires', async () => {
            const observer = createObserver();
            await observer.init();

            getNobleListener('stateChange')?.('poweredOn');

            // observe() returns early because isScanning is already true
            expect(mockNoble.startScanningAsync).toHaveBeenCalledTimes(1);
        });

        it('does not call observe when stateChange fires with a non-poweredOn state', async () => {
            const observer = createObserver();
            await observer.init();
            mockNoble.waitForPoweredOnAsync.mockClear();

            getNobleListener('stateChange')?.('poweredOff');

            expect(mockNoble.waitForPoweredOnAsync).not.toHaveBeenCalled();
        });

        it('calls stopScanningAsync and allows retry when waitForPoweredOnAsync rejects', async () => {
            mockNoble.waitForPoweredOnAsync.mockRejectedValue(new Error('BLE unavailable'));
            const observer = createObserver();

            await expect(observer.init()).resolves.not.toThrow();

            expect(mockNoble.stopScanningAsync).toHaveBeenCalledOnce();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('logs info when scanStop event fires', async () => {
            const observer = createObserver();
            await observer.init();

            getNobleListener('scanStop')?.();

            expect(mockLogger.info).toHaveBeenCalledWith('Noble scanning stopped');
        });
    });

    describe('onDiscover (via discover event)', () => {
        function createPeripheral(rssi: number, id: string): ReturnType<typeof mock<Peripheral>> {
            const peripheral = mock<Peripheral>();
            Object.defineProperty(peripheral, 'rssi', { get: () => rssi, configurable: true });
            Object.defineProperty(peripheral, 'id', { get: () => id, configurable: true });
            return peripheral;
        }

        it('ignores a peripheral whose RSSI is below the minimum threshold', async () => {
            const observer = createObserver();
            await observer.init();

            getNobleListener('discover')?.(createPeripheral(-80, 'weak-device'));

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
        });

        it('announces a peripheral whose RSSI is exactly at the minimum threshold (-70)', async () => {
            const observer = createObserver();
            await observer.init();
            const peripheral = createPeripheral(-70, 'at-threshold');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ peripheral }),
            );
        });

        it('announces a peripheral whose RSSI is above the minimum threshold', async () => {
            const observer = createObserver();
            await observer.init();
            const peripheral = createPeripheral(-50, 'strong-device');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();
        });

        it('uses the peripheral id to build the DeviceId passed to announceDetectedDevice', async () => {
            const observer = createObserver();
            await observer.init();
            const peripheral = createPeripheral(-60, 'abc-123');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ id: DeviceId.create('abc-123') }),
            );
        });

        it('logs a debug message when ignoring a weak-signal peripheral', async () => {
            const observer = createObserver();
            await observer.init();

            getNobleListener('discover')?.(createPeripheral(-80, 'noisy-device'));

            expect(mockLogger.debug).toHaveBeenCalled();
        });
    });
});
