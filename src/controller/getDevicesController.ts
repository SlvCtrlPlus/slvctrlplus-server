import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import List from "../entity/list.js";
import Device from "../device/device.js";

export default class GetDevicesController implements ControllerInterface
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
        const list = new List<Device>(this.connectedDeviceRepository.getAll());

        res.json(this.serializer.transform(list));
    }
}
