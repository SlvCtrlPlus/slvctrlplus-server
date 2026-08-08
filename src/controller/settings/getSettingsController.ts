import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type ClassToPlainSerializer from '../../serialization/classToPlainSerializer.js';
import type SettingsManager from '../../settings/settingsManager.js';
import { JSON_INDENTION_SPACES } from '../../util/numbers.js';

export default class GetSettingsController implements ControllerInterface
{
    private readonly settingsManager: SettingsManager;

    private readonly serializer: ClassToPlainSerializer;

    public constructor(settingsManager: SettingsManager, serializer: ClassToPlainSerializer)
    {
        this.settingsManager = settingsManager;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        res.contentType('application/json').send(JSON.stringify(this.serializer.transform(
            this.settingsManager.load(),
        ), null, JSON_INDENTION_SPACES));
    }
}
