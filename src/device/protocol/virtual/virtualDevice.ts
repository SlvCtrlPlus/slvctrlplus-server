import {Expose, Exclude} from "class-transformer";
import Device, {DeviceAttributes} from "../../device.js";
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

    public setAttribute<K extends keyof T>(attributeName: K, value: T[K]['value']): Promise<T[K]['value']> {
        return new Promise<T[K]['value']>((resolve) => {
            this.state = DeviceState.busy;

            this.attributes[attributeName].value = value;

            this.state = DeviceState.ready;

            resolve(value);
        });
    }
}
