import { Exclude, Expose } from 'class-transformer';
import type { ButtplugClientDevice, SensorType } from 'buttplug';
import { ActuatorType } from 'buttplug';
import type { AttributeKeyOf, AttributeValueOf, DeviceInfo } from '../../device.js';
import Device from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import type EventEmitter from 'events';
import { asyncHandler } from '../../../util/async.js';
import type Logger from '../../../logging/Logger.js';
import { logError } from '../../../util/error.js';

type ButtplugActuatorTypeKey = `${ActuatorType}-${number}`;
type ButtplugSensorTypeKey = `${SensorType}-${number}`;

export type ButtplugIoDeviceAttributeKey = ButtplugActuatorTypeKey | ButtplugSensorTypeKey;

export type ButtplugIoDeviceAttributes = Record<
    ButtplugIoDeviceAttributeKey,
    IntRangeDeviceAttribute | BoolDeviceAttribute | IntDeviceAttribute | undefined
>;

type AttributeValue<K extends keyof ButtplugIoDeviceAttributes> = AttributeValueOf<ButtplugIoDeviceAttributes, K>;

@Exclude()
export default class ButtplugIoDevice extends Device<ButtplugIoDeviceAttributes>
{
    private static readonly REFRESH_INTERVAL_FOR_SENSOR_DEVICES_MS = 100;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly deviceModel: string;

    private readonly buttplugClientDevice: ButtplugClientDevice;

    private readonly deviceRemovedHandler: () => void;

    public constructor(
        deviceInfo: DeviceInfo,
        deviceModel: string,
        buttplugClientDevice: ButtplugClientDevice,
        attributes: ButtplugIoDeviceAttributes,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, attributes, {}, eventEmitter, logger);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;

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

    public async setAttribute<
        K extends AttributeKeyOf<ButtplugIoDeviceAttributes>,
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
        const attribute = this.attributes[attributeName];

        if (undefined === attribute) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`);
        }

        if (attribute.modifier === DeviceAttributeModifier.readOnly) {
            throw new Error(`Attribute with name '${attributeName}' is readonly`);
        }

        // All ButtplugIoDeviceAttributes are non-nullable and always initialized, so TS can
        // prove value is never undefined here - but this guards against callers that bypass the
        // type system
        // (e.g. automation scripts).
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (undefined === value) {
            throw new Error(`Value to be set for attribute '${attributeName}' cannot be undefined`);
        }

        let valueToSend;

        if (IntRangeDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value / attribute.max;
        } else if (BoolDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = true === value ? 1 : 0;
        } else if (IntDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value;
        } else {
            throw new Error(`Unsupported attribute type '${attribute.constructor.name}' for buttplug.io`);
        }

        const [actuatorType, index] = attributeName.split('-');

        if (!ButtplugIoDevice.isActuatorTypeKey(actuatorType) || undefined === index) {
            throw new Error(`Attribute with name '${attributeName}' does not correspond to a valid actuator type key`);
        }

        await this.send(actuatorType, parseInt(index, 10), valueToSend);

        const attr = this.attributes[attributeName];

        if (undefined !== attr) {
            attr.value = value;
        }

        return value;
    }

    public get getButtplugClientDevice(): ButtplugClientDevice
    {
        return this.buttplugClientDevice;
    }

    protected override async doClose(): Promise<void> {
        this.buttplugClientDevice.off('deviceremoved', this.deviceRemovedHandler);

        return Promise.resolve();
    }

    protected override async doRefresh(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd ?? []) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            const attr = this.attributes[`${sensor.SensorType}-${sensor.Index}`];
            if (undefined !== attr) {
                if (undefined === value[0] || isNaN(value[0])) {
                    this.logger.warn(`Received invalid sensor value for sensor type '${sensor.SensorType}' and index '${sensor.Index}': ${JSON.stringify(value)}. Supposed to be a number. Ignoring this value.`);
                    continue;
                }
                attr.value = Int.from(value[0]);
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
