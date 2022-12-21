import RuleDefinition from "../entity/automation/rule/ruleDefinition.js";

export default interface RuleDefinitionRepositoryInterface
{
    getAll(): RuleDefinition[];

    getById(uuid: string): RuleDefinition|null;
}
