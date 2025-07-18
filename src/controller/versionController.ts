import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import { APP_VERSION } from "../version.js";

export default class VersionController implements ControllerInterface
{
    public execute(req: Request, res: Response): void
    {
        res.json({
            version: APP_VERSION,
        });
    }
}
