import { AnyDevice, DeviceData } from '../device.js';
import DeviceUpdaterInterface from './deviceUpdaterInterface.js';
import { SequentialTaskQueue } from '@timesplinter/sequential-task-queue';

export default class BufferedDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly decoratedDeviceUpdater: DeviceUpdaterInterface;

    private readonly queue: SequentialTaskQueue;

    private static readonly handleUpdate = async (
        deviceUpdater: DeviceUpdaterInterface,
        device: AnyDevice,
        deviceData: DeviceData
    ): Promise<void> => {
        await deviceUpdater.update(device, deviceData);
    };

    public constructor(decoratedDeviceUpdater: DeviceUpdaterInterface) {
        this.decoratedDeviceUpdater = decoratedDeviceUpdater;
        this.queue = new SequentialTaskQueue();
    }

    public async update(device: AnyDevice, deviceData: DeviceData): Promise<void> {
        await this.queue.push(BufferedDeviceUpdater.handleUpdate, { args: [this.decoratedDeviceUpdater, device, deviceData] });
    }
}
