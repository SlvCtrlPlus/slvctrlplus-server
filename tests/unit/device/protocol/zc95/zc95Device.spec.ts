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

describe('Zc95Device', () => {
    let mockProtocol: MockProxy<Zc95Protocol>;
    let mockTransport: MockProxy<DeviceBidirectionalTransport>;
    let mockMsgHandler: MockProxy<MessageResponseHandler<Zc95Protocol>>;
    let mockMsgFactory: MockProxy<Zc95MessageFactory>;
    let mockLogger: MockProxy<Logger>;

    const fakeMsgId = {} as MsgAndResponseIdentifier<any, any>;
    const okResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'OK' };
    const errorResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'ERROR', Error: 'something went wrong' };

    const defaultPatterns = [
        { Type: 'PatternDetail' as const, Id: 0, Name: 'Pattern A' },
        { Type: 'PatternDetail' as const, Id: 1, Name: 'Pattern B' },
    ];

    const defaultPowerChannels = [
        { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 100 },
        { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 100 },
    ];

    const defaultPowerChannelValues = {
        powerChannel1: 0,
        powerChannel2: 0,
        powerChannel3: 0,
        powerChannel4: 0,
    } as const;

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
            activePatternMenuItems: [],
            powerChannels: [],
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
            new EventEmitter(),
            mockLogger,
            overrides.activePatternMenuItems,
            overrides.powerChannelState,
        );
    }

    function createDeviceWithPowerChannels(): Zc95Device {
        const powerChannels = [
            { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 100 },
            { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 100 },
            { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 100 },
            { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 100 },
        ];

        return createDevice({
            attributes: {
                activePattern: 0,
                patternStarted: true,
                powerChannel1: 10,
                powerChannel2: 10,
                powerChannel3: 10,
                powerChannel4: 10,
            },
            attributesSchema: zc95AttributesSchema({
                patterns: defaultPatterns,
                activePatternMenuItems: [],
                powerChannels,
            }),
            powerChannelState: powerChannels,
        });
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
    });

    describe('setAttribute', () => {
        it('throws an error when setting a non-existing attribute', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('powerChannel1', 5),
            ).rejects.toThrow("Attribute with name 'powerChannel1' does not exist for this device");
        });

        describe('activePattern', () => {
            it('does not send any messages when the pattern is already active', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.setAttribute('activePattern', 0);

                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('switches to the new pattern when a different pattern is selected', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.setAttribute('activePattern', 1);

                expect(device.getAttributeValue('activePattern')).toStrictEqual(1);
                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('stops the running pattern before switching to the new pattern', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDeviceWithPowerChannels();

                await device.setAttribute('activePattern', 1);

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);
                expect(device.getAttributeValue('activePattern')).toStrictEqual(1);
            });
        });

        describe('patternStarted', () => {
            it('does not send any messages when the pattern is already in the requested state', async () => {
                const device = createDevice({
                    attributes: { activePattern: 0, patternStarted: false },
                });

                await device.setAttribute('patternStarted', false);

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

                await device.setAttribute('patternStarted', true);

                expect(mockMsgFactory.createGetPatternDetails).toHaveBeenCalledWith(0);
                expect(mockMsgFactory.createPatternStart).toHaveBeenCalledWith(0);
                expect(mockMsgHandler.send).toHaveBeenCalledTimes(2);

                expect(device.getAttributeValue('patternStarted')).toStrictEqual(true);
            });

            it('adds power channel attributes when starting the pattern', async () => {
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

                await device.setAttribute('patternStarted', true);

                expect(device.getAttributeValue('powerChannel1')).toBeDefined();
                expect(device.getAttributeValue('powerChannel2')).toBeDefined();
                expect(device.getAttributeValue('powerChannel3')).toBeDefined();
                expect(device.getAttributeValue('powerChannel4')).toBeDefined();
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

                await device.setAttribute('patternStarted', true);

                // The value is the default from the menu item
                expect(device.getAttributeValue('patternAttribute5')).toStrictEqual(50);

                // Schema should describe a range property
                const schema = device.getAttributesSchema();
                const propSchema = schema.properties['patternAttribute5'];
                expect(propSchema).toBeDefined();
                expect(propSchema).toHaveProperty('minimum', 0);
                expect(propSchema).toHaveProperty('maximum', 100);
                expect(propSchema).toHaveProperty('x-increment-step', 1);
            });

            it('converts UoM "us" to "µs" in the schema', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [
                        {
                            Id: 3,
                            Title: 'Pulse Width',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 100,
                            Min: 0,
                            Max: 1000,
                            IncrementStep: 10,
                            UoM: 'us',
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

                await device.setAttribute('patternStarted', true);

                const schema = device.getAttributesSchema();
                const propSchema = schema.properties['patternAttribute3'];
                expect(propSchema).toHaveProperty('x-uom', 'µs');
            });

            it('creates MultiChoice pattern attributes from pattern details when starting', async () => {
                const patternDetailsResponse: PatternDetailsMsgResponse = {
                    Type: 'PatternDetail',
                    MsgId: 1,
                    Result: 'OK',
                    Name: 'Pattern A',
                    Id: 0,
                    ButtonA: '',
                    MenuItems: [
                        {
                            Id: 7,
                            Title: 'Mode',
                            Group: 0,
                            Type: 'MULTI_CHOICE',
                            Default: 0,
                            Choices: [
                                { Id: 0, Name: 'Sine' },
                                { Id: 1, Name: 'Square' },
                            ],
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

                await device.setAttribute('patternStarted', true);

                // Value is the default
                expect(device.getAttributeValue('patternAttribute7')).toStrictEqual(0);

                // Schema should describe a list property with oneOf
                const schema = device.getAttributesSchema();
                const propSchema = schema.properties['patternAttribute7'];
                expect(propSchema).toBeDefined();
                expect(propSchema).toHaveProperty('oneOf');
            });

            it('sends PatternStop and removes power/pattern attributes when stopping', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        powerChannel1: 10,
                        powerChannel2: 10,
                        powerChannel3: 10,
                        powerChannel4: 10,
                        patternAttribute1: 50,
                    },
                    attributesSchema: zc95AttributesSchema({
                        patterns: defaultPatterns,
                        activePatternMenuItems: [{
                            Id: 1,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        }],
                        powerChannels: [
                            { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 100 },
                            { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 100 },
                            { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 100 },
                            { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 100 },
                        ],
                    }),
                });

                await device.setAttribute('patternStarted', false);

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);

                expect(device.getAttributeValue('patternStarted')).toStrictEqual(false);
                expect(device.getAttributeValue('powerChannel1')).toBeUndefined();
                expect(device.getAttributeValue('patternAttribute1')).toBeUndefined();
            });

            it('throws when the PatternStart response is not OK', async () => {
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

                await expect(device.setAttribute('patternStarted', true)).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong',
                );
            });

            it('throws when the PatternStop response is not OK', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDeviceWithPowerChannels();

                await expect(device.setAttribute('patternStarted', false)).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong',
                );
            });
        });

        describe('powerChannel', () => {
            it('sends SetPower with all channel values multiplied by 10', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDeviceWithPowerChannels();

                await device.setAttribute('powerChannel1', 20);

                expect(mockMsgFactory.createSetPower).toHaveBeenCalledWith(200, 100, 100, 100);
            });

            it('updates the attribute value after a successful SetPower', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDeviceWithPowerChannels();

                await device.setAttribute('powerChannel3', 42);

                expect(device.getAttributeValue('powerChannel3')).toStrictEqual(42);
            });

            it('throws when the SetPower response is not OK', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDeviceWithPowerChannels();

                await expect(device.setAttribute('powerChannel2', 5)).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong',
                );
            });

            it('throws when pattern is not started', async () => {
                const device = createDevice();

                await expect(device.setAttribute('powerChannel1', 5)).rejects.toThrow(
                    "Attribute with name 'powerChannel1' does not exist for this device",
                );
            });
        });

        describe('patternAttribute (MinMax)', () => {
            it('sends PatternMinMaxChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMinMaxChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        patternAttribute5: 50,
                    },
                    attributesSchema: zc95AttributesSchema({
                        patterns: defaultPatterns,
                        activePatternMenuItems: [{
                            Id: 5,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        }],
                        powerChannels: [],
                    }),
                });

                await device.setAttribute('patternAttribute5', 75);

                expect(mockMsgFactory.createPatternMinMaxChange).toHaveBeenCalledWith(5, 75);
                expect(device.getAttributeValue('patternAttribute5')).toStrictEqual(75);
            });

            it('throws when the PatternMinMaxChange response is not OK', async () => {
                mockMsgFactory.createPatternMinMaxChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        patternAttribute5: 50,
                    },
                    attributesSchema: zc95AttributesSchema({
                        patterns: defaultPatterns,
                        activePatternMenuItems: [{
                            Id: 5,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        }],
                        powerChannels: [],
                    }),
                });

                await expect(
                    device.setAttribute('patternAttribute5', 75),
                ).rejects.toThrow('Device response is not OK, but ERROR: something went wrong');
            });
        });

        describe('patternAttribute (MultiChoice)', () => {
            it('sends PatternMultiChoiceChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMultiChoiceChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        patternAttribute7: 0,
                    },
                    attributesSchema: zc95AttributesSchema({
                        patterns: defaultPatterns,
                        activePatternMenuItems: [{
                            Id: 7,
                            Title: 'Mode',
                            Group: 0,
                            Type: 'MULTI_CHOICE',
                            Default: 0,
                            Choices: [
                                { Id: 0, Name: 'Sine' },
                                { Id: 1, Name: 'Square' },
                            ],
                        }],
                        powerChannels: [],
                    }),
                });

                await device.setAttribute('patternAttribute7', 1);

                expect(mockMsgFactory.createPatternMultiChoiceChange).toHaveBeenCalledWith(7, 1);
                expect(device.getAttributeValue('patternAttribute7')).toStrictEqual(1);
            });

            it('throws when the PatternMultiChoiceChange response is not OK', async () => {
                mockMsgFactory.createPatternMultiChoiceChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    attributes: {
                        activePattern: 0,
                        patternStarted: true,
                        patternAttribute7: 0,
                    },
                    attributesSchema: zc95AttributesSchema({
                        patterns: defaultPatterns,
                        activePatternMenuItems: [{
                            Id: 7,
                            Title: 'Mode',
                            Group: 0,
                            Type: 'MULTI_CHOICE',
                            Default: 0,
                            Choices: [
                                { Id: 0, Name: 'Sine' },
                                { Id: 1, Name: 'Square' },
                            ],
                        }],
                        powerChannels: [],
                    }),
                });

                await expect(
                    device.setAttribute('patternAttribute7', 1),
                ).rejects.toThrow('Device response is not OK, but ERROR: something went wrong');
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

        it('updates the channel value from power status', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createDeviceWithPowerChannels();

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // value = floor(MaxOutputPower / 10) = floor(500 / 10) = 50
            expect(device.getAttributeValue('powerChannel1')).toStrictEqual(50);

            // value = floor(300 / 10) = 30
            expect(device.getAttributeValue('powerChannel2')).toStrictEqual(30);
        });

        it('updates the schema max from power limit', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createDeviceWithPowerChannels();

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // max = floor(PowerLimit / 10) = floor(700 / 10) = 70
            const schema = device.getAttributesSchema();
            expect(schema.properties['powerChannel1']).toHaveProperty('maximum', 70);

            // max = floor(1000 / 10) = 100
            expect(schema.properties['powerChannel2']).toHaveProperty('maximum', 100);
        });

        it('sets value to MaxOutputPower percentage even when current value exceeded the power limit', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createDevice({
                attributes: {
                    activePattern: 0,
                    patternStarted: true,
                    powerChannel1: 90, // current value 90 exceeds new power limit of 70
                    powerChannel2: 10,
                    powerChannel3: 10,
                    powerChannel4: 10,
                },
                attributesSchema: zc95AttributesSchema({
                    patterns: defaultPatterns,
                    activePatternMenuItems: [],
                    powerChannels: [
                        { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 100 },
                        { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 100 },
                        { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 100 },
                        { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 100 },
                    ],
                }),
            });

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // Final value = floor(MaxOutputPower / 10) = floor(500 / 10) = 50
            expect(device.getAttributeValue('powerChannel1')).toStrictEqual(50);
        });

        it('ignores channels that are not in the attributes', () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            // No power channel attributes registered
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
