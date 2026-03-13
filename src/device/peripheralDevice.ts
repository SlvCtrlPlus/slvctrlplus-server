import Device, { DeviceAttributes } from './device.js';
import DeviceTransport from './transport/deviceTransport.js';
import DeviceProtocol, { MessageResponse } from './protocol/deviceProtocol.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import EventEmitter from 'events';

export type InferPeripheralDeviceAttributes<D extends PeripheralDevice<any, DeviceAttributes, AnyDeviceConfig>> =
    D extends PeripheralDevice<any, infer TAttrs, any> ? TAttrs : DeviceAttributes;

export type InferPeripheralDeviceConfig<D extends PeripheralDevice<any, DeviceAttributes, AnyDeviceConfig>> =
    D extends PeripheralDevice<any, any, infer TCfg> ? TCfg : AnyDeviceConfig;

export default abstract class PeripheralDevice<
    TProtocol extends DeviceProtocol<MessageResponse<any, any>>,
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> extends Device<TAttributes, TConfig>
{
    protected readonly transport: DeviceTransport;

    protected readonly protocol: TProtocol;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        protocol: TProtocol,
        transport: DeviceTransport,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config, eventEmitter);

        this.protocol = protocol;
        this.transport = transport;

        this.transport.onClose(async () => await this.close());
    }

    public async close(): Promise<void> {
        if (this.transport.isOpen()) {
            await this.transport.close();
        }

        await super.close();
    }
}
