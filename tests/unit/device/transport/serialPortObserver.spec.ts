import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SerialPort } from 'serialport';
import { usb } from 'usb';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import SerialPortObserver from '../../../../src/device/transport/serialPortObserver.js';
import { DeviceId } from '../../../../src/device/deviceId.js';

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
    // usb.addEventListener() is not mocked, so every observer created in a test must have its
    // listeners torn down again afterwards - otherwise they pile up across the whole file's test
    // run and eventually trip Node's MaxListenersExceededWarning.
    let createdObservers: SerialPortObserver[];

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
        const observer = new SerialPortObserver(mockDeviceManager, mockLogger);
        createdObservers.push(observer);
        return observer;
    }

    beforeEach(() => {
        vi.useFakeTimers();

        mockDeviceManager = mock<DeviceManager>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);
        createdObservers = [];
    });

    afterEach(async () => {
        // Each observer's own reference count may need more than one stop() call to actually
        // tear down its listeners (see the reference-counting tests below) - stop() is a safe
        // no-op once fully stopped, so calling it repeatedly here is fine.
        for (const observer of createdObservers) {
            await observer.stop();
            await observer.stop();
        }

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
                expect.objectContaining({ detectionId: DeviceId.create('SN001'), portInfo: port }),
            );
        });

        it('generates a synthetic serial number when serialNumber is undefined', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: undefined, vendorId: '0403', productId: '6001', locationId: 'port1' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();

            const expectedSn = 'serial-0403-6001-port1';
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DeviceId.create(expectedSn) }),
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
                expect.objectContaining({ detectionId: DeviceId.create('SN001') }),
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
                expect.objectContaining({ detectionId: DeviceId.create('SN001') }),
            );
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ detectionId: DeviceId.create('SN002') }),
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
});
