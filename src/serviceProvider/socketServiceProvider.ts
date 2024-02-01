import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceUpdateHandler from "../socket/deviceUpdateHandler.js";
import ServiceMap from "../serviceMap.js";

export default class SocketServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('socket.deviceUpdateHandler', () => {
            return new DeviceUpdateHandler(
                container.get('repository.connectedDevices'),
                container.get('device.updater'),
                container.get('logger.default'),
            );
        });
    }
}
