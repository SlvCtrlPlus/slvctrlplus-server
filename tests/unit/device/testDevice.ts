import Device, {AttributeValue, DeviceAttributes} from "../../../src/device/device.js";

export default class TestDevice extends Device
{
    public constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean
    ) {
        super(deviceId, deviceName, 'dummy', connectedSince, controllable, {});
    }

    public refreshData(): Promise<void>
    {
        // noop
        return new Promise((resolve) => resolve());
    }

    public setAttribute<
        K extends keyof DeviceAttributes,
        V extends AttributeValue<DeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        throw new Error("Method not implemented.");
    }
}
