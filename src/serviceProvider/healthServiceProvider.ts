import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import ServiceMap from '../serviceMap.js';
import HealthMetricsCollector from '../health/healthMetricsCollector.js';

export default class HealthServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set('health.metricsCollector', () => new HealthMetricsCollector(
            container.get('logger.default'),
        ));
    }
}
