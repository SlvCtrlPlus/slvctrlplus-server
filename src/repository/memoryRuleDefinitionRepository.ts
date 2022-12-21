import RuleDefinitionRepositoryInterface from "./ruleDefinitionRepositoryInterface.js";
import RuleDefinition from "../entity/automation/rule/ruleDefinition.js";

export default class MemoryRuleDefinitionRepository implements RuleDefinitionRepositoryInterface
{
    private readonly ruleDefinitions: {[key: string]: RuleDefinition} = {};

    public getAll(): RuleDefinition[]
    {
        return Object.values(this.ruleDefinitions);
    }

    public getById(uuid: string): RuleDefinition | null {
        return this.ruleDefinitions[uuid];
    }

    public add(ruleDefinition: RuleDefinition): void {
        this.ruleDefinitions[ruleDefinition.getId] = ruleDefinition;
    }
}
