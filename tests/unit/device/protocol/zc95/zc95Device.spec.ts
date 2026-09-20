import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import Zc95Device, {
    Zc95DevicePowerChannelIndex,
} from '../../../../../src/device/protocol/zc95/zc95Device.js';
import type { Zc95AttributeValues, PowerChannelState } from '../../../../../src/device/protocol/zc95/zc95Device.js';
import type { MinMaxMenuItem, MultiChoiceMenuItem } from '../../../../../src/device/protocol/zc95/zc95MessageFactory.js';
import Zc95Protocol, { MsgAndResponseIdentifier, MsgResponse } from '../../../../../src/device/protocol/zc95/zc95Protocol.js';
import DeviceBidirectionalTransport from '../../../../../src/device/transport/deviceBidirectionalTransport.js';
import MessageResponseHandler from '../../../../../src/device/protocol/messageResponseHandler.js';
import Zc95MessageFactory, {
    AckMsgResponse,
    PatternDetailsMsgResponse,
    PowerStatusMsgResponse,
} from '../../../../../src/device/protocol/zc95/zc95MessageFactory.js';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import Logger from '../../../../../src/logging/Logger.js';
import assert from 'assert';
import { zc95AttributesSchema } from '../../../../../src/device/protocol/zc95/zc95AttributesSchema.js';
import JsonSchemaValidatorFactory from '../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import DeviceDataValidationError from '../../../../../src/device/deviceDataValidationError.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { registerAttributeSchemaKeywords } from '../../../../../src/device/attribute/attributeSchemaKeywords.js';

describe('Zc95Device', () => {
    let mockProtocol: MockProxy<Zc95Protocol>;
    let mockTransport: MockProxy<DeviceBidirectionalTransport>;
    let mockMsgHandler: MockProxy<MessageResponseHandler<Zc95Protocol>>;
    let mockMsgFactory: MockProxy<Zc95MessageFactory>;
    let mockLogger: MockProxy<Logger>;
    let validatorFactory: JsonSchemaValidatorFactory;

    const fakeMsgId = {} as MsgAndResponseIdentifier<any, any>;
    const okResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'OK' };
    const errorResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'ERROR', Error: 'something went wrong' };

    const defaultPatterns = [
        { Type: 'PatternDetail' as const, Id: 0, Name: 'Pattern A' },
        { Type: 'PatternDetail' as const, Id: 1, Name: 'Pattern B' },
    ];

    const defaultPowerChannels: PowerChannelState[] = [
        { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 100 },
    ];

    type CreateDeviceOverrides = {
        attributes?: Zc95AttributeValues;
        attributesSchema?: ReturnType<typeof zc95AttributesSchema>;
        patterns?: typeof defaultPatterns;
        activePatternMenuItems?: (MinMaxMenuItem | MultiChoiceMenuItem)[];
        powerChannelState?: PowerChannelState[];
    };

    function createDevice(overrides: CreateDeviceOverrides = {}): Zc95Device {
        const patterns = overrides.patterns ?? defaultPatterns;
        const attributes: Zc95AttributeValues = overrides.attributes ?? {
            activePattern: 0,
            patternStarted: false,
        };
        const attributesSchema = overrides.attributesSchema ?? zc95AttributesSchema({
            patterns,
            activePatternMenuItems: overrides.activePatternMenuItems ?? [],
            powerChannels: overrides.powerChannelState ?? [],
        });

        return new Zc95Device(
            {
                deviceId: DeviceId.create('device-id'),
                deviceName: 'Test Device',
                provider: 'zc95',
                connectedSince: new Date(),
                controllable: true,
            },
            '1.0.0',
            mockProtocol,
            mockTransport,
            attributesSchema,
            attributes,
            patterns,
            {},
            mockMsgFactory,
            mockMsgHandler,
            validatorFactory,
            new EventEmitter(),
            mockLogger,
            overrides.activePatternMenuItems,
            overrides.powerChannelState,
        );
    }

    function createStartedDevice(): Zc95Device {
        return createDevice({
            attributes: {
                activePattern: 0,
                patternStarted: true,
                powerChannels: { 1: 10, 2: 10, 3: 10, 4: 10 },
                patternAttributes: {},
            },
            powerChannelState: defaultPowerChannels,
        });
    }

    /** Helper to read powerChannels from a started device with power channels. */
    function getPowerChannels(device: Zc95Device): Record<string, number> {
        assert(device.isPatternStarted());
        const data = device.getDeviceData();
        assert('powerChannels' in data, 'Expected powerChannels to be present');
        return data.powerChannels;
    }

    function getOnReceiveCallback(): (data: Buffer) => void {
        const call = mockTransport.onReceive.mock.calls[0];
        assert(call !== undefined, 'Expected onReceive to have been registered');

        return call[0];
    }

    beforeEach(() => {
        mockProtocol = mock<Zc95Protocol>();
        mockTransport = mock<DeviceBidirectionalTransport>();
        mockMsgHandler = mock<MessageResponseHandler<Zc95Protocol>>();
        mockMsgFactory = mock<Zc95MessageFactory>();
        mockLogger = mock<Logger>();

        mockTransport.getDeviceIdentifier.mockReturnValue('test-device');
        mockLogger.child.mockReturnValue(mockLogger);

        // Real ajv with x-* keywords so validation works end-to-end
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        registerAttributeSchemaKeywords(ajv);
        validatorFactory = new JsonSchemaValidatorFactory(ajv);
    });

    describe('updateDeviceData', () => {
        describe('result envelope', () => {
            it('returns deviceData and empty errors on success', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                const result = await device.updateDeviceData({ activePattern: 1 });

                expect(result.deviceData.activePattern).toStrictEqual(1);
                expect(result.errors).toStrictEqual([]);
            });
        });

        describe('validation', () => {
            it('throws DeviceDataValidationError when update violates schema', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                // activePattern 999 doesn't match any oneOf const value
                await expect(
                    device.updateDeviceData({ activePattern: 999 }),
                ).rejects.toThrow(DeviceDataValidationError);
            });

            it('includes validation error details in the thrown error', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                const error = await device.updateDeviceData({ activePattern: 999 }).catch((e: unknown) => e);

                assert(error instanceof DeviceDataValidationError);
                expect(error.validationErrors.length).toBeGreaterThan(0);
            });
        });

        describe('activePattern', () => {
            it('does not send any messages when the pattern is already active', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ activePattern: 0 });

                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('switches to the new pattern when a different pattern is selected', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ activePattern: 1 });

                expect(device.getDeviceData().activePattern).toStrictEqual(1);
                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('stops the running pattern before switching to the new pattern', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createStartedDevice();

                await device.updateDeviceData({ activePattern: 1 });

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);
                expect(device.getDeviceData().activePattern).toStrictEqual(1);
            });
        });

        describe('patternStarted', () => {
            it('does not send any messages when the pattern is already in the requested state', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ patternStarted: false });

                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('fetches pattern details and sends PatternStart when starting', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [],
                };

                mockMsgFactory.createGetPatternDetails.mockReturnValue(fakeMsgId);
                mockMsgFactory.createPatternStart.mockReturnValue(fakeMsgId);
                mockMsgHandler.send
                    .mockResolvedValueOnce(patternDetailsResponse)
                    .mockResolvedValueOnce(okResponse);

                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ patternStarted: true });

                expect(mockMsgFactory.createGetPatternDetails).toHaveBeenCalledWith(0);
                expect(mockMsgFactory.createPatternStart).toHaveBeenCalledWith(0);
                expect(mockMsgHandler.send).toHaveBeenCalledTimes(2);

                expect(device.getDeviceData().patternStarted).toStrictEqual(true);
            });

            it('does NOT seed powerChannels on pattern start (waits for PowerStatus)', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [],
                };

                mockMsgFactory.createGetPatternDetails.mockReturnValue(fakeMsgId);
                mockMsgFactory.createPatternStart.mockReturnValue(fakeMsgId);
                mockMsgHandler.send
                    .mockResolvedValueOnce(patternDetailsResponse)
                    .mockResolvedValueOnce(okResponse);

                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ patternStarted: true });

                assert(device.isPatternStarted());
                // powerChannels should NOT be present yet
                expect('powerChannels' in device.getDeviceData()).toBe(false);
            });

            it('creates MinMax pattern attributes from pattern details when starting', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [
                        {
                            Id: 5,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        },
                    ],
                };

                mockMsgFactory.createGetPatternDetails.mockReturnValue(fakeMsgId);
                mockMsgFactory.createPatternStart.mockReturnValue(fakeMsgId);
                mockMsgHandler.send
                    .mockResolvedValueOnce(patternDetailsResponse)
                    .mockResolvedValueOnce(okResponse);

                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.updateDeviceData({ patternStarted: true });

                assert(device.isPatternStarted());
                const data = device.getDeviceData();
                assert(data.patternStarted);
                expect(data.patternAttributes).toStrictEqual({ '5': 50 });
            });

            it('sends PatternStop and removes powerChannels/patternAttributes when stopping', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createStartedDevice();

                await device.updateDeviceData({ patternStarted: false });

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);
                expect(device.getDeviceData().patternStarted).toStrictEqual(false);
                expect(device.isPatternStarted()).toBe(false);
            });

            it('collects error when the PatternStart response is not OK', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [],
                };

                mockMsgFactory.createGetPatternDetails.mockReturnValue(fakeMsgId);
                mockMsgFactory.createPatternStart.mockReturnValue(fakeMsgId);
                mockMsgHandler.send
                    .mockResolvedValueOnce(patternDetailsResponse)
                    .mockResolvedValueOnce(errorResponse);

                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                const result = await device.updateDeviceData({ patternStarted: true });

                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0]?.path).toBe('/patternStarted');
                expect(result.errors[0]?.message).toContain('Device response is not OK');
            });

            it('collects error when the PatternStop response is not OK', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createStartedDevice();

                const result = await device.updateDeviceData({ patternStarted: false });

                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0]?.path).toBe('/patternStarted');
                expect(result.errors[0]?.message).toContain('Device response is not OK');
            });
        });

        describe('powerChannels', () => {
            it('sends SetPower with all channel values multiplied by 10', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createStartedDevice();

                assert(device.isPatternStarted());
                await device.updateDeviceData({ powerChannels: { 1: 20, 2: 10, 3: 10, 4: 10 } });

                expect(mockMsgFactory.createSetPower).toHaveBeenCalledWith(200, 100, 100, 100);
            });

            it('updates the attribute value after a successful SetPower', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createStartedDevice();

                assert(device.isPatternStarted());
                await device.updateDeviceData({ powerChannels: { 3: 42 } });

                const pc = getPowerChannels(device);
                expect(pc['3']).toStrictEqual(42);
            });

            it('collects error when the SetPower response is not OK', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createStartedDevice();

                assert(device.isPatternStarted());
                const result = await device.updateDeviceData({ powerChannels: { 1: 5 } });

                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0]?.path).toBe('/powerChannels');
                expect(result.errors[0]?.message).toContain('Device response is not OK');
            });

            it('throws validation error when power channels update violates schema bounds', async () => {
                // Started device without power channel state — schema has max=0 for all channels
                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        patternAttributes: {},
                    },
                });

                assert(device.isPatternStarted());
                // Value 5 exceeds max=0 in the schema → validation failure
                await expect(
                    device.updateDeviceData({ powerChannels: { 1: 5 } }),
                ).rejects.toThrow(DeviceDataValidationError);
            });
        });

        describe('patternAttributes (MinMax)', () => {
            it('sends PatternMinMaxChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMinMaxChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const menuItem: MinMaxMenuItem = {
                    Id: 5,
                    Title: 'Intensity',
                    Group: 0,
                    Type: 'MIN_MAX',
                    Default: 50,
                    Min: 0,
                    Max: 100,
                    IncrementStep: 1,
                    UoM: '%',
                };

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        powerChannels: { 1: 0, 2: 0, 3: 0, 4: 0 },
                        patternAttributes: { '5': 50 },
                    },
                    activePatternMenuItems: [menuItem],
                    powerChannelState: defaultPowerChannels,
                });

                assert(device.isPatternStarted());
                await device.updateDeviceData({ patternAttributes: { '5': 75 } });

                expect(mockMsgFactory.createPatternMinMaxChange).toHaveBeenCalledWith(5, 75);
                const data = device.getDeviceData();
                assert(data.patternStarted);
                expect(data.patternAttributes['5']).toStrictEqual(75);
            });
        });

        describe('patternAttributes (MultiChoice)', () => {
            it('sends PatternMultiChoiceChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMultiChoiceChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const menuItem: MultiChoiceMenuItem = {
                    Id: 7,
                    Title: 'Mode',
                    Group: 0,
                    Type: 'MULTI_CHOICE',
                    Default: 0,
                    Choices: [
                        { Id: 0, Name: 'Sine' },
                        { Id: 1, Name: 'Square' },
                    ],
                };

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        powerChannels: { 1: 0, 2: 0, 3: 0, 4: 0 },
                        patternAttributes: { '7': 0 },
                    },
                    activePatternMenuItems: [menuItem],
                    powerChannelState: defaultPowerChannels,
                });

                assert(device.isPatternStarted());
                await device.updateDeviceData({ patternAttributes: { '7': 1 } });

                expect(mockMsgFactory.createPatternMultiChoiceChange).toHaveBeenCalledWith(7, 1);
                const data = device.getDeviceData();
                assert(data.patternStarted);
                expect(data.patternAttributes['7']).toStrictEqual(1);
            });
        });
    });

    describe('onReceivedMessage (unsolicited power status)', () => {
        function buildPowerStatusBuffer(msg: PowerStatusMsgResponse): Buffer {
            return Buffer.from(JSON.stringify(msg), 'utf-8');
        }

        const powerStatusMsg: PowerStatusMsgResponse = {
            MsgId: -1,
            Type: 'PowerStatus',
            Result: 'OK',
            Channels: [
                { Channel: 1, OutputPower: 200, MaxOutputPower: 500, PowerLimit: 700 },
                { Channel: 2, OutputPower: 100, MaxOutputPower: 300, PowerLimit: 1000 },
                { Channel: 3, OutputPower: 0, MaxOutputPower: 0, PowerLimit: 0 },
                { Channel: 4, OutputPower: 150, MaxOutputPower: 400, PowerLimit: 800 },
            ],
        };

        it('seeds powerChannels on first PowerStatus message', () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            // Started device without powerChannels (loading state)
            const device = createDevice({
                attributes: {
                    activePattern: 0,
                    patternStarted: true,
                    patternAttributes: {},
                },
            });

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            const pc = getPowerChannels(device);

            // value = floor(MaxOutputPower / 10)
            expect(pc['1']).toStrictEqual(50);
            expect(pc['2']).toStrictEqual(30);
        });

        it('updates the channel value from power status', () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createStartedDevice();

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            const pc = getPowerChannels(device);

            // value = floor(MaxOutputPower / 10)
            expect(pc['1']).toStrictEqual(50);
            expect(pc['2']).toStrictEqual(30);
        });

        it('rejects power channel values above the power limit', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createStartedDevice();

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // PowerLimit for channel 1 = 700, max = floor(700 / 10) = 70
            // PowerLimit for channel 2 = 1000, max = floor(1000 / 10) = 100
            await expect(device.updateDeviceData({
                powerChannels: { 1: 71 },
            })).rejects.toThrow(DeviceDataValidationError);

            await expect(device.updateDeviceData({
                powerChannels: { 2: 101 },
            })).rejects.toThrow(DeviceDataValidationError);

            // Values at exactly the limit should pass
            mockMsgHandler.send.mockResolvedValue(okResponse);
            const result = await device.updateDeviceData({
                powerChannels: { 1: 70, 2: 100 },
            });

            const pc = getPowerChannels(device);
            expect(pc['1']).toStrictEqual(70);
            expect(pc['2']).toStrictEqual(100);
            expect(result.errors).toHaveLength(0);
        });

        it('ignores power status when pattern is not started', () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createDevice();

            const onReceive = getOnReceiveCallback();
            expect(() => onReceive(buildPowerStatusBuffer(powerStatusMsg))).not.toThrow();
        });

        it('logs an error and does not throw when message decoding fails', () => {
            mockProtocol.decode.mockReturnValue({
                error: { type: 'invalid_frame', reason: 'bad JSON' },
            });

            const device = createDevice();

            const onReceive = getOnReceiveCallback();
            expect(() => onReceive(Buffer.from('not json'))).not.toThrow();
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('ignores messages that are not PowerStatus', () => {
            const nonPowerStatusMsg: MsgResponse = {
                MsgId: 42,
                Type: 'Ack',
                Result: 'OK',
            };
            mockProtocol.decode.mockReturnValue({ message: nonPowerStatusMsg });

            const device = createDevice();

            const onReceive = getOnReceiveCallback();
            expect(() => onReceive(Buffer.from('{}'))).not.toThrow();
        });
    });
});
