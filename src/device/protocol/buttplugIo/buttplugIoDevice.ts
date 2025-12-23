import {Exclude, Expose} from "class-transformer";
import {ActuatorType, ButtplugClientDevice} from "buttplug";
import Device from "../../device.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../attribute/floatGenericDeviceAttribute";

export type ButtplugIoDeviceAttributes = Record<string, RangeGenericDeviceAttribute|BoolGenericDeviceAttribute|FloatGenericDeviceAttribute>;

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
        super(deviceId, deviceName, provider, connectedSince, true, attributes);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;
    }

    public async refreshData(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            this.attributes[`${sensor.SensorType}-${sensor.Index}`].value = value[0];
        }
    }

    public async setAttribute<K extends keyof ButtplugIoDeviceAttributes>(attributeName: K, value: ButtplugIoDeviceAttributes[K]['value']): Promise<ButtplugIoDeviceAttributes[K]['value']> {
        const attrDef = this.attributes[attributeName];

        if (undefined === attrDef) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`)
        }

        let sendValue;

        if (attrDef instanceof RangeGenericDeviceAttribute) {
            sendValue = Number(value)/attrDef.max;
        } else if (attrDef instanceof BoolGenericDeviceAttribute) {
            sendValue = value ? 1 : 0;
        }

        const [actuatorType, index]: string[] = attributeName.split('-');

        await this.send(actuatorType, Number(index), sendValue);

        this.attributes[`${attributeName}`].value = value;

        return value;
    }

    protected async send(command: string, index: number, value: number): Promise<void> {
        return await this.buttplugClientDevice.scalar({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "ActuatorType": command as unknown as ActuatorType,
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
