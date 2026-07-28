import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import SlvCtrlPlusSerialDeviceProvider from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import SlvCtrlPlusDeviceFactory from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js';
import SerialDeviceTransportFactory from '../../../../../src/device/transport/serialDeviceTransportFactory.js';
import SerialPortFactory from '../../../../../src/factory/serialPortFactory.js';
import SerialPortObserver from '../../../../../src/device/transport/serialPortObserver.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('SlvCtrlPlusSerialDeviceProvider', () => {
    const create = (
        deviceManager = mock<DeviceManager>(),
        serialPortFactory = mock<SerialPortFactory>(),
        serialPortObserver = mock<SerialPortObserver>(),
        deviceFactory = mock<SlvCtrlPlusDeviceFactory>(),
        deviceTransportFactory = mock<SerialDeviceTransportFactory>(),
        logger = (() => { const l = mock<Logger>(); l.child.mockReturnValue(l); return l; })()
    ) => ({
        provider: new SlvCtrlPlusSerialDeviceProvider(
            deviceManager,
            serialPortFactory,
            serialPortObserver,
            deviceFactory,
            deviceTransportFactory,
            logger
        ),
        serialPortObserver,
        logger,
    });

    it('constructs with the reduced constructor signature and names its child logger after the class', () => {
        const { provider, logger } = create();

        expect(provider).toBeInstanceOf(SlvCtrlPlusSerialDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: SlvCtrlPlusSerialDeviceProvider.name });
    });

    it('delegates doStart()/doStop() to the injected SerialPortObserver', async () => {
        const { provider, serialPortObserver } = create();

        await provider.start();
        expect(serialPortObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(serialPortObserver.stop).toHaveBeenCalledTimes(1);
    });
});