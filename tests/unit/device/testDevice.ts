import Device from "../../../src/device/device.js";

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

    refreshData(): Promise<void>
    {
        // noop
        return new Promise((resolve) => resolve());
    }

    public setAttribute(attributeName: string, value: string | number | boolean): Promise<string> {
        throw new Error("Method not implemented.");
    }
}
