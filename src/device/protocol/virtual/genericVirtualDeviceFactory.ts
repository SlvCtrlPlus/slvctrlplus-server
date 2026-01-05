import KnownDevice from "../../../settings/knownDevice.js";
import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import VirtualDevice from "./virtualDevice.js";
import DateFactory from "../../../factory/dateFactory.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";
import Logger from "../../../logging/Logger.js";
import JsonSchemaValidator from "../../../schemaValidation/JsonSchemaValidator.js";
import JsonSchemaValidatorFactory from "../../../schemaValidation/JsonSchemaValidatorFactory.js";
import {Static, TSchema} from "@sinclair/typebox";

type Constructor<TConfig extends TSchema, TLogic extends VirtualDeviceLogic> = new (config: Static<TConfig>, logger: Logger) => TLogic;

export default class GenericVirtualDeviceFactory<
    TLogic extends VirtualDeviceLogic,
    TConfig extends TSchema
> implements VirtualDeviceFactory {
    private readonly dateFactory: DateFactory;

    private readonly ctor: Constructor<TConfig, TLogic>;

    private readonly jsonSchemaValidator?: JsonSchemaValidator;

    private readonly logger: Logger;

    private constructor(
        ctor: Constructor<TConfig, TLogic>,
        deviceConfigSchema: TConfig,
        dateFactory: DateFactory,
        logger: Logger,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory
    ) {
        this.ctor = ctor;
        this.dateFactory = dateFactory;
        this.jsonSchemaValidator = jsonSchemaValidatorFactory.create(deviceConfigSchema);
        this.logger = logger;
    }

    public static from<TLogic extends VirtualDeviceLogic, TConfig extends TSchema>(
        ctor: Constructor<TConfig, TLogic>,
        deviceConfigSchema: TConfig,
        dateFactory: DateFactory,
        logger: Logger,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory
    ) {
        return new GenericVirtualDeviceFactory(
            ctor,
            deviceConfigSchema,
            dateFactory,
            logger,
            jsonSchemaValidatorFactory
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

            const deviceLogic = new this.ctor(knownDevice.config as Static<TConfig>, this.logger);

            const device = new VirtualDevice(
                "1.0.0",
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
