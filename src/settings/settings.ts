import {Exclude, Expose, Transform} from "class-transformer";
import KnownSerialDevice from "./knownSerialDevice.js";
import KnownButtplugIoDevice from "./knownButtplugIoDevice.js";
import createMapTransformFn from "../util/createMapTransformFn.js";
import ConfiguredVirtualDevice from "./configuredVirtualDevice.js";

@Exclude()
export default class Settings
{
    @Expose()
    @Transform(createMapTransformFn(KnownSerialDevice))
    private readonly knownSerialDevices: Map<string, KnownSerialDevice> = new Map();

    @Expose()
    @Transform(createMapTransformFn(KnownButtplugIoDevice))
    private readonly knownButtplugIoDevices: Map<string, KnownButtplugIoDevice> = new Map();

    @Expose()
    @Transform(createMapTransformFn(ConfiguredVirtualDevice))
    private readonly virtualDevices: Map<string, ConfiguredVirtualDevice> = new Map();

    public getKnownSerialDevices(): Map<string, KnownSerialDevice> {
        return this.knownSerialDevices;
    }

    public getKnownButtplugIoDevices(): Map<string, KnownButtplugIoDevice> {
        return this.knownButtplugIoDevices;
    }

    public getVirtualDevices(): Map<string, ConfiguredVirtualDevice> {
        return this.virtualDevices;
    }
}
