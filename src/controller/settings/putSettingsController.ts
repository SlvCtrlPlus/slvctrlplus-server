import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type ControllerInterface from '../controllerInterface.js';
import type SettingsManager from '../../settings/settingsManager.js';
import Settings, { SettingsSchema } from '../../settings/settings.js';
import SchemaValidationError from '../../schemaValidation/schemaValidationError.js';
import type PlainToClassSerializer from '../../serialization/plainToClassSerializer.js';
import type ClassToPlainSerializer from '../../serialization/classToPlainSerializer.js';
import type { JsonObject } from '../../types.js';
import { JSON_INDENTION_SPACES } from '../../util/numbers.js';

type PutSettingsRequest = Request<unknown, unknown, JsonObject>;

export default class PutSettingsController implements ControllerInterface
{
    private readonly settingsManager: SettingsManager;

    private readonly plainToClassSerializer: PlainToClassSerializer;

    private readonly classToPlainSerializer: ClassToPlainSerializer;

    public constructor(
        settingsManager: SettingsManager,
        classToPlainSerializer: ClassToPlainSerializer,
        plainToClassSerializer: PlainToClassSerializer,
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

            res.status(StatusCodes.BAD_REQUEST).json({
                message: `Settings are not in a valid format`,
                errors: e.validationErrors,
            });
            return;
        }

        this.settingsManager.replace(settings);

        res.send(JSON.stringify(this.classToPlainSerializer.transform(
            this.settingsManager.load(),
        ), null, JSON_INDENTION_SPACES));
    }
}
