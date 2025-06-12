import {Exclude, Expose} from "class-transformer";
import SlvCtrlPlusDevice from "./slvCtrlPlusDevice.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import DeviceState from "../../deviceState.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import SlvCtrlPlusMessageParser from "./slvCtrlPlusMessageParser.js";

@Exclude()
export default class GenericSlvCtrlPlusDevice extends SlvCtrlPlusDevice
{

    private readonly serialTimeout = 500;

    @Expose()
    private deviceModel: string;

    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private readonly protocolVersion: number;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        transport: DeviceTransport,
        protocolVersion: number,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, transport, false, attributes);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.protocolVersion = protocolVersion;
    }

    public async refreshData(): Promise<void> {
        const data = await this.send('status')
        const dataObj = SlvCtrlPlusMessageParser.parseStatus(data);

        if (null === dataObj) {
            return;
        }

        for (const attrKey in dataObj) {
            if (!dataObj.hasOwnProperty(attrKey)) {
                continue;
            }

            const attrDef = this.getAttributeDefinition(attrKey);

            this.data[attrKey] = ('' !== dataObj[attrKey]) ? attrDef.fromString(dataObj[attrKey]) : null;
        }
    }

    public async setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string> {
        try {
            this.state = DeviceState.busy;

            if (value === true || value === false) {
                value = value ? 1 : 0;
            }

            return await this.send(`set-${attributeName} ${value}`);
        } finally {
            this.state = DeviceState.ready;
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

    protected getSerialTimeout(): number {
        return this.serialTimeout;
    }

    public get getRefreshInterval(): number {
        return 175;
    }
}
