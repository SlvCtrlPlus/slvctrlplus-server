import {Exclude, Expose, Transform} from "class-transformer";
import KnownSerialDevice from "./knownSerialDevice.js";
import createMapTransformFn from "../util/createMapTransformFn.js";
import VirtualDevice from "../device/virtualDevice.js";
import ConfiguredVirtualDevice from "./configuredVirtualDevice.js";

@Exclude()
export default class Settings
{
    @Expose()
    @Transform(createMapTransformFn(KnownSerialDevice))
    private readonly knownSerialDevices: Map<string, KnownSerialDevice> = new Map();

    @Expose()
    @Transform(createMapTransformFn(ConfiguredVirtualDevice))
    private readonly virtualDevices: Map<string, ConfiguredVirtualDevice> = new Map();

    public getKnownSerialDevices(): Map<string, KnownSerialDevice> {
        return this.knownSerialDevices;
    }

    public getVirtualDevices(): Map<string, ConfiguredVirtualDevice> {
        return this.virtualDevices;
    }
}
