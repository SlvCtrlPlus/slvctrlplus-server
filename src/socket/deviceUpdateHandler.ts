import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/deviceUpdaterInterface.js";

export default class DeviceUpdateHandler
{
    private connectedDeviceRepository: ConnectedDeviceRepository;

    private deviceUpdater: DeviceUpdaterInterface;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, deviceUpdater: DeviceUpdaterInterface)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.deviceUpdater = deviceUpdater;
    }

    public handle(data: any): void {
        const deviceId = data.deviceId;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            return;
        }

        try {
            this.deviceUpdater.update(device, data.data);
        } catch (err: unknown) {
            console.log((err as Error).message);
        }
    }
}
