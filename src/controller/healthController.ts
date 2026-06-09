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

    public execute(_req: Request, res: Response): void
    {
        const metrics = this.healthMetricsCollector.collect();

        if (metrics === null) {
            res.sendStatus(204);
            return;
        }

        res.json(metrics);
    }
}
