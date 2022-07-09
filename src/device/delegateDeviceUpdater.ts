import Device from "./device.js";
import {Request} from "express";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";

type DeviceClass = new (...args: any[]) => any;

export default class DelegateDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly map: Map<unknown, DeviceUpdaterInterface> = new Map();

    public add(deviceType: unknown, updater: DeviceUpdaterInterface) {
        this.map.set(deviceType, updater);
    }

    public update(device: Device, request: Request): void {
        const result = this.map.get(device.constructor);
        if (result === undefined) {
            throw new Error(`Cannot update device of type '${device.constructor.name}': no updater found`);
        }

        result.update(device, request);
    }
}
