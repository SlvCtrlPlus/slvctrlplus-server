import {Exclude, Expose} from "class-transformer";
import Device, {AttributeValue, DeviceAttributes} from "../../device.js";
import DeviceState from "../../deviceState.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";
import {AnyDeviceConfig} from "../../anyDeviceConfig.js";

@Exclude()
export default class VirtualDevice<T extends DeviceAttributes = DeviceAttributes, C extends AnyDeviceConfig = AnyDeviceConfig> extends Device<T>
{
    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly config: C;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: VirtualDeviceLogic<T, C>;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: C,
        deviceLogic: VirtualDeviceLogic<T, C>
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

    public async setAttribute<K extends keyof T, V extends AttributeValue<T[K]>>(attributeName: K, value: V): Promise<V> {
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
