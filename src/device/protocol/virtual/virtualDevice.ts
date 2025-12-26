import {Expose, Exclude} from "class-transformer";
import Device, {AttributeValue, DeviceAttributes} from "../../device.js";
import DeviceState from "../../deviceState.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";

@Exclude()
export default class VirtualDevice<T extends DeviceAttributes = DeviceAttributes> extends Device<T>
{

    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly config: JsonObject;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: VirtualDeviceLogic<T>;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: JsonObject,
        deviceLogic: VirtualDeviceLogic<T>
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, deviceLogic.configureAttributes());

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.config = config;
        this.deviceLogic = deviceLogic;
    }

    public async refreshData(): Promise<void> {
        return this.deviceLogic.refreshData(this);
    }

    public get getRefreshInterval(): number {
        return this.deviceLogic.getRefreshInterval;
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
