import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SerialPort } from 'serialport';
import { usb } from 'usb';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import SerialPortObserver from '../../../../src/device/transport/serialPortObserver.js';
import { DetectionId } from '../../../../src/device/deviceId.js';
import { waitTicks } from '../../helper/async.js';
import { CancellationToken } from '@timesplinter/sequential-task-queue';

// usb is a real, module-wide EventTarget - without mocking it, addEventListener() calls made in
// one test would still be registered when the next test runs, eventually tripping Node's
// MaxListenersExceededWarning.
const mockUsb = vi.hoisted(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
}));

vi.mock('usb', () => ({ usb: mockUsb }));

type PortInfoLike = {
    path: string;
    manufacturer: string | undefined;
    serialNumber: string | undefined;
    pnpId: string | undefined;
    locationId: string | undefined;
    productId: string | undefined;
    vendorId: string | undefined;
};

describe('SerialPortObserver', () => {
    let mockDeviceManager: ReturnType<typeof mock<DeviceManager>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;

    function makePortInfo(overrides: Partial<PortInfoLike> & { path: string }): PortInfoLike {
        return {
            manufacturer: undefined,
            serialNumber: undefined,
            pnpId: undefined,
            locationId: undefined,
            productId: undefined,
            vendorId: undefined,
            ...overrides,
        };
    }

    function createObserver(): SerialPortObserver {
        return new SerialPortObserver(mockDeviceManager, mockLogger);
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();

        mockDeviceManager = mock<DeviceManager>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('creates a child logger with the observer class name', () => {
            createObserver();

            expect(mockLogger.child).toHaveBeenCalledWith({ name: SerialPortObserver.name });
        });
    });

    describe('init', () => {
        it('does not announce any device when no serial ports are found', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const observer = createObserver();

            await observer.start();

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
        });

        it('skips a port that has no vendorId', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([
                makePortInfo({ path: '/dev/tty1', serialNumber: 'SN001', vendorId: undefined, productId: '6001' }),
            ]);
            const observer = createObserver();

            await observer.start();

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
        });

        it('skips a port that has no productId', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([
                makePortInfo({ path: '/dev/tty1', serialNumber: 'SN001', vendorId: '0403', productId: undefined }),
            ]);
            const observer = createObserver();

            await observer.start();

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
        });

        it('announces a newly discovered port to the device manager', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN001'), portInfo: port }),
            );
        });

        it('generates a synthetic serial number when serialNumber is undefined', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: undefined, vendorId: '0403', productId: '6001', locationId: 'port1' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();

            const expectedSn = 'serial-0403-6001-port1';
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create(expectedSn) }),
            );
        });

        it('does not re-announce a device that is already managed on the next discovery run', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();
            await vi.advanceTimersByTimeAsync(3000);

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();
        });

        it('revokes a device that disappears from the port list', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list')
                .mockResolvedValueOnce([port])
                .mockResolvedValueOnce([]);
            const observer = createObserver();

            await observer.start();
            await observer.discoverSerialDevices(); // manually trigger a discovery run

            expect(mockDeviceManager.revokeDetectedDevice).toHaveBeenCalledOnce();
            expect(mockDeviceManager.revokeDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN001') }),
            );
        });

        it('announces a previously revoked device again when it reappears', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list')
                .mockResolvedValueOnce([port])  // first run: present
                .mockResolvedValueOnce([])       // second run: gone – revoked
                .mockResolvedValueOnce([port]);  // third run: back
            const observer = createObserver();


            await observer.start();
            await observer.discoverSerialDevices(); // manually trigger a discovery run
            await observer.discoverSerialDevices(); // manually trigger a discovery run

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledTimes(2);
        });

        it('handles a SerialPort.list error gracefully without throwing', async () => {
            vi.spyOn(SerialPort, 'list').mockRejectedValue(new Error('USB stack error'));
            const observer = createObserver();

            await expect(observer.start()).resolves.not.toThrow();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('handles multiple valid ports in a single discovery run', async () => {
            const port1 = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            const port2 = makePortInfo({ path: '/dev/ttyUSB1', serialNumber: 'SN002', vendorId: '0403', productId: '6015' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port1, port2]);
            const observer = createObserver();

            await observer.start();

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledTimes(2);
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN001') }),
            );
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN002') }),
            );
        });
    });

    describe('reference counting (multiple SerialDeviceProviders sharing one observer)', () => {
        it('does not run a discovery pass when stop() is called without a matching start()', async () => {
            const listSpy = vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const observer = createObserver();

            await observer.stop();

            expect(listSpy).not.toHaveBeenCalled();
        });

        it('only runs one discovery pass when start() is called by two providers', async () => {
            const listSpy = vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const observer = createObserver();

            await observer.start();
            await observer.start();

            expect(listSpy).toHaveBeenCalledOnce();
        });

        it('a concurrent start() call waits for the in-flight discovery to finish instead of returning early', async () => {
            let resolveList: (ports: []) => void = () => undefined;
            vi.spyOn(SerialPort, 'list').mockImplementation(() => new Promise((resolve) => {
                resolveList = resolve;
            }));

            const observer = createObserver();

            let secondStartResolved = false;
            const firstStart = observer.start();
            const secondStart = observer.start().then(() => { secondStartResolved = true; });

            // Exactly 1 microtask tick: enough for start()'s own promise to settle (were the
            // buggy early-return path taken) and notify our `.then()` below, but no more
            await waitTicks(1);

            // Without waiting for the in-flight discovery, the second start() would have already
            // resolved here, before the port list has even actually been fetched.
            expect(secondStartResolved).toBe(false);

            resolveList([]);
            await Promise.all([firstStart, secondStart]);

            expect(secondStartResolved).toBe(true);
        });

        it('keeps the USB listeners registered after one of two providers stops', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const removeListenerSpy = vi.spyOn(usb, 'removeEventListener');
            const observer = createObserver();
            await observer.start();
            await observer.start();

            await observer.stop();

            expect(removeListenerSpy).not.toHaveBeenCalled();
        });

        it('removes the USB listeners only once every provider that started it has also stopped it', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const removeListenerSpy = vi.spyOn(usb, 'removeEventListener');
            const observer = createObserver();
            await observer.start();
            await observer.start();

            await observer.stop();
            await observer.stop();

            expect(removeListenerSpy).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(removeListenerSpy).toHaveBeenCalledWith('disconnect', expect.any(Function));
        });

        it('does not error when stop() is called more times than start()', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const observer = createObserver();
            await observer.start();

            await observer.stop();

            await expect(observer.stop()).resolves.not.toThrow();
        });
    });

    describe('restart after full stop (e.g. device source disabled then re-enabled)', () => {
        it('re-announces a still-plugged-in device after the observer was fully stopped and started again', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();

            await observer.stop(); // activeUsers 1 -> 0, triggers onLastStop()
            await observer.start(); // brand new provider re-acquiring the shared observer

            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledTimes(2);
        });

        it('revokes every still-tracked device via the device manager when fully stopped', async () => {
            const port1 = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            const port2 = makePortInfo({ path: '/dev/ttyUSB1', serialNumber: 'SN002', vendorId: '0403', productId: '6015' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port1, port2]);
            const observer = createObserver();

            await observer.start();
            await observer.stop();

            expect(mockDeviceManager.revokeDetectedDevice).toHaveBeenCalledTimes(2);
            expect(mockDeviceManager.revokeDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN001') }),
            );
            expect(mockDeviceManager.revokeDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN002') }),
            );
        });
    });

    describe('discoverSerialDevices() cancellation', () => {
        it('does not write results back into managedDevices when cancelled while awaiting SerialPort.list()', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });

            let resolveList: (ports: PortInfoLike[]) => void = () => undefined;
            vi.spyOn(SerialPort, 'list').mockImplementation(() => new Promise((resolve) => { resolveList = resolve; }));

            const observer = createObserver();
            const cancellationToken: CancellationToken = { cancelled: false, cancel: () => undefined };

            const discoveryPromise = observer.discoverSerialDevices(cancellationToken);

            // Simulates onLastStop() cancelling this run (via discoveryQueue.cancel()) because
            // the observer was stopped while this run was still in flight.
            cancellationToken.cancelled = true;

            resolveList([port]);
            await discoveryPromise;

            expect(mockDeviceManager.announceDetectedDevice).not.toHaveBeenCalled();
            expect(mockDeviceManager.revokeDetectedDevice).not.toHaveBeenCalled();
        });
    });

    describe('catch-up for a provider joining an already-running observer', () => {
        it('re-announces an already-managed device when a second provider starts', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start(); // first provider - full discovery, announces once
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledOnce();

            await observer.start(); // second provider joins while already running, without a rescan

            // Re-announced unconditionally - announceDetectedDevice() itself is a no-op for a
            // device that's already claimed/connected, so the observer doesn't need to check first.
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledTimes(2);
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DetectionId.create('SN001') }),
            );
        });
    });
});
