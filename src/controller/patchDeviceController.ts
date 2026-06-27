import { Request, Response } from 'express';
import BaseError from 'modern-errors';
import ControllerInterface from './controllerInterface.js';
import ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import DeviceUpdaterInterface from '../device/updater/deviceUpdaterInterface.js';
import { DeviceData } from '../device/device.js';
import { DeviceId } from '../device/deviceId.js';

type PatchDeviceRequest = Request<{ deviceId: DeviceId }, any, DeviceData>;

export default class PatchDeviceController implements ControllerInterface
{
    private connectedDeviceRepository: ConnectedDeviceRepository;

    private deviceUpdater: DeviceUpdaterInterface;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, deviceUpdater: DeviceUpdaterInterface)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.deviceUpdater = deviceUpdater;
    }

    public async execute(req: PatchDeviceRequest, res: Response): Promise<void>
    {
        const { deviceId } = req.params;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            res.sendStatus(404);
            return;
        }

        try {
            await this.deviceUpdater.update(device, req.body);
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            res.status(500).send(error.message);
            return;
        }

        res.sendStatus(202);
    }
}
