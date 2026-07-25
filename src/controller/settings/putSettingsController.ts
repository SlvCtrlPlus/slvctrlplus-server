import { Request, Response } from 'express';
import ControllerInterface from '../controllerInterface.js';
import SettingsManager from '../../settings/settingsManager.js';
import Settings, { SettingsSchema } from '../../settings/settings.js';
import SchemaValidationError from '../../schemaValidation/schemaValidationError.js';
import PlainToClassSerializer from '../../serialization/plainToClassSerializer.js';
import ClassToPlainSerializer from '../../serialization/classToPlainSerializer.js';
import { JsonObject } from '../../types.js';

type PutSettingsRequest = Request<unknown, unknown, JsonObject>;

export default class PutSettingsController implements ControllerInterface
{
    private settingsManager: SettingsManager;

    private plainToClassSerializer: PlainToClassSerializer;

    private classToPlainSerializer: ClassToPlainSerializer;

    public constructor(
        settingsManager: SettingsManager,
        classToPlainSerializer: ClassToPlainSerializer,
        plainToClassSerializer: PlainToClassSerializer
    ) {
        this.settingsManager = settingsManager;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
    }

    public execute(req: PutSettingsRequest, res: Response): void
    {
        let settings: Settings;

        try {
            settings = this.plainToClassSerializer.transform(Settings, req.body, SettingsSchema);
        } catch (e: unknown) {
            if (!(e instanceof SchemaValidationError)) {
                throw e;
            }

            res.status(400).json({
                message: `Settings are not in a valid format`,
                errors: e.validationErrors
            });
            return;
        }

        this.settingsManager.replace(settings);

        res.send(JSON.stringify(this.classToPlainSerializer.transform(
            this.settingsManager.load(),
        ), null, 2));
    }
}
