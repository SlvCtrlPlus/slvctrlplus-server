import {Exclude, Expose, Type} from 'class-transformer';
import RuleDefinition from "./ruleDefinition.js";
import AbstractValueMapper from "./valueMapper/AbstractValueMapper.js";
import IoDeviceMapOutput from "./ioDeviceMapOutput.js";
import IoDeviceMapInput from "./ioDeviceMapInput.js";
import ValueMapperDiscriminator from "../../../serialization/discriminator/valueMapperDiscriminator.js";

@Exclude()
export default class MappingRuleDefinition extends RuleDefinition
{
    @Expose()
    private readonly sourceDeviceId: string;

    @Expose()
    private readonly fromOutput: IoDeviceMapOutput;

    @Expose()
    private readonly toInput: IoDeviceMapInput;

    @Expose()
    @Type(() => AbstractValueMapper, ValueMapperDiscriminator.createClassTransformerTypeDiscriminator('type'))
    private readonly mapper: AbstractValueMapper;

    constructor(
        id: string,
        name: string,
        sourceDeviceId: string,
        fromOutput: IoDeviceMapOutput,
        toInput: IoDeviceMapInput,
        mapper: AbstractValueMapper
    ) {
        super(id, name);
        this.sourceDeviceId = sourceDeviceId;
        this.fromOutput = fromOutput;
        this.toInput = toInput;
        this.mapper = mapper;
    }

    public get getSourceDeviceId(): string {
        return this.sourceDeviceId;
    }

    public get getFromOutput(): IoDeviceMapOutput {
        return this.fromOutput;
    }

    public get getToInput(): IoDeviceMapInput {
        return this.toInput;
    }

    public get getMapper(): AbstractValueMapper {
        return this.mapper;
    }
}
