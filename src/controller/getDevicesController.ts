import type { Request, Response } from 'express';
import type ControllerInterface from './controllerInterface.js';
import type ClassToPlainSerializer from '../serialization/classToPlainSerializer.js';
import type ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import DeviceList from '../entity/deviceList.js';

export default class GetDevicesController implements ControllerInterface
{
    private readonly connectedDeviceRepository: ConnectedDeviceRepository;

    private readonly serializer: ClassToPlainSerializer;

    public constructor(connectedDeviceRepository: ConnectedDeviceRepository, serializer: ClassToPlainSerializer)
    {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        const list = new DeviceList(this.connectedDeviceRepository.getAll());

        res.json(this.serializer.transform(list));
    }
}
