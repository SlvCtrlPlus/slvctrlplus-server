import CreateCarController from '../controller/createCarController.js';
import GetDevicesController from '../controller/getDevicesController.js';
import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import GetDeviceController from "../controller/getDeviceController.js";
import PatchDeviceController from "../controller/patchDeviceController.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/deviceUpdaterInterface.js";

export default class ControllerServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('controller.createCar', () => {
            return new CreateCarController(
                // eslint-disable-next-line
                container.get('repository.car'),
                // eslint-disable-next-line
                container.get('serializer.plainToClass'),
                // eslint-disable-next-line
                container.get('serializer.classToPlain'),
                // eslint-disable-next-line
                container.get('factory.uuid'),
            );
        });

        container.set('controller.getCars', () => {
            return new GetDevicesController(
                // eslint-disable-next-line
                container.get('repository.car'),
                // eslint-disable-next-line
                container.get('serializer.classToPlain'),
            );
        });

        container.set('controller.getDevices', () => {
            return new GetDevicesController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );
        });

        container.set('controller.getDevice', () => {
            return new GetDeviceController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('serializer.classToPlain') as ClassToPlainSerializer,
            );
        });

        container.set('controller.patchDevice', () => {
            return new PatchDeviceController(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('device.updater') as DeviceUpdaterInterface,
            );
        });
    }
}
