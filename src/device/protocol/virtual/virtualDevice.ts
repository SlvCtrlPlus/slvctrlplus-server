import {Exclude} from "class-transformer";
import Device from "../../device.js";

@Exclude()
export default abstract class VirtualDevice extends Device
{
}
