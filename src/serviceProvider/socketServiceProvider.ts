import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";
import DeviceUpdaterInterface from "../device/updater/deviceUpdaterInterface.js";
import DeviceUpdateHandler from "../socket/deviceUpdateHandler.js";
import Logger from "../logging/Logger.js";

export default class SocketServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('socket.deviceUpdateHandler', () => {
            return new DeviceUpdateHandler(
                container.get('repository.connectedDevices') as ConnectedDeviceRepository,
                container.get('device.updater') as DeviceUpdaterInterface,
                container.get('logger.default') as Logger,
            );
        });
    }
}
