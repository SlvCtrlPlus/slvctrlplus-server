import Device from "./device.js";
import {Request} from "express";

export default interface DeviceUpdaterInterface
{
    update(device: Device, request: Request): void;
}
