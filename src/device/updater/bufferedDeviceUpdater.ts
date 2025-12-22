import Device, {DeviceAttributes, DeviceData} from "../device.js";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";
import {SequentialTaskQueue} from "sequential-task-queue";

export default class BufferedDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly decoratedDeviceUpdater: DeviceUpdaterInterface;

    private readonly queue: SequentialTaskQueue;

    public constructor(decoratedDeviceUpdater: DeviceUpdaterInterface) {
        this.decoratedDeviceUpdater = decoratedDeviceUpdater;
        this.queue = new SequentialTaskQueue();
    }

    public async update(device: Device, deviceData: DeviceData): Promise<void> {
        await this.queue.push(BufferedDeviceUpdater.handleUpdate, { args: [this.decoratedDeviceUpdater, device, deviceData] });
    }

    private static async handleUpdate(
        this: void,
        deviceUpdater: DeviceUpdaterInterface,
        device: Device,
        deviceData: DeviceData
    ): Promise<void> {
        await deviceUpdater.update(device, deviceData);
    }
}
