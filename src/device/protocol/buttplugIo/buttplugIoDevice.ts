import { Exclude, Expose } from 'class-transformer';
import type { ButtplugClientDevice } from 'buttplug';
import { ActuatorType } from 'buttplug';
import type { DeviceDataApplyError, DeviceDataUpdate, DeviceAttributeValues, DeviceInfo } from '../../device.js';
import Device from '../../device.js';
import type EventEmitter from 'events';
import { asyncHandler } from '../../../util/async.js';
import type Logger from '../../../logging/Logger.js';
import { logError } from '../../../util/error.js';
import type { TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

export type ButtplugIoDeviceAttributeValues = DeviceAttributeValues;

@Exclude()
export default class ButtplugIoDevice extends Device
{
    private static readonly REFRESH_INTERVAL_FOR_SENSOR_DEVICES_MS = 100;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly deviceModel: string;

    private readonly buttplugClientDevice: ButtplugClientDevice;

    private readonly deviceRemovedHandler: () => void;

    /** Maps actuator keys to their step count (max value for normalization). */
    private readonly actuatorStepCounts: ReadonlyMap<string, number>;

    public constructor(
        deviceInfo: DeviceInfo,
        deviceModel: string,
        buttplugClientDevice: ButtplugClientDevice,
        attributesSchema: TSchema,
        attributes: ButtplugIoDeviceAttributeValues,
        validatorFactory: JsonSchemaValidatorFactory,
        actuatorStepCounts: ReadonlyMap<string, number>,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, attributesSchema, attributes, validatorFactory, {}, eventEmitter, logger);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;
        this.actuatorStepCounts = actuatorStepCounts;

        this.deviceRemovedHandler = asyncHandler(
            async () => { await this.close() },
            (e: unknown) => logError(this.logger, `Failed to close removed device '${deviceInfo.deviceId}'`, e),
        );
        this.buttplugClientDevice.on('deviceremoved', this.deviceRemovedHandler);
    }

    public override get getRefreshInterval(): number | undefined {
        const sensorCount = this.buttplugClientDevice.messageAttributes.SensorReadCmd?.length ?? 0;

        return (sensorCount === 0) ? undefined : ButtplugIoDevice.REFRESH_INTERVAL_FOR_SENSOR_DEVICES_MS;
    }

    public get getButtplugClientDevice(): ButtplugClientDevice
    {
        return this.buttplugClientDevice;
    }

    protected override async applyDeviceData(update: DeviceDataUpdate<ButtplugIoDeviceAttributeValues>): Promise<DeviceDataApplyError[]> {
        const errors: DeviceDataApplyError[] = [];

        for (const [key, value] of Object.entries(update)) {
            if (value === undefined) {
                continue;
            }

            const [actuatorType, indexStr] = key.split('-');

            if (!ButtplugIoDevice.isActuatorTypeKey(actuatorType) || undefined === indexStr) {
                errors.push({ path: `/${key}`, message: `'${key}' does not correspond to a valid actuator type` });
                continue;
            }

            const stepCount = this.actuatorStepCounts.get(key);
            let valueToSend: number;

            if (typeof value === 'boolean') {
                valueToSend = value ? 1 : 0;
            } else if (typeof value === 'number' && stepCount !== undefined) {
                valueToSend = value / stepCount;
            } else if (typeof value === 'number') {
                valueToSend = value;
            } else {
                errors.push({ path: `/${key}`, message: `Unsupported value type for buttplug.io attribute` });
                continue;
            }

            await this.send(actuatorType, parseInt(indexStr, 10), valueToSend);
            this.data[key] = value;
        }

        return errors;
    }

    protected override async doClose(): Promise<void> {
        this.buttplugClientDevice.off('deviceremoved', this.deviceRemovedHandler);

        return Promise.resolve();
    }

    protected override async doRefresh(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd ?? []) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            const key = `${sensor.SensorType}-${sensor.Index}`;

            if (key in this.data) {
                if (undefined === value[0] || isNaN(value[0])) {
                    this.logger.warn(`Received invalid sensor value for sensor type '${sensor.SensorType}' and index '${sensor.Index}': ${JSON.stringify(value)}. Supposed to be a number. Ignoring this value.`);
                    continue;
                }
                this.data[key] = Math.trunc(value[0]);
            }
        }
    }

    protected async send(command: ActuatorType, index: number, value: number): Promise<void> {
        await this.buttplugClientDevice.scalar({
            ActuatorType: command,
            Scalar: value,
            Index: index,
        });
    }

    private static isActuatorTypeKey(key: string | undefined): key is ActuatorType {
        if (undefined === key) {
            return false;
        }

        const actuatorValueSet: (ActuatorType | string)[] = Object.values(ActuatorType);

        return actuatorValueSet.includes(key);
    }
}
