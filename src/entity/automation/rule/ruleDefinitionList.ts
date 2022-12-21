import {Exclude, Expose, Type} from 'class-transformer';
import List from "../../list.js";
import RuleDefinition from "./ruleDefinition.js";
import RuleDefinitionDiscriminator from "../../../serialization/discriminator/ruleDefinitionDiscriminator.js";

@Exclude()
export default class RuleDefinitionList extends List<RuleDefinition>
{
    @Type(() => RuleDefinition, RuleDefinitionDiscriminator.createClassTransformerTypeDiscriminator('type'))
    public get getItems(): RuleDefinition[]
    {
        return super.getItems;
    }
}
