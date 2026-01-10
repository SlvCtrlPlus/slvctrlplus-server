import { Exclude, Expose } from 'class-transformer';
import Device, { AttributeValue, DeviceAttributes } from '../../device.js';
import DeviceState from '../../deviceState.js';
import VirtualDeviceLogic from './virtualDeviceLogic.js';
import { AnyDeviceConfig } from '../../deviceConfig.js';

@Exclude()
export default class VirtualDevice<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = AnyDeviceConfig
> extends Device<TAttributes> {
    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly config: TConfig;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: VirtualDeviceLogic<TAttributes, TConfig>;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: TConfig,
        deviceLogic: VirtualDeviceLogic<TAttributes, TConfig>
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, deviceLogic.configureAttributes());

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.config = config;
        this.deviceLogic = deviceLogic;
    }

    public async refreshData(): Promise<void> {
        try {
            return await this.deviceLogic.refreshData(this);
        } catch (e: unknown) {
            this.state = DeviceState.error;
            this.errorInfo = {
                reason: (e as Error).message ?? 'Unknown error',
                occurredAt: new Date(),
            }
        }
    }

    public get getRefreshInterval(): number {
        return this.deviceLogic.refreshInterval;
    }

    public async setAttribute<K extends keyof TAttributes, V extends AttributeValue<TAttributes[K]>>(attributeName: K, value: V): Promise<V> {
        return new Promise<V>((resolve, reject) => {
            this.state = DeviceState.busy;

            const attribute = this.attributes[attributeName];

            if (undefined === attribute) {
                reject(new Error(
                    `Attribute named "${attributeName.toString()}" does not exist for device with id "${this.deviceId}"`
                ));
                return;
            }

            attribute.value = value;

            this.state = DeviceState.ready;

            resolve(value);
        });
    }
}
