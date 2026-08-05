import { Static, TObject } from '@sinclair/typebox';
import { AnyVirtualDeviceLogic, ExtractConfig } from './virtualDeviceLogic.js';
import DateFactory from '../../../factory/dateFactory.js';
import JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';
import KnownDevice from '../../../settings/knownDevice.js';
import VirtualDevice, { AnyVirtualDevice } from './virtualDevice.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import VirtualDeviceLogicFactory from './virtualDeviceLogicFactory.js';
import Logger from '../../../logging/Logger.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';

type LogicFactoryAndConfigTuple<TLogic extends AnyVirtualDeviceLogic, TConfigSchema extends TObject> = {
    deviceLogicFactory: VirtualDeviceLogicFactory<TLogic>;
    deviceConfigSchema: TConfigSchema & (
        Static<TConfigSchema> extends ExtractConfig<TLogic>
            ? ExtractConfig<TLogic> extends Static<TConfigSchema>
                ? unknown
                : never
            : never
        );
};

export default class GenericVirtualDeviceFactory implements VirtualDeviceFactory {
    private readonly dateFactory: DateFactory;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;

    private readonly logicFactories = new Map<string, LogicFactoryAndConfigTuple<AnyVirtualDeviceLogic, TObject>>();

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventemitterFactory: EventEmitterFactory,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory,
        logger: Logger,
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventemitterFactory;
        this.jsonSchemaValidatorFactory = jsonSchemaValidatorFactory;
        this.logger = logger;
    }

    public addLogicFactory<
        TLogic extends AnyVirtualDeviceLogic,
        TConfigSchema extends TObject,
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

    public create(knownDevice: KnownDevice, provider: string): Promise<AnyVirtualDevice> {
        return new Promise<AnyVirtualDevice>(resolve => {
            const factoryName = `${GenericVirtualDeviceFactory.capitalizeFirstLetter(knownDevice.type)}VirtualDeviceLogic`;
            const factory = this.logicFactories.get(factoryName);

            if (undefined === factory) {
                throw new Error(`Could not find a factory for virtual device logic '${factoryName}'`);
            }

            const jsonSchemaValidator = this.jsonSchemaValidatorFactory.create(factory.deviceConfigSchema);
            const isConfigValid = jsonSchemaValidator.validate(knownDevice.config);

            if (!isConfigValid) {
                const validationErrors = jsonSchemaValidator.getValidationErrors();
                throw new Error(`Config for device is not valid: ${JSON.stringify(validationErrors, null, 2)}`);
            }

            const deviceLogic = factory.deviceLogicFactory.create(knownDevice.config);

            const device = new VirtualDevice(
                '1.0.0',
                knownDevice.id,
                knownDevice.name,
                knownDevice.type,
                provider,
                this.dateFactory.now(),
                knownDevice.config,
                deviceLogic,
                this.eventEmitterFactory.create(),
                this.logger,
            );

            resolve(device);
        });
    }

    private static capitalizeFirstLetter(str: string): string {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
