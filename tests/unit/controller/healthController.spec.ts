import { Request, Response } from 'express';
import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import HealthController from '../../../src/controller/healthController.js';
import HealthMetricsCollector from '../../../src/health/healthMetricsCollector.js';
import { SerializedHealthMetrics } from '../../../src/health/serializedTypes.js';

describe('HealthController', () => {
    it('returns 204 when no metrics have been collected yet', () => {
        const collector = mock<HealthMetricsCollector>();
        collector.collect.mockReturnValue(null);

        const req = mock<Request>();
        const res = mock<Response>();
        res.sendStatus.mockReturnValue(res);

        new HealthController(collector).execute(req, res);

        expect(res.sendStatus).toHaveBeenCalledWith(204);
        expect(res.json).not.toHaveBeenCalled();
    });

    it('returns 200 with metrics once collection has run', () => {
        const metrics = mock<SerializedHealthMetrics>();
        const collector = mock<HealthMetricsCollector>();
        collector.collect.mockReturnValue(metrics);

        const req = mock<Request>();
        const res = mock<Response>();
        res.json.mockReturnValue(res);

        new HealthController(collector).execute(req, res);

        expect(res.json).toHaveBeenCalledWith(metrics);
        expect(res.sendStatus).not.toHaveBeenCalled();
    });
});
