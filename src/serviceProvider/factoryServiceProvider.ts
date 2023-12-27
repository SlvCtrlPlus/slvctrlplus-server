import { Pimple, ServiceProvider } from "@timesplinter/pimple";
import UuidFactory from "../factory/uuidFactory.js";
import DateFactory from "../factory/dateFactory.js";

export default class FactoryServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('factory.uuid', () =>  new UuidFactory());
        container.set('factory.date', () => new DateFactory());
    }
}
