import { Pimple, ServiceProvider } from "@timesplinter/pimple";
import UuidFactory from "../factory/uuidFactory.js";

export default class FactoryServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('factory.uuid', () => {
            return new UuidFactory();
        });
    }
}
