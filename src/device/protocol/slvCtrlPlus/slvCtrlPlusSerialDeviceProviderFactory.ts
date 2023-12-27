import DeviceProvider from "../../provider/deviceProvider.js";
import SlvCtrlPlusDeviceFactory from "./slvCtrlPlusDeviceFactory.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../../transport/serialDeviceTransportFactory.js";
import SlvCtrlPlusSerialDeviceProvider from "./slvCtrlPlusSerialDeviceProvider.js";
import DeviceProviderFactory from "../../provider/deviceProviderFactory.js";

export default class SlvCtrlPlusSerialDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly eventEmitter: EventEmitter;

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory
    ) {
        this.eventEmitter = eventEmitter;
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    public create(): DeviceProvider
    {
        // Scan for new SlvCtrl+ protocol serial devices every 3 seconds
        return new SlvCtrlPlusSerialDeviceProvider(
            this.eventEmitter,
            this.slvCtrlPlusDeviceFactory,
            this.deviceTransportFactory
        );
    }
}
