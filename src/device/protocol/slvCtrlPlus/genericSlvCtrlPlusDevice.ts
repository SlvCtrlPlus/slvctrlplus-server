import {Exclude, Expose} from "class-transformer";
import SlvCtrlPlusDevice from "./slvCtrlPlusDevice.js";
import DeviceState from "../../deviceState.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import SlvCtrlPlusMessageParser from "./slvCtrlPlusMessageParser.js";
import {DeviceAttributes} from "../../device";

@Exclude()
export default class GenericSlvCtrlPlusDevice extends SlvCtrlPlusDevice<DeviceAttributes>
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
        attributes: DeviceAttributes
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
            if (!this.attributes.hasOwnProperty(attrKey)) {
                continue;
            }

            const attribute = this.attributes[attrKey];

            if (!attribute) {
                continue;
            }

            attribute.value = ('' !== dataObj[attrKey]) ? attribute.fromString(dataObj[attrKey]) : null;
        }
    }

    public async setAttribute<K extends keyof DeviceAttributes>(attributeName: K, value: DeviceAttributes[K]['value']): Promise<DeviceAttributes[K]['value']> {
        const attr = this.attributes[attributeName];

        if (undefined === attr) {
            throw new Error(`Attribute with name '${attributeName.toString()}' does not exist for this device`);
        }

        try {
            this.state = DeviceState.busy;

            if (value === true || value === false) {
                value = value ? 1 : 0;
            }

            const result = await this.send(`set-${attributeName.toString()} ${value}`);

            attr.value = value;

            return result
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public getAttributes(): DeviceAttributes
    {
        return this.attributes;
    }

    protected getSerialTimeout(): number {
        return this.serialTimeout;
    }

    public get getRefreshInterval(): number {
        return 175;
    }
}
