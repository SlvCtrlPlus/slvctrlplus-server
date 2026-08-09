import type { Request, Response } from 'express';
import BaseError from 'modern-errors';
import type ControllerInterface from './controllerInterface.js';
import type ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import type DeviceUpdaterInterface from '../device/updater/deviceUpdaterInterface.js';
import type { DeviceData } from '../device/device.js';
import type { DeviceId } from '../device/deviceId.js';
import { StatusCodes } from 'http-status-codes';

type PatchDeviceRequest = Request<{ deviceId: DeviceId }, unknown, DeviceData>;

export default class PatchDeviceController implements ControllerInterface
{
    private readonly connectedDeviceRepository: ConnectedDeviceRepository;

    private readonly deviceUpdater: DeviceUpdaterInterface;

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
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        try {
            await this.deviceUpdater.update(device, req.body);
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
            return;
        }

        res.sendStatus(StatusCodes.ACCEPTED);
    }
}
