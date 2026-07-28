import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EStim2bSerialDeviceProvider from '../../../../../src/device/protocol/estim2b/estim2bSerialDeviceProvider.js';
import EStim2bDeviceFactory from '../../../../../src/device/protocol/estim2b/estim2bDeviceFactory.js';
import SerialDeviceTransportFactory from '../../../../../src/device/transport/serialDeviceTransportFactory.js';
import SerialPortFactory from '../../../../../src/factory/serialPortFactory.js';
import SerialPortObserver from '../../../../../src/device/transport/serialPortObserver.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('EStim2bSerialDeviceProvider', () => {
    const create = (
        deviceManager = mock<DeviceManager>(),
        serialPortFactory = mock<SerialPortFactory>(),
        serialPortObserver = mock<SerialPortObserver>(),
        transportFactory = mock<SerialDeviceTransportFactory>(),
        deviceFactory = mock<EStim2bDeviceFactory>(),
        logger = (() => { const l = mock<Logger>(); l.child.mockReturnValue(l); return l; })()
    ) => ({
        provider: new EStim2bSerialDeviceProvider(
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

        expect(provider).toBeInstanceOf(EStim2bSerialDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: EStim2bSerialDeviceProvider.name });
    });

    it('delegates doStart()/doStop() to the injected SerialPortObserver', async () => {
        const { provider, serialPortObserver } = create();

        await provider.start();
        expect(serialPortObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(serialPortObserver.stop).toHaveBeenCalledTimes(1);
    });
});