import Rule from "./Rule.js";
import Device from "../../device/device.js";
import {Exclude, Expose} from "class-transformer";
import DeviceOutput from "../../device/deviceOutput.js";
import DeviceInput from "../../device/deviceInput.js";
import ValueMapperInterface from "./valueMapper/ValueMapperInterface.js";

type InputOutputDeviceMapEntry<S extends Device, D extends Device> = {
    from: DeviceOutput<S, number>,
    to: {
        device: () => Device|null,
        input: DeviceInput<D, number>,
        mapper: ValueMapperInterface<any, any>
    }
};

@Exclude()
export default class MappingRule extends Rule
{
    @Expose()
    private readonly sourceDeviceId: string;

    @Expose()
    private readonly inputOutputDeviceMap: InputOutputDeviceMapEntry<any, any>[];

    private readonly lastInputValues: number[] = [];

    constructor(
        id: string,
        name: string,
        sourceDeviceId: string,
        inputOutputDeviceMap: InputOutputDeviceMapEntry<any, any>[]
    ) {
        super(id, name);

        this.sourceDeviceId = sourceDeviceId;
        this.inputOutputDeviceMap = inputOutputDeviceMap;
    }

    public apply(triggeringDevice: Device): void {
        if (this.sourceDeviceId !== triggeringDevice.getDeviceId) {
            return;
        }

        for (let i = 0; i < this.inputOutputDeviceMap.length; i++) {
            const ioMapEntry = this.inputOutputDeviceMap[i];
            const destDevice = ioMapEntry.to.device();

            if (null === destDevice) {
                this.lastInputValues[i] = undefined;
                continue;
            }

            const outputValue = ioMapEntry.from.getValue(triggeringDevice);

            if (this.lastInputValues[i] !== undefined && outputValue === this.lastInputValues[i]) {
                // If input value has not changed, nothing needs to be updated
                continue;
            }

            const mappedOutputValue = ioMapEntry.to.mapper.map(outputValue);

            ioMapEntry.to.input.setValue(destDevice, mappedOutputValue)
                .then(() => {
                    this.lastInputValues[i] = outputValue
                    console.log(`set last input value ${i}: ${outputValue}`)
                }).catch(() => { /* noop */ })

            console.log(`MappingRule '${this.name}': Mapped value from '${outputValue}' to '${mappedOutputValue}'`)
        }
    }

    private static map(x: number, inMin: number, inMax: number, outMin: number,  outMax: number): number {
        return Math.round((x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin);
    }
}
