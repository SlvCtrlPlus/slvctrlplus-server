import fs from "fs";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import Settings from "./settings.js";
import onChange from "on-change";
import DeviceSource from "./deviceSource.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js";
import Logger from "../logging/Logger.js";
import JsonSchemaValidator from "../schemaValidation/JsonSchemaValidator";

export default class SettingsManager
{
    private readonly settingsFilePath: string;

    private settings: Settings|null = null;

    private readonly plainToClassSerializer: PlainToClassSerializer;

    private readonly classToPlainSerializer: ClassToPlainSerializer;

    private readonly logger: Logger;

    private readonly settingsSchemaValidator: JsonSchemaValidator;

    public constructor(
        settingsFilePath: string,
        plainToClassSerializer: PlainToClassSerializer,
        classToPlainSerializer: ClassToPlainSerializer,
        settingsSchemaValidator: JsonSchemaValidator,
        logger: Logger
    ) {
        this.settingsFilePath = settingsFilePath;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
        this.settingsSchemaValidator = settingsSchemaValidator;
        this.logger = logger;
    }

    public load(): Settings {
        if (null !== this.settings) {
            return this.settings;
        }

        if (!fs.existsSync(this.settingsFilePath)) {
            this.settings = SettingsManager.getDefaultSettings();
            this.save();
        } else {
            const plainJsonSettings = JSON.parse(fs.readFileSync(this.settingsFilePath, 'utf8')) as JsonObject;
            const valid = this.settingsSchemaValidator.validate(plainJsonSettings);

            if (!valid) {
                const validationErrors = this.settingsSchemaValidator.getValidationErrorsAsText();
                const invalidFormatMsg = `Settings are not in a valid format: ${validationErrors}`;
                this.logger.error(invalidFormatMsg);
                throw new Error(invalidFormatMsg);
            }

            this.settings = this.plainToClassSerializer.transform(Settings, plainJsonSettings);

            this.logger.info(`Settings loaded from file: ${this.settingsFilePath}`);
        }

        this.settings = onChange(this.settings, () => this.save());

        return this.settings;
    }

    public replace(settings: Settings): void {
        console.log(settings)
        this.settings = onChange(settings, () => this.save());
        this.save();
        this.logger.info(`Settings have been replaced with new value`);
    }

    private save(): void {
        try {
            fs.writeFileSync(
                this.settingsFilePath,
                JSON.stringify(this.classToPlainSerializer.transform(this.settings), null, 4)
            );
            this.logger.debug(`Settings saved to '${this.settingsFilePath}' due to a change`);
        } catch (err: unknown) {
            this.logger.error(
                `Could not save settings file to '${this.settingsFilePath}': ${(err as Error).message}`,
                err
            );
        }
    }

    private static getDefaultSettings(): Settings {
        const settings = new Settings();

        const defaultDeviceSource = new DeviceSource();
        defaultDeviceSource.id = 'b6a0f45e-c3d0-4dca-ab81-7daac0764291';
        defaultDeviceSource.type = SlvCtrlPlusSerialDeviceProvider.name;
        defaultDeviceSource.config = {};

        settings.addDeviceSource(defaultDeviceSource);

        return settings;
    }
}