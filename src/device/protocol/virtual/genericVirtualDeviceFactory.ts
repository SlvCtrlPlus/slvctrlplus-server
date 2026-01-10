import {Static, TObject} from "@sinclair/typebox";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";
import DateFactory from "../../../factory/dateFactory.js";
import Logger from "../../../logging/Logger.js";
import JsonSchemaValidatorFactory from "../../../schemaValidation/JsonSchemaValidatorFactory.js";
import KnownDevice from "../../../settings/knownDevice.js";
import VirtualDevice from "./virtualDevice.js";
import JsonSchemaValidator from "../../../schemaValidation/JsonSchemaValidator.js";
import VirtualDeviceFactory from './virtualDeviceFactory.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;
type Constructor<TDeviceLogic extends VirtualDeviceLogic<any>> = new (config: ExtractConfig<TDeviceLogic>, logger: Logger) => TDeviceLogic;

export default class GenericVirtualDeviceFactory<
    TLogic extends VirtualDeviceLogic<any, Static<TConfigSchema>>,
    TConfigSchema extends TObject,
> implements VirtualDeviceFactory {
    private readonly dateFactory: DateFactory;

    private readonly ctor: Constructor<TLogic>;

    private readonly jsonSchemaValidator?: JsonSchemaValidator;

    private readonly logger: Logger;

    private constructor(
        ctor: Constructor<TLogic>,
        deviceConfigSchema: TConfigSchema,
        dateFactory: DateFactory,
        logger: Logger,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory
    ) {
        this.ctor = ctor;
        this.dateFactory = dateFactory;
        this.jsonSchemaValidator = jsonSchemaValidatorFactory.create(deviceConfigSchema);
        this.logger = logger;
    }

    public static from<
        TLogic extends VirtualDeviceLogic<any>,
        TConfigSchema extends TObject
    >(
        ctor: Constructor<TLogic>,
        deviceConfigSchema: TConfigSchema & (
            Static<TConfigSchema> extends ExtractConfig<TLogic>
                ? ExtractConfig<TLogic> extends Static<TConfigSchema>
                    ? unknown
                    : never
                : never
            ),
        dateFactory: DateFactory,
        logger: Logger,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory
    ): GenericVirtualDeviceFactory<TLogic, TConfigSchema> {
        return new GenericVirtualDeviceFactory(
            ctor,
            deviceConfigSchema,
            dateFactory,
            logger,
            jsonSchemaValidatorFactory,
        );
    }

    public create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice>
    {
        return new Promise<VirtualDevice>((resolve) => {
            if (undefined !== this.jsonSchemaValidator) {
                const isConfigValid = this.jsonSchemaValidator.validate(knownDevice.config);

                if (!isConfigValid) {
                    const validationErrors = this.jsonSchemaValidator.getValidationErrors();
                    throw new Error(`Config for device is not valid: ${JSON.stringify(validationErrors, null, 2)}`);
                }
            }

            const deviceLogic = new this.ctor(knownDevice.config as ExtractConfig<TLogic>, this.logger);

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

    public forDeviceType(): string
    {
        return this.ctor.name;
    }
}