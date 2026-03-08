import Device, { DeviceAttributes } from './device.js';
import DeviceTransport from './transport/deviceTransport.js';
import DeviceProtocol, { MessageResponse } from './protocol/deviceProtocol.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';

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
        config: TConfig
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config);

        this.protocol = protocol;
        this.transport = transport;
    }
}
