import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ServiceMap from "../serviceMap.js";
import { Ajv } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import ajvFormatsPlugin from "ajv-formats";
import JsonSchemaValidatorFactory from "../schemaValidation/JsonSchemaValidatorFactory.js";

export default class SchemaValidationServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('ajv', (): Ajv => {
            const ajv = new Ajv2020({ allErrors: true, strict: true });
            ajvFormatsPlugin.default(ajv);

            return ajv;
        });

        container.set('factory.validator.schema.json', (): JsonSchemaValidatorFactory => {
           return new JsonSchemaValidatorFactory(
               container.get('ajv')
           );
        });
    }
}
