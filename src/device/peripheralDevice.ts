import type { DeviceAttributes, DeviceInfo, DeviceNotifications, NoDeviceNotifications, WithUntypedAttributes } from './device.js';
import Device from './device.js';
import type BidirectionalDeviceTransport from './transport/deviceBidirectionalTransport.js';
import type { AnyDeviceProtocol, AnyMessageWithResponse } from './protocol/deviceProtocol.js';
import type DeviceProtocol from './protocol/deviceProtocol.js';
import type { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import type EventEmitter from 'events';
import type Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

export type AnyPeripheralDevice = WithUntypedAttributes<PeripheralDevice<AnyDeviceProtocol>>;

export default abstract class PeripheralDevice<
    TProtocol extends DeviceProtocol<AnyMessageWithResponse>,
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends Device<TAttributes, TNotifications, TConfig>
{
    protected readonly transport: BidirectionalDeviceTransport;

    protected readonly protocol: TProtocol;

    protected constructor(
        deviceInfo: DeviceInfo,
        protocol: TProtocol,
        transport: BidirectionalDeviceTransport,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, attributes, config, eventEmitter, logger);

        this.protocol = protocol;
        this.transport = transport;

        this.transport.onClose(() => {
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
