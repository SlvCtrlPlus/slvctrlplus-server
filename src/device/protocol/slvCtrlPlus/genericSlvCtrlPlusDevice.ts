import {Exclude, Expose} from "class-transformer";
import SlvCtrlPlusDevice, {SlvCtrlPlusDeviceAttributes} from "./slvCtrlPlusDevice.js";
import DeviceState from "../../deviceState.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import SlvCtrlPlusMessageParser from "./slvCtrlPlusMessageParser.js";
import {AttributeValue, DeviceAttributes} from "../../device.js";
import BoolDeviceAttribute from "../../attribute/boolDeviceAttribute.js";

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
        attributes: SlvCtrlPlusDeviceAttributes
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

            // Ignore attributes that were not announced by the device during handshake
            if (undefined === attribute) {
                continue;
            }

            attribute.value = ('' !== dataObj[attrKey]) ? attribute.fromString(dataObj[attrKey]) : undefined;
        }
    }

    public async setAttribute<
        K extends keyof SlvCtrlPlusDeviceAttributes,
        V extends AttributeValue<SlvCtrlPlusDeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        const attr = this.attributes[attributeName];

        if (undefined === attr) {
            throw new Error(`Attribute with name '${attributeName.toString()}' does not exist for this device`);
        }

        if (undefined === value || null === value) {
            throw new Error(`A non-null value must be set for the attribute with name '${attributeName.toString()}'`);
        }

        if (!attr.isValidValue(value)) {
            throw new Error(`Value for attribute with name '${attributeName}' is not valid.`);
        }

        try {
            this.state = DeviceState.busy;

            let valueToSend;

            if (BoolDeviceAttribute.isInstance(attr) && attr.isValidValue(value)) {
                // Booleans are represented as 1=true and 0=false in the SlvCtrl protocol
                valueToSend = Number(value);
            } else {
                valueToSend = value;
            }

            const result = await this.send(`set-${attributeName.toString()} ${valueToSend.toString()}`);

            attr.value = value;

            return attr.fromString(result) as V;
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
