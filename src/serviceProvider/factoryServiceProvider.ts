import { Pimple, ServiceProvider } from "@timesplinter/pimple";
import UuidFactory from "../factory/uuidFactory.js";
import DateFactory from "../factory/dateFactory.js";
import ServiceMap from "../serviceMap.js";

export default class FactoryServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('factory.uuid', () =>  new UuidFactory());
        container.set('factory.date', () => new DateFactory());
    }
}
