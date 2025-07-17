import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";

export default class RestartController implements ControllerInterface
{

    public execute(req: Request, res: Response): void
    {
        res.sendStatus(202);

        process.exit(0);
    }
}
