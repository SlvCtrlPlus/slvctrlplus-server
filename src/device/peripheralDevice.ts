import Device, { DeviceAttributes, DeviceNotifications, NoDeviceNotifications } from './device.js';
import BidirectionalDeviceTransport from './transport/deviceBidirectionalTransport.js';
import DeviceProtocol, { MessageWithResponse } from './protocol/deviceProtocol.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import EventEmitter from 'events';
import { DeviceId } from './deviceId.js';

export type InferPeripheralDeviceAttributes<D extends PeripheralDevice<any, any, any, any>> =
    D extends PeripheralDevice<any, infer TAttrs, any, any> ? TAttrs : DeviceAttributes;

export type InferPeripheralDeviceConfig<D extends PeripheralDevice<any, any, any, any>> =
    D extends PeripheralDevice<any, any, any, infer TCfg> ? TCfg : AnyDeviceConfig;

export default abstract class PeripheralDevice<
    TProtocol extends DeviceProtocol<MessageWithResponse<any, any>>,
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> extends Device<TAttributes, TNotifications, TConfig>
{
    protected readonly transport: BidirectionalDeviceTransport;

    protected readonly protocol: TProtocol;

    protected constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        protocol: TProtocol,
        transport: BidirectionalDeviceTransport,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config, eventEmitter);

        this.protocol = protocol;
        this.transport = transport;

        this.transport.onClose(async () => await this.close());
    }

    protected override async doClose(): Promise<void> {
        if (this.transport.isOpen()) {
            await this.transport.close();
        }
    }
}
