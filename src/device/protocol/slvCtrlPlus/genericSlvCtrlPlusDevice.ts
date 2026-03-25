import { Exclude, Expose } from 'class-transformer';
import SlvCtrlPlusDevice, { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceState from '../../deviceState.js';
import { AttributeKeyOf, AttributeValueOf } from '../../device.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { DeviceId } from '../../deviceId.js';

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
        deviceId: DeviceId,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        protocol: SlvCtrlProtocol,
        transport: DeviceTransport,
        protocolVersion: number,
        attributes: SlvCtrlPlusDeviceAttributes,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceId, deviceName, provider, connectedSince, protocol, transport, false, attributes, {}, eventEmitter, logger);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.protocolVersion = protocolVersion;
    }

    protected override async doRefresh(): Promise<void> {
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
        K extends AttributeKeyOf<SlvCtrlPlusDeviceAttributes>
    >(attributeName: K, value: AttributeValueOf<K>): Promise<AttributeValueOf<K>> {
        const attr = this.attributes[attributeName];

        if (undefined === attr) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`);
        }

        if (undefined === value || null === value) {
            throw new Error(`A non-null value must be set for the attribute with name '${attributeName}'`);
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

            return attr.value;
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

    public override get getRefreshInterval(): number {
        return 100;
    }
}
