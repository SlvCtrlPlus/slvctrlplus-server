import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import SettingsManager from "../../settings/settingsManager.js";
import Settings from "../../settings/settings.js";
import JsonSchemaValidator from "../../schemaValidation/JsonSchemaValidator.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import ClassToPlainSerializer from "../../serialization/classToPlainSerializer.js";
import {JsonObject} from "../../types.js";

export default class PutSettingsController implements ControllerInterface
{
    private settingsManager: SettingsManager;

    private plainToClassSerializer: PlainToClassSerializer;

    private classToPlainSerializer: ClassToPlainSerializer;

    private settingsSchemaValidator: JsonSchemaValidator;

    public constructor(
        settingsManager: SettingsManager,
        classToPlainSerializer: ClassToPlainSerializer,
        plainToClassSerializer: PlainToClassSerializer,
        settingsSchemaValidator: JsonSchemaValidator
    ) {
        this.settingsManager = settingsManager;
        this.settingsSchemaValidator = settingsSchemaValidator;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
    }

    public execute(req: Request, res: Response): void
    {
        const valid = this.settingsSchemaValidator.validate(req.body as JsonObject);

        if (!valid) {
            const validationErrors = this.settingsSchemaValidator.getValidationErrors();
            res.status(400).json({
                message: `Settings are not in a valid format`,
                errors: [...validationErrors]
            });
            return;
        }

        const settings = this.plainToClassSerializer.transform(Settings, req.body);

        this.settingsManager.replace(settings);

        res.send(JSON.stringify(this.classToPlainSerializer.transform(
            this.settingsManager.load(),
        ), null, 2));
    }
}
