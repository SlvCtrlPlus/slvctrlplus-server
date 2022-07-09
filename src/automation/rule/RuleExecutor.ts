import Rule from "./Rule.js";
import Device from "../../device/device.js";
import RuleManagerInterface from "./RuleManagerInterface.js";

export default class RuleExecutor implements RuleManagerInterface
{
    private rules: Rule[] = [];

    public applyRules(device: Device): void {
        for (const rule of this.rules) {
            rule.apply(device);
        }
    }

    public addRule(rule: Rule): void {
        this.rules.push(rule);
    }
}
