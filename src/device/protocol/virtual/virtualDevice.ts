import { Exclude, Expose } from 'class-transformer';
import type { AttributeKeyOf, AttributeValueOf, DeviceInfo, NoDeviceNotifications } from '../../device.js';
import Device from '../../device.js';
import DeviceState from '../../deviceState.js';
import type { AnyVirtualDeviceLogic, ExtractAttributes, ExtractConfig } from './virtualDeviceLogic.js';
import type VirtualDeviceLogic from './virtualDeviceLogic.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';
import { normalizeError } from '../../../util/typeUtils.js';

export type AnyVirtualDevice = VirtualDevice<AnyVirtualDeviceLogic>;

// intersection makes TLogic's extracted attributes/config resolvable here (opaque TLogic alone can't)
type TypedDeviceLogic<TLogic extends AnyVirtualDeviceLogic> = VirtualDeviceLogic<ExtractAttributes<TLogic>, ExtractConfig<TLogic>> & TLogic;

// Excludes undefined: attribute values can only be undefined at construction (see DeviceAttribute's
// setter), so setAttribute callers must use null to represent "no value" post-construction.
type AttributeValue<TLogic extends AnyVirtualDeviceLogic, K extends AttributeKeyOf<ExtractAttributes<TLogic>>> =
    Exclude<AttributeValueOf<ExtractAttributes<TLogic>, K>, undefined>;

@Exclude()
export default class VirtualDevice<
    TLogic extends AnyVirtualDeviceLogic,
> extends Device<ExtractAttributes<TLogic>, NoDeviceNotifications, ExtractConfig<TLogic>> {
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly deviceModel: string;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly fwVersion: string;

    private readonly deviceLogic: TypedDeviceLogic<TLogic>;

    public constructor(
        deviceInfo: DeviceInfo,
        fwVersion: string,
        deviceModel: string,
        config: ExtractConfig<TLogic>,
        deviceLogic: TypedDeviceLogic<TLogic>,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, deviceLogic.configureAttributes(), config, eventEmitter, logger);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.deviceLogic = deviceLogic;
    }

    public override get getRefreshInterval(): number {
        return this.deviceLogic.refreshInterval;
    }

    public async setAttribute<
        K extends AttributeKeyOf<ExtractAttributes<TLogic>>,
    >(attributeName: K, value: AttributeValue<TLogic, K>): Promise<AttributeValue<TLogic, K>> {
        return new Promise<AttributeValue<TLogic, K>>((resolve, reject) => {
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
}
