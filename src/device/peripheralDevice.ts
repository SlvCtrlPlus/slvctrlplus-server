import Device, { DeviceAttributes, DeviceNotifications, NoDeviceNotifications, WithUntypedAttributes } from './device.js';
import BidirectionalDeviceTransport from './transport/deviceBidirectionalTransport.js';
import DeviceProtocol, { MessageWithResponse } from './protocol/deviceProtocol.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import EventEmitter from 'events';
import { DeviceId } from './deviceId.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

export type AnyPeripheralDevice = WithUntypedAttributes<PeripheralDevice<DeviceProtocol<MessageWithResponse<any, any>>>>;

export default abstract class PeripheralDevice<
    TProtocol extends DeviceProtocol<MessageWithResponse<any, any>>,
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
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
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config, eventEmitter, logger);

        this.protocol = protocol;
        this.transport = transport;

        this.transport.onClose(async () => {
            this.close().catch((err: unknown) => logError(this.logger, 'Error closing device after transport close', err));
        });
    }

    public getTransport(): BidirectionalDeviceTransport {
        return this.transport;
    }

    protected override async doClose(): Promise<void> {
        if (this.transport.isOpen()) {
            await this.transport.close();
        }
    }
}
