import { Request, Response } from 'express';
import ControllerInterface from './controllerInterface.js';
import HealthMetricsCollector from '../health/healthMetricsCollector.js';

export default class HealthController implements ControllerInterface
{
    private readonly healthMetricsCollector;

    public constructor(healthMetricsCollector: HealthMetricsCollector)
    {
        this.healthMetricsCollector = healthMetricsCollector;
    }

    public async execute(req: Request, res: Response): Promise<void>
    {
        res.json(await this.healthMetricsCollector.collect());
    }
}
