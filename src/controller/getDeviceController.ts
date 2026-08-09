import type { Request, Response } from 'express';
import type ControllerInterface from './controllerInterface.js';
import { StatusCodes } from 'http-status-codes';
import type ClassToPlainSerializer from '../serialization/classToPlainSerializer.js';
import type ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import deviceDiscriminator from '../serialization/discriminator/deviceDiscriminator.js';
import type { DeviceId } from '../device/deviceId.js';

type GetDeviceRequest = Request<{ deviceId: DeviceId }>;

export default class GetDeviceController implements ControllerInterface
{
    private readonly connectedDeviceRepository: ConnectedDeviceRepository;

    private readonly serializer: ClassToPlainSerializer;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, serializer: ClassToPlainSerializer)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.serializer = serializer;
    }

    public execute(req: GetDeviceRequest, res: Response): void
    {
        const { deviceId } = req.params;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        res.json(this.serializer.transform(
            device,
            deviceDiscriminator.createClassTransformerTypeDiscriminator('type'),
        ));
    }
}
