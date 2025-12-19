import Device, {DeviceData} from "../device.js";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";

type NoConstructor<T> = Pick<T, keyof T>;

export default class DelegateDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly map: Map<NoConstructor<typeof Device>, DeviceUpdaterInterface> = new Map();

    public add<D extends DeviceData>(deviceType: NoConstructor<typeof Device<D>>, updater: DeviceUpdaterInterface) {
        this.map.set(deviceType, updater);
    }

    public update(device: Device, deviceData: DeviceData): void {
        const result = this.map.get(device.constructor);
        if (result === undefined) {
            throw new Error(`Cannot update device of type '${device.constructor.name}': no updater found`);
        }

        result.update(device, deviceData);
    }
}
