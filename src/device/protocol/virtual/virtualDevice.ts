import {Expose, Exclude} from "class-transformer";
import Device from "../../device.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import DeviceState from "../../deviceState.js";

@Exclude()
export default abstract class VirtualDevice extends Device
{

    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly config: JsonObject;

    @Expose()
    private readonly fwVersion: string;

    protected constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        config: JsonObject,
        attributes: GenericDeviceAttribute[],
    ) {
        super(deviceId, deviceName, provider, connectedSince, false, attributes);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.config = config;
    }

    public refreshData(): Promise<void> {
        // no-op for the generic virtual device
        // can be overwritten if the device needs to do some custom logic
        // like pulling info from an API, etc. on a regular basis
        return new Promise<void>((resolve) => resolve());
    }

    public get getRefreshInterval(): number {
        // Defines how often the refreshData() method is called.
        // Can be overwritten if the device needs to be updated
        // with a different pace.
        return 175;
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
