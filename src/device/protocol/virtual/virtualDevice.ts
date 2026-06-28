import { Exclude, Expose } from 'class-transformer';
import BaseError from 'modern-errors';
import Device, { AttributeKeyOf, AttributeValueOf, NoDeviceNotifications } from '../../device.js';
import DeviceState from '../../deviceState.js';
import VirtualDeviceLogic, { ExtractAttributes, ExtractConfig } from './virtualDeviceLogic.js';
import { AnyDeviceConfig } from '../../deviceConfig.js';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { DeviceId } from '../../deviceId.js';

@Exclude()
export default class VirtualDevice<
    TLogic extends VirtualDeviceLogic<any, AnyDeviceConfig>
> extends Device<ExtractAttributes<TLogic>, NoDeviceNotifications, ExtractConfig<TLogic>> {
    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: TLogic;

    private readonly logger: Logger;

    private readonly statusUpdater?: NodeJS.Timeout;

    public constructor(
        fwVersion: string,
        deviceId: DeviceId,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: ExtractConfig<TLogic>,
        deviceLogic: TLogic,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, deviceLogic.configureAttributes(), config, eventEmitter);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.deviceLogic = deviceLogic;
        this.logger = logger;
    }

    protected override async doClose(): Promise<void> {
        await this.deviceLogic.destroy();
    }

    protected override async doRefresh(): Promise<void> {
        try {
            await this.deviceLogic.refreshData(this);
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.state = DeviceState.error;
            this.errorInfo = {
                reason: error.message ?? 'Unknown error',
                occurredAt: new Date(),
            };

            throw error;
        }
    }

    public override get getRefreshInterval(): number {
        return this.deviceLogic.refreshInterval;
    }

    public async setAttribute<
        K extends AttributeKeyOf<ExtractAttributes<TLogic>>
    >(attributeName: K, value: AttributeValueOf<K>): Promise<AttributeValueOf<K>> {
        return new Promise<AttributeValueOf<K>>((resolve, reject) => {
            this.state = DeviceState.busy;

            const attribute = this.attributes[attributeName];

            if (undefined === attribute || null === attribute) {
                reject(new Error(
                    `Attribute named "${attributeName}" does not exist for device with id "${this.deviceId}"`
                ));
                return;
            }

            attribute.value = value;

            this.state = DeviceState.ready;

            resolve(value);
        });
    }
}
