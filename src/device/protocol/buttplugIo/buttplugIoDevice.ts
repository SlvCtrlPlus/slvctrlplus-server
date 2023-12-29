import {Exclude, Expose, Type} from "class-transformer";
import {ActuatorType, ButtplugClientDevice} from "buttplug";
import Device from "../../device.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import GenericDeviceAttributeDiscriminator
    from "../../../serialization/discriminator/genericDeviceAttributeDiscriminator.js";

@Exclude()
export default class ButtplugIoDevice extends Device
{
    protected readonly buttplugDevice: ButtplugClientDevice;

    @Expose()
    @Type(() => GenericDeviceAttribute, GenericDeviceAttributeDiscriminator.createClassTransformerTypeDiscriminator('type'))
    private readonly attributes: GenericDeviceAttribute[];

    @Expose()
    private deviceModel: string;

    @Expose()
    private data: JsonObject = {};

    public constructor(
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        buttplugDevice: ButtplugClientDevice,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, true);
        this.buttplugDevice = buttplugDevice;
        this.attributes = attributes;
        this.deviceModel = deviceModel;
    }

    public async refreshData(): Promise<void> {
        for (const sensor of this.buttplugDevice.messageAttributes.SensorReadCmd) {
            const value = await this.buttplugDevice.sensorRead(sensor.Index, sensor.SensorType);
            this.data[`${sensor.SensorType}-${sensor.Index}`] = value[0];
        }

        this.updateLastRefresh();
    }

    public getAttribute(key: string): any
    {
        console.log('buttplugDevice.getAttribute', this.deviceName, key);

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
                console.log('getAttributeDefinition', name, attr.type);
                return attr;
            }
        }

        return null;
    }

    public async setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string> {
        if (value === true || value === false) {
            value = value ? 1 : 0;
        }

        const [actuatorType, index]: string[] = attributeName.split('-');

        await this.send(actuatorType, Number(index), Number(value));

        this.data[`${attributeName}`] = value;
        return "";
    }

    protected async send(command: string, index: number, value: number): Promise<void> {
        return await this.buttplugDevice.scalar({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "ActuatorType": command as unknown as ActuatorType,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Scalar": value/100,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Index": index
        });
    }
}
