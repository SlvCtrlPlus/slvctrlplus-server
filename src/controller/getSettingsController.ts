import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import SettingsManager from "../settings/settingsManager.js";

export default class GetSettingsController implements ControllerInterface
{
    private settingsManager: SettingsManager;

    private serializer: ClassToPlainSerializer;

    public constructor(settingsManager: SettingsManager, serializer: ClassToPlainSerializer)
    {
        this.settingsManager = settingsManager;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        res.send(JSON.stringify(this.serializer.transform(
            this.settingsManager.load(),
        ), null, 2));
    }
}
