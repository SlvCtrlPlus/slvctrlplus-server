import { Request, Response } from 'express';
import ControllerInterface from './controllerInterface.js';
import HealthMetricsCollector from '../health/healthMetricsCollector.js';

export default class HealthController implements ControllerInterface
{
    public constructor(private readonly healthMetricsCollector: HealthMetricsCollector) {}

    public async execute(req: Request, res: Response): Promise<void>
    {
        res.json(await this.healthMetricsCollector.collect());
    }
}
