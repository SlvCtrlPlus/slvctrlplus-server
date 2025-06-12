import {Exclude, Expose} from "class-transformer";
import {ActuatorType, ButtplugClientDevice} from "buttplug";
import Device from "../../device.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";

@Exclude()
export default class ButtplugIoDevice extends Device
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
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, true, attributes);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;
        this.initData(this.attributes);
    }

    public async refreshData(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            this.data[`${sensor.SensorType}-${sensor.Index}`] = value[0];
        }
    }

    private initData(attributes: GenericDeviceAttribute[]): void
    {
        for (const attr of attributes) {
            this.data[attr.name] = 0;
        }
    }

    public getAttribute(key: string): any
    {
        return this.data[key];
    }

    public getAttributeDefinitions(): GenericDeviceAttribute[]
    {
        return this.attributes;
    }

    public getAttributeDefinition(name: string): GenericDeviceAttribute|null
    {
        for (const attr of this.attributes) {
            if (attr.name === name) {
                return attr;
            }
        }

        return null;
    }

    public async setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string> {
        const attrDef = this.getAttributeDefinition(attributeName);

        if (null === attrDef) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`)
        }

        let sendValue;

        if (attrDef instanceof RangeGenericDeviceAttribute) {
            sendValue = Number(value)/attrDef.max;
        } else if (attrDef instanceof BoolGenericDeviceAttribute) {
            sendValue = value ? 1 : 0;
        } else {
            throw new Error(`Only range and boolean attributes are currently supported for buttplug.io devices (attribute: ${attrDef.name})`)
        }

        const [actuatorType, index]: string[] = attributeName.split('-');

        await this.send(actuatorType, Number(index), sendValue);

        this.data[`${attributeName}`] = value;
        return "";
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
