import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/updater/deviceUpdaterInterface.js";
import {DeviceUpdateData} from "./types.js";
import Logger from "../logging/Logger.js";

export default class DeviceUpdateHandler
{
    private readonly connectedDeviceRepository: ConnectedDeviceRepository;

    private readonly deviceUpdater: DeviceUpdaterInterface;

    private readonly logger: Logger;

    public constructor(
        connectedDeviceRepository: ConnectedDeviceRepository,
        deviceUpdater: DeviceUpdaterInterface,
        logger: Logger
    ) {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.deviceUpdater = deviceUpdater;
        this.logger = logger;
    }

    public async handle(data: DeviceUpdateData): Promise<void> {
        const deviceId = data.deviceId;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            return;
        }

        try {
            await this.deviceUpdater.update(device, data.data);
        } catch (err: unknown) {
            this.logger.error((err as Error).message, err);
        }
    }
}
