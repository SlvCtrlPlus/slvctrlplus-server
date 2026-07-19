import { Exclude, Expose } from 'class-transformer';
import { ActuatorType, ButtplugClientDevice, SensorType } from 'buttplug';
import Device, { AttributeKeyOf, AttributeValueOf } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import EventEmitter from 'events';
import { DeviceId } from '../../deviceId.js';
import { asyncHandler } from '../../../util/async.js';

type ButtplugActuatorTypeKey = `${ActuatorType}-${number}`;
type ButtplugSensorTypeKey = `${SensorType}-${number}`;
export type ButtplugIoDeviceAttributeKey = ButtplugActuatorTypeKey | ButtplugSensorTypeKey;

export type ButtplugIoDeviceAttributes = Record<
    ButtplugIoDeviceAttributeKey,
    IntRangeDeviceAttribute|BoolDeviceAttribute|IntDeviceAttribute
>;

type AttributeValue<K extends keyof ButtplugIoDeviceAttributes> = AttributeValueOf<ButtplugIoDeviceAttributes, K>;

@Exclude()
export default class ButtplugIoDevice extends Device<ButtplugIoDeviceAttributes>
{
    private readonly buttplugClientDevice: ButtplugClientDevice;

    @Expose()
    private deviceModel: string;

    private readonly deviceRemovedHandler: () => void;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        deviceModel: string,
        provider: string,
        connectedSince: Date,
        buttplugClientDevice: ButtplugClientDevice,
        attributes: ButtplugIoDeviceAttributes,
        eventEmitter: EventEmitter
    ) {
        super(deviceId, deviceName, provider, connectedSince, true, attributes, {}, eventEmitter);
        this.buttplugClientDevice = buttplugClientDevice;
        this.deviceModel = deviceModel;

        this.deviceRemovedHandler = asyncHandler(async () => { await this.close(); }, console.error);
        this.buttplugClientDevice.on('deviceremoved', this.deviceRemovedHandler);
    }

    protected override async doClose(): Promise<void> {
        this.buttplugClientDevice.off('deviceremoved', this.deviceRemovedHandler);
    }

    public override get getRefreshInterval(): number | undefined {
        const sensorCount = this.buttplugClientDevice.messageAttributes.SensorReadCmd?.length ?? 0;

        return (sensorCount === 0) ? undefined : 100;
    }

    protected override async doRefresh(): Promise<void> {
        for (const sensor of this.buttplugClientDevice.messageAttributes.SensorReadCmd ?? []) {
            const value = await this.buttplugClientDevice.sensorRead(sensor.Index, sensor.SensorType);
            this.attributes[`${sensor.SensorType}-${sensor.Index}`].value = Int.from(value[0]);
        }
    }

    public async setAttribute<
        K extends AttributeKeyOf<ButtplugIoDeviceAttributes>
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
        const attribute = this.attributes[attributeName];

        if (undefined === attribute) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`)
        }

        if (attribute.modifier === DeviceAttributeModifier.readOnly) {
            throw new Error(`Attribute with name '${attributeName}' is readonly`);
        }

        if (undefined === value) {
            throw new Error(`Value to be set for attribute '${attributeName}' cannot be undefined`);
        }

        let valueToSend;

        if (IntRangeDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value/attribute.max;
        } else if (BoolDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = true === value ? 1 : 0;
        } else if (IntDeviceAttribute.isInstance(attribute) && attribute.isValidValue(value)) {
            valueToSend = value;
        } else {
            throw new Error(`Unsupported attribute type '${attribute.constructor.name}' for buttplug.io`);
        }

        const [actuatorType, index] = attributeName.split('-');

        if (!this.isActuatorTypeKey(actuatorType)) {
            throw new Error(`Attribute with name '${attributeName}' does not correspond to a valid actuator type key`);
        }

        await this.send(actuatorType, parseInt(index, 10), valueToSend);

        this.attributes[`${attributeName}`].value = value;

        return value;
    }

    private isActuatorTypeKey(key: string): key is ActuatorType {
        const actuatorValueSet: (ActuatorType|string)[] = Object.values(ActuatorType);

        return actuatorValueSet.includes(key);
    }

    protected async send(command: ActuatorType, index: number, value: number): Promise<void> {
        return await this.buttplugClientDevice.scalar({
            'ActuatorType': command,
            'Scalar': value,
            'Index': index
        });
    }

    public get getButtplugClientDevice(): ButtplugClientDevice
    {
        return this.buttplugClientDevice;
    }
}
