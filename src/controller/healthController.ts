import type { Request, Response } from 'express';
import type ControllerInterface from './controllerInterface.js';
import type HealthMetricsCollector from '../health/healthMetricsCollector.js';
import { StatusCodes } from 'http-status-codes';

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
            res.sendStatus(StatusCodes.NO_CONTENT);
            return;
        }

        res.json(metrics);
    }
}
