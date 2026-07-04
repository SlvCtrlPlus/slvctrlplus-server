import { EventEmitter } from "events";
import Device, {AttributeKeyOf, AttributeValueOf, DeviceAttributes} from "../../../src/device/device.js";
import { DeviceId } from '../../../src/device/deviceId.js';

export default class TestDevice extends Device
{
    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean,
        eventEmitter: EventEmitter,
    ) {
        super(deviceId, deviceName, 'dummy', connectedSince, controllable, {}, {}, eventEmitter);
    }

    public async setAttribute<
        K extends AttributeKeyOf<DeviceAttributes>,
        V extends AttributeValueOf<DeviceAttributes, K>
    >(_attributeName: K, _value: V): Promise<V> {
        throw new Error("Method not implemented.");
    }
}

export const createTestDevice = (): TestDevice => {
    return new TestDevice(DeviceId.create('foo'), 'Foo', new Date(), false, new EventEmitter());
}
