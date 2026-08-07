import { Exclude, Expose } from 'class-transformer';
import Device, { AttributeKeyOf, AttributeValueOf, NoDeviceNotifications } from '../../device.js';
import DeviceState from '../../deviceState.js';
import VirtualDeviceLogic, { AnyVirtualDeviceLogic, ExtractAttributes, ExtractConfig } from './virtualDeviceLogic.js';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { DeviceId } from '../../deviceId.js';
import { normalizeError } from '../../../util/typeUtils.js';

export type AnyVirtualDevice = VirtualDevice<AnyVirtualDeviceLogic>;

// intersection makes TLogic's extracted attributes/config resolvable here (opaque TLogic alone can't)
type TypedDeviceLogic<TLogic extends AnyVirtualDeviceLogic> = VirtualDeviceLogic<ExtractAttributes<TLogic>, ExtractConfig<TLogic>> & TLogic;

@Exclude()
export default class VirtualDevice<
    TLogic extends AnyVirtualDeviceLogic,
> extends Device<ExtractAttributes<TLogic>, NoDeviceNotifications, ExtractConfig<TLogic>> {
    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: TypedDeviceLogic<TLogic>;

    private readonly statusUpdater?: NodeJS.Timeout;

    public constructor(
        fwVersion: string,
        deviceId: DeviceId,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: ExtractConfig<TLogic>,
        deviceLogic: TypedDeviceLogic<TLogic>,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, deviceLogic.configureAttributes(), config, eventEmitter, logger);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.deviceLogic = deviceLogic;
    }

    protected override async doClose(): Promise<void> {
        await this.deviceLogic.destroy();
    }

    protected override async doRefresh(): Promise<void> {
        try {
            await this.deviceLogic.refreshData(this);
        } catch (e: unknown) {
            const error = normalizeError(e);
            this.state = DeviceState.error;
            this.errorInfo = {
                reason: error.message,
                occurredAt: new Date(),
            };

            throw error;
        }
    }

    public override get getRefreshInterval(): number {
        return this.deviceLogic.refreshInterval;
    }

    public async setAttribute<
        K extends AttributeKeyOf<ExtractAttributes<TLogic>>,
        V extends AttributeValueOf<ExtractAttributes<TLogic>, K>,
    >(attributeName: K, value: V): Promise<V> {
        return new Promise<V>((resolve, reject) => {
            this.state = DeviceState.busy;

            const attribute = this.attributes[attributeName];

            if (undefined === attribute) {
                reject(new Error(
                    `Attribute named "${attributeName}" does not exist for device with id "${this.deviceId}"`,
                ));
                return;
            }

            attribute.value = value;

            this.state = DeviceState.ready;

            resolve(value);
        });
    }
}
