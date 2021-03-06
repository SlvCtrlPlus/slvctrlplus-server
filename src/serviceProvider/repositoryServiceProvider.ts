import CarRepository from "../repository/carRepository.js";
import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ConnectedDeviceRepository from "../repository/connectedDeviceRepository.js";

export default class RepositoryServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('repository.car', () => {
            return new CarRepository();
        });

        container.set('repository.connectedDevices', () => {
            return new ConnectedDeviceRepository(
                // eslint-disable-next-line
                container.get('device.manager'),
            );
        });
    }
}
