import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import ObjectTypeOptions from "../serialization/objectTypeOptions.js";

export default class GetDeviceController implements ControllerInterface
{
    private connectedDeviceRepository: ConnectedDeviceRepository;

    private serializer: ClassToPlainSerializer;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, serializer: ClassToPlainSerializer)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        const { deviceId } = req.params;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            res.sendStatus(404);
            return;
        }

        res.json(this.serializer.transform(device, ObjectTypeOptions.device));
    }
}
