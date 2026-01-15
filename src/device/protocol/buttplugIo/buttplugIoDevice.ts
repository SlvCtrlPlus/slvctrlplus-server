import {Exclude, Expose} from "class-transformer";
import {ActuatorType, ButtplugClientDevice, SensorType} from "buttplug";
import Device, {ExtractAttributeValue} from "../../device.js";
import IntRangeDeviceAttribute from "../../attribute/intRangeDeviceAttribute.js";
import BoolDeviceAttribute from "../../attribute/boolDeviceAttribute.js";
import {Int} from "../../../util/numbers.js";
import IntDeviceAttribute from "../../attribute/intDeviceAttribute.js";
import {DeviceAttributeModifier} from "../../attribute/deviceAttribute.js";

type ButtplugActuatorTypeKey = `${ActuatorType}-${number}`;
type ButtplugSensorTypeKey = `${SensorType}-${number}`;
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
        attributes: ButtplugIoDeviceAttributes
    ) {
        super(deviceId, deviceName, provider, connectedSince, true, attributes, {});
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;
    }

    public async refreshData(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd ?? []) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            this.attributes[`${sensor.SensorType}-${sensor.Index}`].value = Int.from(value[0]);
        }
    }

    public async setAttribute<K extends keyof ButtplugIoDeviceAttributes, V extends ExtractAttributeValue<ButtplugIoDeviceAttributes[K]>>(attributeName: K, value: V): Promise<V> {
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

        const [actuatorType, index] = attributeName.split('-');

        await this.send(actuatorType as ActuatorType, parseInt(index, 10), valueToSend);

        this.attributes[`${attributeName}`].value = value;

        return value;
    }

    protected async send(command: ActuatorType, index: number, value: number): Promise<void> {
        return await this.buttplugClientDevice.scalar({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "ActuatorType": command,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Scalar": value,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Index": index
        });
    }

    public get getButtplugClientDevice(): ButtplugClientDevice
    {
        return this.buttplugClientDevice;
    }
}
