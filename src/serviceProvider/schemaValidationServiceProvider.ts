import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ServiceMap from "../serviceMap.js";
import Ajv from "ajv/dist/2020.js";
import ajvAddFormats from "ajv-formats";
import JsonSchemaValidatorFactory from "../schemaValidation/JsonSchemaValidatorFactory.js";

export default class SchemaValidationServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('ajv', (): Ajv => {
            const ajv = new Ajv({ allErrors: true, strict: true });
            ajvAddFormats(ajv);

            return ajv;
        });

        container.set('factory.validator.schema.json', (): JsonSchemaValidatorFactory => {
           return new JsonSchemaValidatorFactory(
               container.get('ajv')
           );
        });
    }
}
