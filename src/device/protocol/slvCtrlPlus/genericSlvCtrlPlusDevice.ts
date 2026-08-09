import { Exclude, Expose } from 'class-transformer';
import type { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import SlvCtrlPlusDevice from './slvCtrlPlusDevice.js';
import DeviceState from '../../deviceState.js';
import type { AttributeKeyOf, AttributeValueOf, DeviceInfo } from '../../device.js';
import type SlvCtrlProtocol from './slvCtrlProtocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';

type AttributeValue<K extends keyof SlvCtrlPlusDeviceAttributes> = AttributeValueOf<SlvCtrlPlusDeviceAttributes, K>;

@Exclude()
export default class GenericSlvCtrlPlusDevice extends SlvCtrlPlusDevice
{
    private static readonly DEFAULT_REFRESH_INTERVAL_MS = 100;

    private readonly serialTimeout = 500;

    @Expose()
    private readonly deviceModel: string;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly fwVersion: number;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly protocolVersion: number;

    public constructor(
        deviceInfo: DeviceInfo,
        fwVersion: number,
        deviceModel: string,
        protocol: SlvCtrlProtocol,
        transport: DeviceBidirectionalTransport,
        protocolVersion: number,
        attributes: SlvCtrlPlusDeviceAttributes,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributes, {}, eventEmitter, logger);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.protocolVersion = protocolVersion;
    }

    public async setAttribute<
        K extends AttributeKeyOf<SlvCtrlPlusDeviceAttributes>,
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
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

    public override get getRefreshInterval(): number {
        return GenericSlvCtrlPlusDevice.DEFAULT_REFRESH_INTERVAL_MS;
    }

    protected getSerialTimeout(): number {
        return this.serialTimeout;
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

            attribute.value = (undefined !== response.data[attrKey] && '' !== response.data[attrKey]) ? attribute.fromString(response.data[attrKey]) : undefined;
        }
    }
}
