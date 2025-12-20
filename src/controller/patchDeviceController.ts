import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/updater/deviceUpdaterInterface.js";
import {DeviceData} from "../device/device";

export default class PatchDeviceController implements ControllerInterface
{
    private connectedDeviceRepository: ConnectedDeviceRepository;

    private deviceUpdater: DeviceUpdaterInterface;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, deviceUpdater: DeviceUpdaterInterface)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.deviceUpdater = deviceUpdater;
    }

    public execute(req: Request, res: Response): void
    {
        const { deviceId } = req.params;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            res.sendStatus(404);
            return;
        }

        try {
            this.deviceUpdater.update(device, req.body as DeviceData);
        } catch (err: unknown) {
            res.send((err as Error).message).sendStatus(500);
        }

        res.sendStatus(202);
    }
}
