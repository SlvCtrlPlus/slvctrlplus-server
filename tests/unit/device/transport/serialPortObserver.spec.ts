import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SerialPort } from 'serialport';
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
                expect.objectContaining({ id: DeviceId.create('SN001'), portInfo: port }),
            );
        });

        it('generates a synthetic serial number when serialNumber is undefined', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: undefined, vendorId: '0403', productId: '6001', locationId: 'port1' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const observer = createObserver();

            await observer.start();

            const expectedSn = 'serial-0403-6001-port1';
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ id: DeviceId.create(expectedSn) }),
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
                expect.objectContaining({ id: DeviceId.create('SN001') }),
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
                expect.objectContaining({ id: DeviceId.create('SN001') }),
            );
            expect(mockDeviceManager.announceDetectedDevice).toHaveBeenCalledWith(
                expect.objectContaining({ id: DeviceId.create('SN002') }),
            );
        });
    });
});
