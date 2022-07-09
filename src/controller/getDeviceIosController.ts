import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import ObjectTypeOptions from "../serialization/objectTypeOptions.js";
import Device from "../device/device.js";
import DeviceInput from "../device/deviceInput.js";
import DeviceOutput from "../device/deviceOutput.js";

export default class GetDeviceIosController implements ControllerInterface
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

        const ios: {[key: string]: {[key: string]: (DeviceInput<any, any>|DeviceOutput<any, any>)} } = {
            inputs: {},
            outputs: {},
        };

        const inputs = (device.constructor as typeof Device).getInputs()

        Object.entries(inputs).forEach(([key, value]) => {
            ios.inputs[key] = this.serializer.transform(value, ObjectTypeOptions.deviceIos);
        });

        const outputs = (device.constructor as typeof Device).getOutputs()

        Object.entries(outputs).forEach(([key, value]) => {
            ios.outputs[key] = this.serializer.transform(value, ObjectTypeOptions.deviceIos);
        });

        res.json(this.serializer.transform(ios));
    }
}
