import DeviceProvider from '../../provider/deviceProvider.js';
import SlvCtrlPlusDeviceFactory from './slvCtrlPlusDeviceFactory.js';
import EventEmitter from 'events';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import SlvCtrlPlusSerialDeviceProvider from './slvCtrlPlusSerialDeviceProvider.js';
import DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import Logger from '../../../logging/Logger.js';
import SerialPortFactory from '../../provider/serialPortFactory.js';

export default class SlvCtrlPlusSerialDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly serialPortFactory: SerialPortFactory;

    private readonly eventEmitter: EventEmitter;

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    private readonly logger: Logger;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        this.serialPortFactory = serialPortFactory;
        this.eventEmitter = eventEmitter;
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
        this.logger = logger;
    }

    public create(): DeviceProvider {
        return new SlvCtrlPlusSerialDeviceProvider(
            this.serialPortFactory,
            this.eventEmitter,
            this.slvCtrlPlusDeviceFactory,
            this.deviceTransportFactory,
            this.logger
        );
    }
}
