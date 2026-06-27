import { EventEmitter } from "events";
import Device, {DeviceAttributes} from "../../../src/device/device.js";
import ExtractAttributeValue from "../../../src/device/device.js";
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

    public setAttribute<
        K extends keyof DeviceAttributes,
        V extends ExtractAttributeValue<DeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        throw new Error("Method not implemented.");
    }
}

export const createTestDevice = (): TestDevice => {
    return new TestDevice(DeviceId.create('foo'), 'Foo', new Date(), false, new EventEmitter());
}
