import Device from "./device.js";
import {Request} from "express";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";
import {SequentialTaskQueue} from "sequential-task-queue";

export default class BufferedDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly decoratedDeviceUpdater: DeviceUpdaterInterface;

    private readonly queue: SequentialTaskQueue;

    constructor(decoratedDeviceUpdater: DeviceUpdaterInterface) {
        this.decoratedDeviceUpdater = decoratedDeviceUpdater;
        this.queue = new SequentialTaskQueue();
    }

    public update(device: Device, request: Request): void {
        this.queue.push(this.handleUpdate, { args: [this.decoratedDeviceUpdater, device, request] });
    }

    private async handleUpdate(deviceUpdater: DeviceUpdaterInterface, device: Device, request: Request): Promise<void> {
        return deviceUpdater.update(device, request);
    }
}
