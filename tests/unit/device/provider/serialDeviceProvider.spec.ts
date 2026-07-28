import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SerialPortStream } from '@serialport/stream';
import { BindingInterface } from '@serialport/bindings-interface';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../../../src/device/provider/serialDeviceProvider.js';
import SerialPortFactory from '../../../../src/factory/serialPortFactory.js';
import SerialPortObserver, { SerialDeviceDetectionInfo } from '../../../../src/device/transport/serialPortObserver.js';
import DeviceManager from '../../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../../src/device/device.js';
import Logger from '../../../../src/logging/Logger.js';

// SerialDeviceProvider is abstract; this concrete subclass exists purely to exercise the base
// class's constructor and doStart()/doStop() delegation.
class TestSerialDeviceProvider extends SerialDeviceProvider<AnyDevice>
{
    public constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        serialPortObserver: SerialPortObserver,
        logger: Logger
    ) {
        super(deviceManager, serialPortFactory, serialPortObserver, logger);
    }

    protected connectSerialDevice(
        _deviceDetectionInfo: SerialDeviceDetectionInfo,
        _port: SerialPortStream<BindingInterface>
    ): Promise<AnyDevice | undefined> {
        return Promise.resolve(undefined);
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }
}

describe('SerialDeviceProvider', () => {
    it('constructs with the reduced constructor signature', () => {
        const deviceManager = mock<DeviceManager>();
        const serialPortFactory = mock<SerialPortFactory>();
        const serialPortObserver = mock<SerialPortObserver>();
        const logger = mock<Logger>();

        const provider = new TestSerialDeviceProvider(deviceManager, serialPortFactory, serialPortObserver, logger);

        expect(provider).toBeInstanceOf(SerialDeviceProvider);
    });

    it('delegates doStart()/doStop() to the injected SerialPortObserver', async () => {
        const deviceManager = mock<DeviceManager>();
        const serialPortFactory = mock<SerialPortFactory>();
        const serialPortObserver = mock<SerialPortObserver>();
        const logger = mock<Logger>();

        const provider = new TestSerialDeviceProvider(deviceManager, serialPortFactory, serialPortObserver, logger);

        await provider.start();
        expect(serialPortObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(serialPortObserver.stop).toHaveBeenCalledTimes(1);
    });
});