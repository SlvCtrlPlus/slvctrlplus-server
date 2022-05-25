import { Pimple, ServiceProvider } from "@timesplinter/pimple";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";

export default class SerializationServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('serializer.plainToClass', () => {
            return new PlainToClassSerializer({ excludeExtraneousValues: true });
        });

        container.set('serializer.classToPlain', () => {
            return new ClassToPlainSerializer(/*{ strategy: 'excludeAll' }*/);
        });
    }
}
