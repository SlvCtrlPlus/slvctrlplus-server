import { Exclude, Expose } from 'class-transformer';
import SlvCtrlPlusDevice from './slvCtrlPlusDevice.js';
import DeviceState from '../../deviceState.js';
import type { DeviceAttributeValues, DeviceDataApplyError, DeviceDataUpdate, DeviceInfo } from '../../device.js';
import type SlvCtrlProtocol from './slvCtrlProtocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';
import { TypeGuard, type TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

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

    // eslint-disable-next-line @typescript-eslint/max-params
    public constructor(
        deviceInfo: DeviceInfo,
        fwVersion: number,
        deviceModel: string,
        protocol: SlvCtrlProtocol,
        transport: DeviceBidirectionalTransport,
        protocolVersion: number,
        attributesSchema: TSchema,
        attributes: DeviceAttributeValues,
        validatorFactory: JsonSchemaValidatorFactory,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributesSchema, attributes, validatorFactory, {}, eventEmitter, logger);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.protocolVersion = protocolVersion;
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

    protected override async applyDeviceData(update: DeviceDataUpdate<DeviceAttributeValues>): Promise<DeviceDataApplyError[]> {
        const errors: DeviceDataApplyError[] = [];

        for (const [key, value] of Object.entries(update)) {
            if (undefined === value || null === value) {
                continue;
            }

            try {
                this.state = DeviceState.busy;

                const response = await this.send({
                    command: 'set',
                    args: [key, typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : JSON.stringify(value)],
                });

                if ('value' in response.data) {
                    this.data[key] = this.parseResponseValue(key, response.data.value);
                }
            } catch (e: unknown) {
                errors.push({ path: `/${key}`, message: e instanceof Error ? e.message : String(e) });
            } finally {
                this.state = DeviceState.ready;
            }
        }

        return errors;
    }

    protected override async doRefresh(): Promise<void> {
        const response = await this.send({ command: 'status', args: [] });

        for (const [attrKey, rawValue] of Object.entries(response.data)) {
            if (!(attrKey in this.data)) {
                continue;
            }

            this.data[attrKey] = '' !== rawValue ? this.parseResponseValue(attrKey, rawValue) : undefined;
        }
    }

    /**
     * Parse a string value from the protocol response into a typed value.
     * Uses the schema to determine the expected type for the given key.
     * Falls back to generic parsing (number → string) when no schema info is available.
     */
    private parseResponseValue(key: string, raw: string): unknown {
        const propertySchema = TypeGuard.IsObject(this.dataSchema)
            ? this.dataSchema.properties[key]
            : undefined;

        if (propertySchema !== undefined && 'type' in propertySchema) {
            switch (propertySchema.type) {
                case 'boolean':
                    return raw === '1' || raw === 'true';
                case 'integer':
                case 'number': {
                    const num = Number(raw);
                    return Number.isNaN(num) ? raw : num;
                }
                case 'string':
                    return raw;
            }
        }

        // Fallback: number then string
        const num = Number(raw);
        if (!Number.isNaN(num) && raw !== '') return num;

        return raw;
    }
}
