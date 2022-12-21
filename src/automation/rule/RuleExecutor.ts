import Rule from "./Rule.js";
import Device from "../../device/device.js";
import RuleManagerInterface from "./RuleManagerInterface.js";
import RuleDefinition from "../../entity/automation/rule/ruleDefinition.js";
import MappingRuleDefinition from "../../entity/automation/rule/mappingRuleDefinition.js";
import MappingRule from "./MappingRule.js";
import DeviceManager from "../../device/deviceManager.js";

export default class RuleExecutor implements RuleManagerInterface
{
    private rules: Rule[] = [];

    private deviceManager: DeviceManager;

    constructor(deviceManager: DeviceManager) {
        this.deviceManager = deviceManager;
    }

    public applyRules(device: Device): void {
        for (const rule of this.rules) {
            rule.apply(device);
        }
    }

    public addRuleFromDefinition(ruleDefinition: RuleDefinition): void {
        if (ruleDefinition instanceof MappingRuleDefinition) {
            this.rules.push(MappingRule.fromDefinition(ruleDefinition, this.deviceManager));
            return;
        }

        throw new Error(`Unknown rule type: ${ruleDefinition.constructor.name}`)
    }
}
