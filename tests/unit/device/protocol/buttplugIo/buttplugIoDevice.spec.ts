import {ButtplugClientDevice, DeviceOutputCommand, OutputType} from "buttplug";
import {Mock} from "@vitest/spy";
import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import ButtplugIoDevice, {
    ButtplugIoDeviceAttributeKey,
    ButtplugIoDeviceAttributes
} from "../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js";
import {DeviceAttributeModifier} from "../../../../../src/device/attribute/deviceAttribute.js";
import {Int} from "../../../../../src/util/numbers.js";
import {describe, it, expect, vi} from "vitest";
import {EventEmitter} from "events";

type RunOutputFn = (cmd: DeviceOutputCommand) => Promise<void>;

function makeDeviceStub(entries: Array<[number, { runOutput: Mock<RunOutputFn> }]>): ButtplugClientDevice {
    return { features: new Map(entries) } as unknown as ButtplugClientDevice;
}

describe('ButtplugIoDevice', () => {

    function createDevice(buttplugDevice: ButtplugClientDevice, attrs: ButtplugIoDeviceAttributes): ButtplugIoDevice
    {
        return new ButtplugIoDevice(
            'device-id',
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            buttplugDevice,
            attrs,
            new EventEmitter(),
        );
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const device = createDevice(makeDeviceStub([]), {});
        const attrName = 'bool' as ButtplugIoDeviceAttributeKey;

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {

        // Arrange
        const runOutput = vi.fn<RunOutputFn>().mockResolvedValue(undefined);
        const boolAttrKey = `${OutputType.Vibrate}-1` as ButtplugIoDeviceAttributeKey;

        const boolAttr = BoolDeviceAttribute.create(boolAttrKey, undefined, DeviceAttributeModifier.readWrite);

        const device = createDevice(
            makeDeviceStub([[1, {runOutput}]]),
            {[boolAttrKey]: boolAttr},
        );

        // Act
        await device.setAttribute(boolAttrKey, false);

        // Assert
        expect((await device.getAttribute(boolAttrKey))?.value).toStrictEqual(false);

        expect(runOutput).toHaveBeenCalledTimes(1);
        const cmd = runOutput.mock.calls[0][0];
        expect(cmd.outputType).toBe(OutputType.Vibrate);
        expect(cmd.value).toBe(0);
    });

    it('it updates device data and calls buttplugClientDevice on setting range attribute', async () => {

        // Arrange
        const runOutput = vi.fn<RunOutputFn>().mockResolvedValue(undefined);

        const rangeAttrName = `${OutputType.Vibrate}-2` as ButtplugIoDeviceAttributeKey;
        const rangeAttr = IntRangeDeviceAttribute.create(
            rangeAttrName,
            undefined,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.ZERO,
            Int.from(20),
            Int.from(1),
        );

        const device = createDevice(
            makeDeviceStub([[2, {runOutput}]]),
            {[rangeAttrName]: rangeAttr},
        );

        const newValue = 5;

        // Act
        await device.setAttribute(rangeAttrName, Int.from(newValue));

        // Assert
        expect((await device.getAttribute(rangeAttrName))?.value).toStrictEqual(newValue);

        expect(runOutput).toHaveBeenCalledTimes(1);
        const cmd = runOutput.mock.calls[0][0];
        expect(cmd.outputType).toBe(OutputType.Vibrate);
        expect(cmd.value).toBeCloseTo(newValue / 20);
    });
});
