import {Exclude, Expose, Type} from "class-transformer";
import Device from "./device.js";
import {ButtplugClientDevice} from "buttplug"
import GenericDeviceAttribute from "./generic/genericDeviceAttribute.js";
import GenericDeviceAttributeDiscriminator from "../serialization/discriminator/genericDeviceAttributeDiscriminator.js";

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
        connectedSince: Date,
        buttplugDevice: ButtplugClientDevice,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, connectedSince, true);
        this.buttplugDevice = buttplugDevice;
        this.attributes = attributes;
        this.deviceModel = deviceModel;
        this.initAttributes();
    }


    protected parseDataStr(data: string): { [key: string]: string }|null {
        const dataParts: string[] = data.split(';');

        if ('status' !== dataParts.shift()) {
            return null;
        }

        const dataObj: { [key: string]: string } = {};

        for (const dataPart of dataParts.shift().split(',')) {
            const [key, value]: string[] = dataPart.split(':');

            dataObj[key] = value;
        }

        return dataObj;
    }

    public get getRefreshInterval(): number {
        return 30000;
    }

    public async refreshData(): Promise<void> {
        let sensors = this.buttplugDevice.messageAttributes.SensorReadCmd;
        for (let i = 0; i < sensors.length; i++) {
            let value = await this.buttplugDevice.sensorRead(i,  sensors[i].SensorType);
            this.data[sensors[i].SensorType] = value[0];
        }

        //console.log('data', this.data);
        this.updateLastRefresh();
    }

    public getAttribute(key: string): any
    {
        console.log('buttplugDevice.getAttribute', this.deviceName, key);

        return this.data[key];
    }

    public getAttributeDefinitions(): GenericDeviceAttribute[]
    {
        console.log('buttplugDevice.getAttributeDefinitions');
        return this.attributes;
    }


    public getAttributeDefinition(name: string): GenericDeviceAttribute|null
    {
        console.log('getAttributeDefinition', name);
        for (const attr of this.attributes) {
            if (attr.name === name) {
                console.log('getAttributeDefinition', name, attr.type);
                return attr;
            }
        }

        return null;
    }

    public initAttributes(): void {
        let scalars = this.buttplugDevice.messageAttributes.ScalarCmd;
        for (let i = 0; i < scalars.length; i++) {
            this.data[scalars[i].ActuatorType] = 0;
        }

        for (const attr of this.attributes) {
            console.log(attr.name, attr.type, attr.modifier);
        }

        return null;
    }


    public async setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string> {
        console.log('buttplugDevice.setAttribute', attributeName, value);
        if (value === true || value === false) {
            value = value ? 1 : 0;
        }
        await this.send(`${attributeName}`, Number(value));
        return "";
    }

    protected async send(command: string, value: number): Promise<void> {
        console.log('buttplugDevice.send', command, value);
        let scalars = this.buttplugDevice.messageAttributes.ScalarCmd;
        for (let i = 0; i < scalars.length; i++) {
            if (scalars[i].ActuatorType === command) {
                this.data[scalars[i].ActuatorType] = value;
                return await this.buttplugDevice.scalar({
                    "ActuatorType": command,
                    "Scalar": value/100,
                    "Index": i
                });
            }
        }
    }
}
