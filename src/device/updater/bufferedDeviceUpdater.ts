import Device from "../device.js";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";
import {SequentialTaskQueue} from "sequential-task-queue";
import type {DeviceData} from "../types.js";

export default class BufferedDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly decoratedDeviceUpdater: DeviceUpdaterInterface;

    private readonly queue: SequentialTaskQueue;

    public constructor(decoratedDeviceUpdater: DeviceUpdaterInterface) {
        this.decoratedDeviceUpdater = decoratedDeviceUpdater;
        this.queue = new SequentialTaskQueue();
    }

    public update(device: Device, deviceData: DeviceData): void {
        void this.queue.push(BufferedDeviceUpdater.handleUpdate, { args: [this.decoratedDeviceUpdater, device, deviceData] });
    }

    private static handleUpdate(
        this: void,
        deviceUpdater: DeviceUpdaterInterface,
        device: Device,
        deviceData: DeviceData
    ): void {
        deviceUpdater.update(device, deviceData);
    }
}
