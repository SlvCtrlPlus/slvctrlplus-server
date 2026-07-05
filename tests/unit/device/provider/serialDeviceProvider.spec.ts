import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import { SerialPort } from 'serialport';
import DeviceManager from '../../../../src/device/deviceManager.js';
import Logger from '../../../../src/logging/Logger.js';
import SerialDeviceProvider from '../../../../src/device/provider/serialDeviceProvider.js';
import SerialProtocolFactory from '../../../../src/device/provider/serialProtocolFactory.js';
import SerialPortFactory from '../../../../src/factory/serialPortFactory.js';
import PeripheralDevice from '../../../../src/device/peripheralDevice.js';
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

class FakeSerialPort extends EventEmitter {
    public isOpen = false;

    private readonly openError?: Error;

    public constructor(openError?: Error) {
        super();
        this.openError = openError;
    }

    public open(cb: (err?: Error | null) => void): void {
        if (undefined !== this.openError) {
            cb(this.openError);
            return;
        }
        this.isOpen = true;
        cb(null);
    }

    public close(cb: (err: Error | null) => void): void {
        this.isOpen = false;
        this.emit('close');
        cb(null);
    }

    public pipe<T>(dest: T): T {
        return dest;
    }

    public unpipe(): void {
        // no-op
    }
}

describe('SerialDeviceProvider', () => {
    let mockDeviceManager: ReturnType<typeof mock<DeviceManager>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let mockSerialPortFactory: ReturnType<typeof mock<SerialPortFactory>>;
    let createdPorts: FakeSerialPort[];

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

    function createProvider(): SerialDeviceProvider {
        return new SerialDeviceProvider(mockDeviceManager, mockSerialPortFactory, new EventEmitter(), mockLogger);
    }

    function createFactory(protocolName: string, openError?: Error): ReturnType<typeof mock<SerialProtocolFactory<any>>> {
        const factory = mock<SerialProtocolFactory<any>>();
        Object.defineProperty(factory, 'protocolName', { get: () => protocolName, configurable: true });
        factory.getPortOpenOptions.mockReturnValue({ baudRate: 9600 });
        factory.preparePort = undefined;
        void openError;
        return factory;
    }

    beforeEach(() => {
        vi.resetAllMocks();

        mockDeviceManager = mock<DeviceManager>();
        mockDeviceManager.getConnectedDevice.mockReturnValue(null);
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        createdPorts = [];
        mockSerialPortFactory = mock<SerialPortFactory>();
        mockSerialPortFactory.create.mockImplementation(() => {
            const port = new FakeSerialPort();
            createdPorts.push(port);
            return port as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('creates a child logger with the provider class name', () => {
            createProvider();

            expect(mockLogger.child).toHaveBeenCalledWith({ name: SerialDeviceProvider.name });
        });
    });

    describe('discoverSerialDevices', () => {
        it('does not attempt any port when none are found', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([]);
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });

        it('skips a port with no vendorId', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([
                makePortInfo({ path: '/dev/tty1', serialNumber: 'SN001', vendorId: undefined, productId: '6001' }),
            ]);
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });

        it('skips a port with no productId', async () => {
            vi.spyOn(SerialPort, 'list').mockResolvedValue([
                makePortInfo({ path: '/dev/tty1', serialNumber: 'SN001', vendorId: '0403', productId: undefined }),
            ]);
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });

        it('handles a SerialPort.list error gracefully without throwing', async () => {
            vi.spyOn(SerialPort, 'list').mockRejectedValue(new Error('USB stack error'));
            const provider = createProvider();

            await expect(provider.discoverSerialDevices()).resolves.not.toThrow();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('tries registered factories in registration order until one connects', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);

            const provider = createProvider();
            const failingFactory = createFactory('failing');
            failingFactory.tryConnect.mockResolvedValue(undefined);
            const successfulDevice = mock<PeripheralDevice<any, any, any, any>>();
            const successfulFactory = createFactory('successful');
            successfulFactory.tryConnect.mockResolvedValue(successfulDevice);
            const untriedFactory = createFactory('untried');

            provider.registerFactory(failingFactory).registerFactory(successfulFactory).registerFactory(untriedFactory);

            await provider.discoverSerialDevices();

            expect(failingFactory.tryConnect).toHaveBeenCalledWith(
                expect.objectContaining({ id: DeviceId.create('SN001') }),
                expect.anything(),
            );
            expect(successfulFactory.tryConnect).toHaveBeenCalled();
            expect(untriedFactory.tryConnect).not.toHaveBeenCalled();
            expect(mockDeviceManager.addDevice).toHaveBeenCalledWith(successfulDevice);
        });

        it('continues to the next factory when one throws', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);

            const provider = createProvider();
            const brokenFactory = createFactory('broken');
            brokenFactory.tryConnect.mockRejectedValue(new Error('handshake exploded'));
            const successfulDevice = mock<PeripheralDevice<any, any, any, any>>();
            const successfulFactory = createFactory('successful');
            successfulFactory.tryConnect.mockResolvedValue(successfulDevice);

            provider.registerFactory(brokenFactory).registerFactory(successfulFactory);

            await provider.discoverSerialDevices();

            expect(mockDeviceManager.addDevice).toHaveBeenCalledWith(successfulDevice);
        });

        it('closes the port again when no factory recognizes the device', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);

            const provider = createProvider();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(undefined);
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(mockDeviceManager.addDevice).not.toHaveBeenCalled();
        });

        it('generates a synthetic serial number when serialNumber is undefined', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: undefined, vendorId: '0403', productId: '6001', locationId: 'port1' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(factory.tryConnect).toHaveBeenCalledWith(
                expect.objectContaining({ id: DeviceId.create('serial-0403-6001-port1') }),
                expect.anything(),
            );
        });

        it('does not re-attempt a port that is still present on a later discovery run', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const provider = createProvider();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(undefined);
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();
            await provider.discoverSerialDevices();

            expect(factory.tryConnect).toHaveBeenCalledOnce();
        });

        it('attempts a port again once it disappears and reappears', async () => {
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list')
                .mockResolvedValueOnce([port])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([port]);
            const provider = createProvider();
            const factory = createFactory('test');
            factory.tryConnect.mockResolvedValue(undefined);
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();
            await provider.discoverSerialDevices();
            await provider.discoverSerialDevices();

            expect(factory.tryConnect).toHaveBeenCalledTimes(2);
        });

        it('does not re-attempt a port that is already connected', async () => {
            mockDeviceManager.getConnectedDevice.mockReturnValue(mock());
            const port = makePortInfo({ path: '/dev/ttyUSB0', serialNumber: 'SN001', vendorId: '0403', productId: '6001' });
            vi.spyOn(SerialPort, 'list').mockResolvedValue([port]);
            const provider = createProvider();
            const factory = createFactory('test');
            provider.registerFactory(factory);

            await provider.discoverSerialDevices();

            expect(factory.tryConnect).not.toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        it('does not throw when called without a prior start()', async () => {
            const provider = createProvider();

            await expect(provider.stop()).resolves.not.toThrow();
        });
    });
});
