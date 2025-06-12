import {Expose, Exclude} from "class-transformer";
import Device from "../../device.js";
import DeviceState from "../../deviceState.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";

@Exclude()
export default class VirtualDevice extends Device
{

    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly config: JsonObject;

    @Expose()
    private readonly fwVersion: string;

    private readonly deviceLogic: VirtualDeviceLogic;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: JsonObject,
        deviceLogic: VirtualDeviceLogic
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

    public async setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string> {
        return new Promise<string>((resolve) => {
            this.state = DeviceState.busy;

            this.data[attributeName] = value;

            this.state = DeviceState.ready;

            resolve(`${attributeName}=${value}`);
        });
    }

    public getAttribute(key: string): any
    {
        return this.data[key];
    }
}
