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
    removeAllListeners: vi.fn(),
    stop: vi.fn(),
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

            await observer.start();

            expect(mockNoble.on).toHaveBeenCalledWith('discover', expect.any(Function));
        });

        it('registers a scanStop listener on noble', async () => {
            const observer = createObserver();

            await observer.start();

            expect(mockNoble.on).toHaveBeenCalledWith('scanStop', expect.any(Function));
        });

        it('does not block start() while waiting for the BLE adapter to power on', async () => {
            let resolvePowerOn: () => void = () => undefined;
            mockNoble.waitForPoweredOnAsync.mockImplementation(() => new Promise<void>((resolve) => {
                resolvePowerOn = resolve;
            }));

            const observer = createObserver();

            await expect(observer.start()).resolves.toBeUndefined();

            // start() already resolved, even though the power-on wait is still pending.
            expect(mockNoble.startScanningAsync).not.toHaveBeenCalled();

            resolvePowerOn();
            await vi.waitFor(() => {
                expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            });
        });

        it('calls startScanningAsync with the UART UUID once the adapter reports poweredOn', async () => {
            const observer = createObserver();

            await observer.start();

            await vi.waitFor(() => {
                expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            });
            expect(mockNoble.startScanningAsync).toHaveBeenCalledWith(
                ['6e400001b5a3f393e0a9e50e24dcca9e'],
                true,
            );
        });

        it('retries waitForPoweredOnAsync in 10-minute chunks after a timeout until the adapter powers on', async () => {
            mockNoble.waitForPoweredOnAsync
                .mockRejectedValueOnce(new Error('Timeout waiting for Noble to be powered on'))
                .mockResolvedValueOnce(undefined);

            const observer = createObserver();

            await observer.start();

            await vi.waitFor(() => {
                expect(mockNoble.waitForPoweredOnAsync).toHaveBeenCalledTimes(2);
                expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            });

            expect(mockNoble.waitForPoweredOnAsync).toHaveBeenCalledWith(10 * 60 * 1000);
        });

        it('calls stopScanningAsync and logs an error when startScanningAsync rejects', async () => {
            mockNoble.startScanningAsync.mockRejectedValue(new Error('BLE unavailable'));
            const observer = createObserver();

            await expect(observer.start()).resolves.not.toThrow();

            await vi.waitFor(() => {
                expect(mockNoble.stopScanningAsync).toHaveBeenCalledOnce();
                expect(mockLogger.error).toHaveBeenCalled();
            });
        });

        it('logs info when scanStop event fires', async () => {
            const observer = createObserver();
            await observer.start();

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
            await observer.start();

            getNobleListener('discover')?.(createPeripheral(-80, 'weak-device'));

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
        });

        it('announces a peripheral whose RSSI is exactly at the minimum threshold (-70)', async () => {
            const observer = createObserver();
            await observer.start();
            const peripheral = createPeripheral(-70, 'at-threshold');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ type: 'ble', peripheral }),
            );
        });

        it('announces a peripheral whose RSSI is above the minimum threshold', async () => {
            const observer = createObserver();
            await observer.start();
            const peripheral = createPeripheral(-50, 'strong-device');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();
        });

        it('uses the peripheral id to build the DeviceId passed to announceDetectedDevice', async () => {
            const observer = createObserver();
            await observer.start();
            const peripheral = createPeripheral(-60, 'abc-123');

            getNobleListener('discover')?.(peripheral);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DeviceId.create('abc-123') }),
            );
        });

        it('logs a debug message when ignoring a weak-signal peripheral', async () => {
            const observer = createObserver();
            await observer.start();

            getNobleListener('discover')?.(createPeripheral(-80, 'noisy-device'));

            expect(mockLogger.debug).toHaveBeenCalled();
        });
    });

    describe('reference counting (multiple BleDeviceProviders sharing one observer)', () => {
        it('does not touch noble at all when stop() is called without a matching start()', async () => {
            const observer = createObserver();

            await observer.stop();

            expect(mockNoble.removeAllListeners).not.toHaveBeenCalled();
            expect(mockNoble.stop).not.toHaveBeenCalled();
        });

        it('only wires up noble once when start() is called by two providers', async () => {
            const observer = createObserver();

            await observer.start();
            await observer.start();

            expect(mockNoble.on).toHaveBeenCalledTimes(2); // discover + scanStop, not doubled
            await vi.waitFor(() => {
                expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            });
        });

        it('stop() cancels a pending power-on wait without ever starting to scan', async () => {
            mockNoble.waitForPoweredOnAsync.mockImplementation(() => new Promise<void>(() => {
                // Never resolves on its own - only stop() should be able to end this wait.
            }));

            const observer = createObserver();
            await observer.start();

            await vi.waitFor(() => {
                expect(mockNoble.waitForPoweredOnAsync).toHaveBeenCalledOnce();
            });

            await observer.stop();

            expect(mockNoble.startScanningAsync).not.toHaveBeenCalled();
            expect(mockNoble.removeAllListeners).toHaveBeenCalledOnce();
            expect(mockNoble.stop).toHaveBeenCalledOnce();
        });

        it('keeps scanning after one of two providers stops', async () => {
            const observer = createObserver();
            await observer.start();
            await observer.start();

            await observer.stop();

            expect(mockNoble.removeAllListeners).not.toHaveBeenCalled();
            expect(mockNoble.stop).not.toHaveBeenCalled();
        });

        it('stops scanning only once every provider that started it has also stopped it', async () => {
            const observer = createObserver();
            await observer.start();
            await observer.start();

            await observer.stop();
            await observer.stop();

            expect(mockNoble.removeAllListeners).toHaveBeenCalledOnce();
            expect(mockNoble.stop).toHaveBeenCalledOnce();
        });

        it('does not go negative or re-stop noble when stop() is called more times than start()', async () => {
            const observer = createObserver();
            await observer.start();

            await observer.stop();
            mockNoble.removeAllListeners.mockClear();
            mockNoble.stop.mockClear();

            await observer.stop();

            expect(mockNoble.removeAllListeners).not.toHaveBeenCalled();
            expect(mockNoble.stop).not.toHaveBeenCalled();
        });

        it('starts scanning again after a full stop and a fresh start() (e.g. the last provider stopped, then a new one started)', async () => {
            const observer = createObserver();
            await observer.start();
            await observer.stop();

            mockNoble.on.mockClear();
            mockNoble.startScanningAsync.mockClear();

            await observer.start();

            expect(mockNoble.on).toHaveBeenCalledWith('discover', expect.any(Function));
            await vi.waitFor(() => {
                expect(mockNoble.startScanningAsync).toHaveBeenCalledOnce();
            });
        });
    });
});
