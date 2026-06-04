import { Exclude, Expose } from 'class-transformer';
import { ButtplugClientDevice, DeviceOutput, DeviceOutputCommand, InputCommandType, InputType, OutputType } from 'buttplug';
import Device, { ExtractAttributeValue } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import EventEmitter from 'events';

type ButtplugActuatorTypeKey = `${OutputType}-${number}`;
type ButtplugSensorTypeKey = `${InputType}-${number}`;
export type ButtplugIoDeviceAttributeKey = ButtplugActuatorTypeKey | ButtplugSensorTypeKey;

export type ButtplugIoDeviceAttributes = Record<
    ButtplugIoDeviceAttributeKey,
    IntRangeDeviceAttribute|BoolDeviceAttribute|IntDeviceAttribute
>;

@Exclude()
export default class ButtplugIoDevice extends Device<ButtplugIoDeviceAttributes>
{
    private readonly buttplugClientDevice: ButtplugClientDevice;

    @Expose()
    private deviceModel: string;

    public constructor(
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        buttplugClientDevice: ButtplugClientDevice,
        attributes: ButtplugIoDeviceAttributes,
        eventEmitter: EventEmitter
    ) {
        super(deviceId, deviceName, provider, connectedSince, true, attributes, {}, eventEmitter);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;
    }

    protected override async doRefresh(): Promise<void> {
        for (const [featureIndex, feature] of this.buttplugClientDevice.features) {
            for (const inputType of Object.values(InputType)) {
                if (inputType === InputType.Unknown || false === feature.hasInput(inputType)) {
                    continue;
                }
                const attrKey = `${inputType}-${featureIndex}` as ButtplugIoDeviceAttributeKey;
                if (this.attributes[attrKey] === undefined) {
                    continue;
                }
                const response = await feature.runInput(inputType, InputCommandType.Read);
                if (response?.Reading[inputType] !== undefined) {
                    this.attributes[attrKey].value = Int.from(response.Reading[inputType].Value);
                }
            }
        }
    }

    public async setAttribute<
        K extends keyof ButtplugIoDeviceAttributes & string,
        V extends ExtractAttributeValue<ButtplugIoDeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        const attribute = this.attributes[attributeName];

        if (undefined === attribute) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`)
        }

        if (attribute.modifier === DeviceAttributeModifier.readOnly) {
            throw new Error(`Attribute with name '${attributeName}' is readonly`);
        }

        if (undefined === value) {
            throw new Error(`Value to be set for attribute '${attributeName}' cannot be undefined`);
        }

        let valueToSend;

        if (IntRangeDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value/attribute.max;
        } else if (BoolDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = true === value ? 1 : 0;
        } else if (IntDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value;
        } else {
            throw new Error(`Unsupported attribute type '${attribute.constructor.name}' for buttplug.io`);
        }

        const dashIndex = attributeName.lastIndexOf('-');
        const outputType = attributeName.slice(0, dashIndex) as OutputType;
        const index = parseInt(attributeName.slice(dashIndex + 1), 10);

        await this.send(outputType, index, valueToSend);

        this.attributes[`${attributeName}`].value = value;

        return value;
    }

    protected async send(command: OutputType, index: number, value: number): Promise<void> {
        const feature = this.buttplugClientDevice.features.get(index);
        if (feature === undefined) {
            throw new Error(`Feature index ${index} not found`);
        }
        await feature.runOutput(ButtplugIoDevice.createOutputCommand(command, value));
    }

    private static createOutputCommand(type: OutputType, value: number): DeviceOutputCommand {
        switch (type) {
            case OutputType.Vibrate: return DeviceOutput.Vibrate.percent(value);
            case OutputType.Rotate: return DeviceOutput.Rotate.percent(value);
            case OutputType.Oscillate: return DeviceOutput.Oscillate.percent(value);
            case OutputType.Constrict: return DeviceOutput.Constrict.percent(value);
            case OutputType.Inflate: return DeviceOutput.Inflate.percent(value);
            case OutputType.Temperature: return DeviceOutput.Temperature.percent(value);
            case OutputType.Led: return DeviceOutput.Led.percent(value);
            case OutputType.Spray: return DeviceOutput.Spray.percent(value);
            case OutputType.Position: return DeviceOutput.Position.percent(value);
            default: throw new Error(`Unsupported output type: ${type}`);
        }
    }

    public get getButtplugClientDevice(): ButtplugClientDevice
    {
        return this.buttplugClientDevice;
    }
}
