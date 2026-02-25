import { Exclude, Expose } from 'class-transformer';
import SlvCtrlPlusDevice, { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceState from '../../deviceState.js';
import { ExtractAttributeValue } from '../../device.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';

@Exclude()
export default class GenericSlvCtrlPlusDevice extends SlvCtrlPlusDevice
{
    private readonly serialTimeout = 500;

    @Expose()
    private readonly deviceModel: string;

    @Expose()
    private readonly fwVersion: number;

    @Expose()
    private readonly protocolVersion: number;

    public constructor(
        fwVersion: number,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        protocol: SlvCtrlProtocol,
        transport: DeviceTransport,
        protocolVersion: number,
        attributes: SlvCtrlPlusDeviceAttributes
    ) {
        super(deviceId, deviceName, provider, connectedSince, protocol, transport, false, attributes, {});

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.protocolVersion = protocolVersion;
    }

    public async refreshData(): Promise<void> {
        const response = await this.send({ command: 'status', args: [] });

        for (const attrKey in response.data) {
            if (!(attrKey in this.attributes)) {
                continue;
            }

            const attribute = this.attributes[attrKey];

            // Ignore attributes that were not announced by the device during handshake
            if (undefined === attribute) {
                continue;
            }

            attribute.value = ('' !== response.data[attrKey]) ? attribute.fromString(response.data[attrKey]) : undefined;
        }
    }

    public async setAttribute<
        K extends keyof SlvCtrlPlusDeviceAttributes,
        V extends ExtractAttributeValue<SlvCtrlPlusDeviceAttributes[K]>
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

            const response = await this.send({
                command: 'set',
                args: [attributeName, value],
            });

            if ('value' in response.data) {
                attr.value = attr.fromString(response.data.value);
            }

            return attr.value as V;
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public get getDeviceModel(): string {
        return this.deviceModel;
    }

    protected getSerialTimeout(): number {
        return this.serialTimeout;
    }

    public get getRefreshInterval(): number {
        return 175;
    }
}
