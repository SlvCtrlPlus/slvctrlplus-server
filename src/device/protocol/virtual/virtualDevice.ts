import { Exclude, Expose } from 'class-transformer';
import Device, { ExtractAttributeValue } from '../../device.js';
import DeviceState from '../../deviceState.js';
import VirtualDeviceLogic, { ExtractAttributes, ExtractConfig } from './virtualDeviceLogic.js';
import { AnyDeviceConfig } from '../../deviceConfig.js';

@Exclude()
export default class VirtualDevice<
    TLogic extends VirtualDeviceLogic<any, AnyDeviceConfig>
> extends Device<ExtractAttributes<TLogic>, ExtractConfig<TLogic>> {
    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: TLogic;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: ExtractConfig<TLogic>,
        deviceLogic: TLogic
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, deviceLogic.configureAttributes(), config);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
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
            };

            throw e;
        }
    }

    public get getRefreshInterval(): number {
        return this.deviceLogic.refreshInterval;
    }

    public async setAttribute<
        K extends keyof ExtractAttributes<TLogic>,
        V extends ExtractAttributeValue<ExtractAttributes<TLogic>[K]>
    >(attributeName: K, value: V): Promise<V> {
        return new Promise<V>((resolve, reject) => {
            this.state = DeviceState.busy;

            const attribute = this.attributes[attributeName];

            if (undefined === attribute || null === attribute) {
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
