import Device from "./device.js";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";
import {SequentialTaskQueue} from "sequential-task-queue";
import {DeviceData} from "./types";

export default class BufferedDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly decoratedDeviceUpdater: DeviceUpdaterInterface;

    private readonly queue: SequentialTaskQueue;

    public constructor(decoratedDeviceUpdater: DeviceUpdaterInterface) {
        this.decoratedDeviceUpdater = decoratedDeviceUpdater;
        this.queue = new SequentialTaskQueue();
    }

    public update(device: Device, deviceData: DeviceData): void {
        void this.queue.push(this.handleUpdate, { args: [this.decoratedDeviceUpdater, device, deviceData] });
    }

    private async handleUpdate(
        deviceUpdater: DeviceUpdaterInterface,
        device: Device,
        deviceData: DeviceData
    ): Promise<void> {
        return deviceUpdater.update(device, deviceData);
    }
}
