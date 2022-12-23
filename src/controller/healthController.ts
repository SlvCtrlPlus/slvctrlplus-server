import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import process from 'process';

export default class HealthController implements ControllerInterface
{
    public execute(req: Request, res: Response): void
    {
        const healthInfo: {[key: string]: any} = {
            'memoryUsage': process.memoryUsage()
        };

        res.json(healthInfo);
    }
}
