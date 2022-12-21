import Rule from "./Rule.js";
import Device from "../../device/device.js";
import DeviceOutput from "../../device/deviceOutput.js";
import DeviceInput from "../../device/deviceInput.js";
import ValueMapperInterface from "./valueMapper/ValueMapperInterface.js";
import MappingRuleDefinition from "../../entity/automation/rule/mappingRuleDefinition.js";
import DeviceManager from "../../device/deviceManager.js";
import AbstractValueMapper from "../../entity/automation/rule/valueMapper/AbstractValueMapper.js";
import {default as RangeValueMapperDef} from "../../entity/automation/rule/valueMapper/RangeValueMapper.js";
import RangeValueMapper from "./valueMapper/RangeValueMapper.js";
import DeviceDiscriminator from "../../serialization/discriminator/deviceDiscriminator.js";

type InputOutputDeviceMapEntry<S extends Device, D extends Device> = {
    from: DeviceOutput<S, number>,
    to: {
        device: () => Device|null,
        input: DeviceInput<D, number>,
        mapper: ValueMapperInterface<any, any>
    }
};

export default class MappingRule extends Rule
{
    private readonly sourceDeviceId: string;

    private readonly inputOutputDeviceMapEntry: InputOutputDeviceMapEntry<any, any>;

    private lastInputValue: number;

    constructor(
        id: string,
        name: string,
        sourceDeviceId: string,
        inputOutputDeviceMapEntry: InputOutputDeviceMapEntry<any, any>
    ) {
        super(id, name);

        this.sourceDeviceId = sourceDeviceId;
        this.inputOutputDeviceMapEntry = inputOutputDeviceMapEntry;
    }

    public static fromDefinition(ruleDefinition: MappingRuleDefinition, deviceManager: DeviceManager): MappingRule {
        const fromInputRef = ruleDefinition.getToInput;
        const toOutputRef = ruleDefinition.getFromOutput.getReference;

        const fromDeviceType = DeviceDiscriminator.fromName(
            toOutputRef.getDeviceType
        ).prototype.constructor as typeof Device;
        const toDeviceType = DeviceDiscriminator.fromName(
            fromInputRef.getReference.getDeviceType
        ).prototype.constructor as typeof Device;

        return new this(
            ruleDefinition.getId,
            ruleDefinition.getName,
            ruleDefinition.getSourceDeviceId,
            {
                from: fromDeviceType.getOutputs()[toOutputRef.getName],
                to: {
                    device: () => deviceManager.getConnectedDevice(fromInputRef.getTargetDeviceId),
                    input: toDeviceType.getInputs()[fromInputRef.getReference.getName],
                    mapper: MappingRule.createMapperFromDefinition(ruleDefinition.getMapper)
                }
            }
        );
    }

    private static createMapperFromDefinition(valueMapperDef: AbstractValueMapper): ValueMapperInterface<any, any> {
        if (valueMapperDef instanceof RangeValueMapperDef) {
            return new RangeValueMapper(
                valueMapperDef.getFromLowerBound,
                valueMapperDef.getFromUpperBound,
                valueMapperDef.getToLowerBound,
                valueMapperDef.getToUpperBound,
                valueMapperDef.isInverted
            );
        }
    }

    public apply(triggeringDevice: Device): void {
        if (this.sourceDeviceId !== triggeringDevice.getDeviceId) {
            return;
        }

        const ioMapEntry = this.inputOutputDeviceMapEntry;
        const destDevice = ioMapEntry.to.device();

        const outputValue = ioMapEntry.from.getValue(triggeringDevice);

        if (this.lastInputValue !== undefined && outputValue === this.lastInputValue) {
            // If input value has not changed, nothing needs to be updated
            return;
        }

        const mappedOutputValue = ioMapEntry.to.mapper.map(outputValue);

        ioMapEntry.to.input.setValue(destDevice, mappedOutputValue)
            .then(() => {
                this.lastInputValue = outputValue
                console.log(`set last input value: ${outputValue}`)
            }).catch(() => { /* noop */ })

        console.log(`MappingRule '${this.name}': Mapped value from '${outputValue}' to '${mappedOutputValue}'`)
    }
}
