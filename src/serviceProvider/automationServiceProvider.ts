import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import RuleExecutor from "../automation/rule/RuleExecutor.js";

export default class AutomationServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('automation.ruleManager', () => {
            return new RuleExecutor();
        });
    }
}
