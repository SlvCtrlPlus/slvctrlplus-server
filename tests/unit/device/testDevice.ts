import Device from "../../../src/device/device.js";

export default class TestDevice extends Device
{
    public constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean
    ) {
        super(deviceId, deviceName, connectedSince, controllable);
    }

    refreshData(): void
    {
        // noop
    }
}
