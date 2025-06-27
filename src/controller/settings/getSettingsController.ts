import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface";
import ClassToPlainSerializer from "../../serialization/classToPlainSerializer";
import SettingsManager from "../../settings/settingsManager";

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
