import {Exclude, Expose, Transform} from "class-transformer";
import KnownDevice from "./knownDevice.js";
import createMapTransformFn from "../util/createMapTransformFn.js";

@Exclude()
export default class Settings
{
    @Expose()
    @Transform(createMapTransformFn(KnownDevice))
    private readonly knownDevices: Map<string, KnownDevice> = new Map();

    public getKnownDevices(): Map<string, KnownDevice> {
        return this.knownDevices;
    }
}
