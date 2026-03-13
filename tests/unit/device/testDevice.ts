import { EventEmitter } from "stream";
import Device, {ExtractAttributeValue, DeviceAttributes} from "../../../src/device/device.js";
import { create } from "domain";

export default class TestDevice extends Device
{
    public constructor(
        deviceId: string,
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
    return new TestDevice('foo', 'Foo', new Date(), false, new EventEmitter());
}
