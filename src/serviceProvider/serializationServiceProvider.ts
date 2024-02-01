import { Pimple, ServiceProvider } from "@timesplinter/pimple";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import ServiceMap from "../serviceMap.js";

export default class SerializationServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('serializer.plainToClass', () => {
            return new PlainToClassSerializer({ excludeExtraneousValues: true });
        });

        container.set('serializer.classToPlain', () => {
            return new ClassToPlainSerializer(/* { strategy: 'excludeAll' } */);
        });
    }
}
