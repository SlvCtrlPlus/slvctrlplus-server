import {Exclude, Expose, Transform} from "class-transformer";
import KnownDevice from "./knownDevice.js";
import createMapTransformFn from "../util/createMapTransformFn.js";
import DeviceSource from "./deviceSource.js";

@Exclude()
export default class Settings
{
    @Expose()
    @Transform(createMapTransformFn(KnownDevice))
    private readonly knownDevices: Map<string, KnownDevice> = new Map();

    @Expose()
    @Transform(createMapTransformFn(DeviceSource))
    private readonly deviceSources: Map<string, DeviceSource> = new Map();

    public getDeviceSources(): Map<string, DeviceSource> {
        return this.deviceSources;
    }

    public getKnownDevices(): Map<string, KnownDevice> {
        return this.knownDevices;
    }

    public getKnownDevicesBySource(sourceName: string): Map<string, KnownDevice> {
        const filteredDevices = new Map<string, KnownDevice>();

        for (const [key, value] of this.knownDevices) {
            if (value.source === sourceName) {
                filteredDevices.set(key, value);
            }
        }

        return filteredDevices;
    }

    public getKnownDeviceById(id: string): KnownDevice|null
    {
        if (this.knownDevices.has(id)) {
            // Return already existing device if already known (previously detected serial number)
            return this.knownDevices.get(id);
        }

        return null;
    }

    public addKnownDevice(knownDevice: KnownDevice): void
    {
        this.knownDevices.set(knownDevice.serialNo, knownDevice);
    }

    public addDeviceSource(deviceSource: DeviceSource): void
    {
        this.deviceSources.set(deviceSource.id, deviceSource);
    }
}
