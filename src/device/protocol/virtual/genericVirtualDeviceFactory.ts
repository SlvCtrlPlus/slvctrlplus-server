import { Static, TObject } from '@sinclair/typebox';
import VirtualDeviceLogic from './virtualDeviceLogic.js';
import DateFactory from '../../../factory/dateFactory.js';
import JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';
import KnownDevice from '../../../settings/knownDevice.js';
import VirtualDevice from './virtualDevice.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import VirtualDeviceLogicFactory from './virtualDeviceLogicFactory.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;

type LogicFactoryAndConfigTuple<TLogic extends VirtualDeviceLogic<any>, TConfigSchema extends TObject> = {
    deviceLogicFactory: VirtualDeviceLogicFactory<TLogic>,
    deviceConfigSchema: TConfigSchema & (
        Static<TConfigSchema> extends ExtractConfig<TLogic>
            ? ExtractConfig<TLogic> extends Static<TConfigSchema>
                ? unknown
                : never
            : never
        ),
};

export default class GenericVirtualDeviceFactory implements VirtualDeviceFactory {
    private readonly dateFactory: DateFactory;

    private readonly jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;

    private readonly logicFactories: Map<string, LogicFactoryAndConfigTuple<VirtualDeviceLogic<any, any>, TObject>> = new Map();

    public constructor(
        dateFactory: DateFactory,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory
    ) {
        this.dateFactory = dateFactory;
        this.jsonSchemaValidatorFactory = jsonSchemaValidatorFactory;
    }

    public addLogicFactory<
        TLogic extends VirtualDeviceLogic<any>,
        TConfigSchema extends TObject
    >(
        virtualDeviceLogicFactory: LogicFactoryAndConfigTuple<TLogic, TConfigSchema>['deviceLogicFactory'],
        deviceConfigSchema: LogicFactoryAndConfigTuple<TLogic, TConfigSchema>['deviceConfigSchema'],
    ): this {
        this.logicFactories.set(virtualDeviceLogicFactory.forDeviceType(), {
            deviceLogicFactory: virtualDeviceLogicFactory,
            deviceConfigSchema,
        });

        return this;
    }

    public create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice<any>> {
        return new Promise<VirtualDevice<any>>((resolve) => {
            const factoryName = `${GenericVirtualDeviceFactory.capitalizeFirstLetter(knownDevice.type)}VirtualDeviceLogic`;
            const factory = this.logicFactories.get(factoryName);

            if (undefined === factory) {
                throw new Error(`Could not find a factory for virtual device logic '${factoryName}'`);
            }

            const jsonSchemaValidator = this.jsonSchemaValidatorFactory.create(factory.deviceConfigSchema);

            if (undefined !== jsonSchemaValidator) {
                const isConfigValid = jsonSchemaValidator.validate(knownDevice.config);

                if (!isConfigValid) {
                    const validationErrors = jsonSchemaValidator.getValidationErrors();
                    throw new Error(`Config for device is not valid: ${JSON.stringify(validationErrors, null, 2)}`);
                }
            }

            const deviceLogic = factory.deviceLogicFactory.create(knownDevice.config as Static<typeof factory.deviceConfigSchema>);

            const device = new VirtualDevice(
                '1.0.0',
                knownDevice.id,
                knownDevice.name,
                knownDevice.type,
                provider,
                this.dateFactory.now(),
                knownDevice.config,
                deviceLogic
            );

            resolve(device);
        });
    }

    private static capitalizeFirstLetter(str: string): string {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}