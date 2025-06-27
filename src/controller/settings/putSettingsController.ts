import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface";
import ClassToPlainSerializer from "../../serialization/classToPlainSerializer";
import SettingsManager from "../../settings/settingsManager";
import Settings from "../../settings/settings";
import JsonSchemaValidator from "../../schemaValidation/JsonSchemaValidator";

export default class PutSettingsController implements ControllerInterface
{
    private settingsManager: SettingsManager;

    private serializer: ClassToPlainSerializer;

    private settingsSchemaValidator: JsonSchemaValidator;

    public constructor(
        settingsManager: SettingsManager,
        serializer: ClassToPlainSerializer,
        settingsSchemaValidator: JsonSchemaValidator
    ) {
        this.settingsManager = settingsManager;
        this.settingsSchemaValidator = settingsSchemaValidator;
        this.serializer = serializer;
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

        const settings = req.body as Settings;

        this.settingsManager.replace(settings);

        res.send(JSON.stringify(this.serializer.transform(
            this.settingsManager.load(),
        ), null, 2));
    }
}
