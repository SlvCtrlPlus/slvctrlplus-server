import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import Zc95SerialDeviceProvider from '../../../../../src/device/protocol/zc95/zc95SerialDeviceProvider.js';
import Zc95DeviceFactory from '../../../../../src/device/protocol/zc95/zc95DeviceFactory.js';
import SerialDeviceTransportFactory from '../../../../../src/device/transport/serialDeviceTransportFactory.js';
import SerialPortFactory from '../../../../../src/factory/serialPortFactory.js';
import SerialPortObserver from '../../../../../src/device/transport/serialPortObserver.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('Zc95SerialDeviceProvider', () => {
    const create = (
        deviceManager = mock<DeviceManager>(),
        serialPortFactory = mock<SerialPortFactory>(),
        serialPortObserver = mock<SerialPortObserver>(),
        transportFactory = mock<SerialDeviceTransportFactory>(),
        deviceFactory = mock<Zc95DeviceFactory>(),
        logger = (() => { const l = mock<Logger>(); l.child.mockReturnValue(l); return l; })()
    ) => ({
        provider: new Zc95SerialDeviceProvider(
            deviceManager,
            serialPortFactory,
            serialPortObserver,
            transportFactory,
            deviceFactory,
            logger
        ),
        serialPortObserver,
        logger,
    });

    it('constructs with the reduced constructor signature and names its child logger after the class', () => {
        const { provider, logger } = create();

        expect(provider).toBeInstanceOf(Zc95SerialDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: Zc95SerialDeviceProvider.name });
    });

    it('delegates doStart()/doStop() to the injected SerialPortObserver', async () => {
        const { provider, serialPortObserver } = create();

        await provider.start();
        expect(serialPortObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(serialPortObserver.stop).toHaveBeenCalledTimes(1);
    });
});