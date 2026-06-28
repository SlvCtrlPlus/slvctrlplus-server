import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import Zc95Device, { Zc95DeviceAttributes } from '../../../../../src/device/protocol/zc95/zc95Device.js';
import Zc95Protocol, { MsgAndResponseIdentifier, MsgResponse } from '../../../../../src/device/protocol/zc95/zc95Protocol.js';
import DeviceBidirectionalTransport from '../../../../../src/device/transport/deviceBidirectionalTransport.js';
import MessageResponseHandler from '../../../../../src/device/protocol/messageResponseHandler.js';
import Zc95MessageFactory, {
    AckMsgResponse,
    PatternDetailsMsgResponse,
    PowerStatusMsgResponse,
} from '../../../../../src/device/protocol/zc95/zc95MessageFactory.js';
import IntRangeDeviceAttribute from '../../../../../src/device/attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute, {
    InitializedListDeviceAttribute,
} from '../../../../../src/device/attribute/listDeviceAttribute.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../../../src/util/numbers.js';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('Zc95Device', () => {
    let mockProtocol: MockProxy<Zc95Protocol>;
    let mockTransport: MockProxy<DeviceBidirectionalTransport>;
    let mockMsgHandler: MockProxy<MessageResponseHandler<Zc95Protocol>>;
    let mockMsgFactory: MockProxy<Zc95MessageFactory>;
    let mockLogger: MockProxy<Logger>;

    const fakeMsgId = {} as MsgAndResponseIdentifier<any, any>;
    const okResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'OK' };
    const errorResponse: AckMsgResponse = { Type: 'Ack', MsgId: 1, Result: 'ERROR', Error: 'something went wrong' };

    function createActivePatternAttr(
        currentValue: Int = Int.from(0)
    ): InitializedListDeviceAttribute<Int, string> {
        return ListDeviceAttribute.createInitialized<Int, string>(
            'activePattern',
            'Active Pattern',
            DeviceAttributeModifier.readWrite,
            [
                { key: Int.from(0), value: 'Pattern A' },
                { key: Int.from(1), value: 'Pattern B' },
            ],
            currentValue,
        );
    }

    function createPatternStartedAttr(initialValue: boolean = false) {
        return BoolDeviceAttribute.createInitialized(
            'patternStarted',
            'Pattern Started',
            DeviceAttributeModifier.readWrite,
            initialValue,
        );
    }

    function createPowerChannelAttrs(): Pick<
        Zc95DeviceAttributes,
        'powerChannel1' | 'powerChannel2' | 'powerChannel3' | 'powerChannel4'
    > {
        const makeAttr = (ch: number) =>
            IntRangeDeviceAttribute.createInitialized(
                `powerChannel${ch}`,
                `Channel ${ch}`,
                DeviceAttributeModifier.readWrite,
                undefined,
                Int.ZERO,
                Int.from(100),
                Int.from(1),
                Int.from(10),
            );

        return {
            powerChannel1: makeAttr(1),
            powerChannel2: makeAttr(2),
            powerChannel3: makeAttr(3),
            powerChannel4: makeAttr(4),
        };
    }

    function createDevice(attrs: Zc95DeviceAttributes): Zc95Device {
        return new Zc95Device(
            DeviceId.create('device-id'),
            'Test Device',
            'zc95',
            new Date(),
            '1.0.0',
            mockProtocol,
            mockTransport,
            true,
            attrs,
            {},
            mockMsgFactory,
            mockMsgHandler,
            new EventEmitter(),
            mockLogger,
        );
    }

    function getOnReceiveCallback(): (data: Buffer) => void {
        return mockTransport.onReceive.mock.calls[0][0];
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
            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(),
            });

            await expect(
                device.setAttribute('powerChannel1', Int.from(5))
            ).rejects.toThrow("Attribute with name 'powerChannel1' does not exist for this device");
        });

        it('throws an error when the value type is invalid for the attribute', async () => {
            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(),
            });

            await expect(
                device.setAttribute('patternStarted', 'not-a-bool')
            ).rejects.toThrow();
        });

        describe('activePattern', () => {
            it('does not send any messages when the pattern is already active', async () => {
                const device = createDevice({
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('activePattern', Int.from(0));

                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('switches to the new pattern when a different pattern is selected', async () => {
                const device = createDevice({
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('activePattern', Int.from(1));

                const activePattern = await device.getAttribute('activePattern');
                expect(activePattern?.value).toStrictEqual(Int.from(1));
                expect(mockMsgHandler.send).not.toHaveBeenCalled();
            });

            it('stops the running pattern before switching to the new pattern', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                });

                await device.setAttribute('activePattern', Int.from(1));

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);
                const activePattern = await device.getAttribute('activePattern');
                expect(activePattern?.value).toStrictEqual(Int.from(1));
            });
        });

        describe('patternStarted', () => {
            it('does not send any messages when the pattern is already in the requested state', async () => {
                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(false),
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('patternStarted', true);

                expect(mockMsgFactory.createGetPatternDetails).toHaveBeenCalledWith(Int.from(0));
                expect(mockMsgFactory.createPatternStart).toHaveBeenCalledWith(Int.from(0));
                expect(mockMsgHandler.send).toHaveBeenCalledTimes(2);

                const patternStarted = await device.getAttribute('patternStarted');
                expect(patternStarted?.value).toStrictEqual(true);
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('patternStarted', true);

                expect(await device.getAttribute('powerChannel1')).toBeDefined();
                expect(await device.getAttribute('powerChannel2')).toBeDefined();
                expect(await device.getAttribute('powerChannel3')).toBeDefined();
                expect(await device.getAttribute('powerChannel4')).toBeDefined();
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('patternStarted', true);

                const patternAttr = await device.getAttribute('patternAttribute5');
                expect(patternAttr).toBeDefined();
                expect(patternAttr).toBeInstanceOf(IntRangeDeviceAttribute);
                expect(patternAttr?.value).toStrictEqual(Int.from(50));
            });

            it('converts UoM "us" to "µs" when creating pattern attributes', async () => {
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('patternStarted', true);

                const patternAttr = await device.getAttribute('patternAttribute3');
                expect(patternAttr).toBeInstanceOf(IntRangeDeviceAttribute);
                if (!(patternAttr instanceof IntRangeDeviceAttribute)) return;
                expect(patternAttr.uom).toStrictEqual('µs');
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await device.setAttribute('patternStarted', true);

                const patternAttr = await device.getAttribute('patternAttribute7');
                expect(patternAttr).toBeDefined();
                expect(patternAttr).toBeInstanceOf(ListDeviceAttribute);
                expect(patternAttr?.value).toStrictEqual(Int.from(0));
            });

            it('sends PatternStop and removes power/pattern attributes when stopping', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                    patternAttribute1: IntRangeDeviceAttribute.createInitialized(
                        'patternAttribute1',
                        'Intensity',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                        Int.from(50),
                    ),
                });

                await device.setAttribute('patternStarted', false);

                expect(mockMsgFactory.createPatternStop).toHaveBeenCalledTimes(1);

                const patternStarted = await device.getAttribute('patternStarted');
                expect(patternStarted?.value).toStrictEqual(false);
                expect(await device.getAttribute('powerChannel1')).toBeUndefined();
                expect(await device.getAttribute('patternAttribute1')).toBeUndefined();
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
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(false),
                });

                await expect(device.setAttribute('patternStarted', true)).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong'
                );
            });

            it('throws when the PatternStop response is not OK', async () => {
                mockMsgFactory.createPatternStop.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(Int.from(0)),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                });

                await expect(device.setAttribute('patternStarted', false)).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong'
                );
            });
        });

        describe('powerChannel', () => {
            it('sends SetPower with all channel values multiplied by 10', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                });

                await device.setAttribute('powerChannel1', Int.from(20));

                expect(mockMsgFactory.createSetPower).toHaveBeenCalledWith(200, 100, 100, 100);
            });

            it('updates the attribute value after a successful SetPower', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                });

                await device.setAttribute('powerChannel3', Int.from(42));

                const attr = await device.getAttribute('powerChannel3');
                expect(attr?.value).toStrictEqual(Int.from(42));
            });

            it('throws when the SetPower response is not OK', async () => {
                mockMsgFactory.createSetPower.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    ...createPowerChannelAttrs(),
                });

                await expect(device.setAttribute('powerChannel2', Int.from(5))).rejects.toThrow(
                    'Device response is not OK, but ERROR: something went wrong'
                );
            });

            it('throws when not all power channel values are initialized', async () => {
                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    powerChannel1: IntRangeDeviceAttribute.create(
                        'powerChannel1',
                        'Channel 1',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                    ),
                    powerChannel2: IntRangeDeviceAttribute.create(
                        'powerChannel2',
                        'Channel 2',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                    ),
                    powerChannel3: IntRangeDeviceAttribute.create(
                        'powerChannel3',
                        'Channel 3',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                    ),
                    powerChannel4: IntRangeDeviceAttribute.create(
                        'powerChannel4',
                        'Channel 4',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                    ),
                });

                await expect(device.setAttribute('powerChannel1', Int.from(5))).rejects.toThrow(
                    'Cannot set channel power before all channel values have been initialized'
                );
            });
        });

        describe('patternAttribute (MinMax)', () => {
            it('sends PatternMinMaxChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMinMaxChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    patternAttribute5: IntRangeDeviceAttribute.createInitialized(
                        'patternAttribute5',
                        'Intensity',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                        Int.from(50),
                    ),
                });

                await device.setAttribute('patternAttribute5', Int.from(75));

                expect(mockMsgFactory.createPatternMinMaxChange).toHaveBeenCalledWith(5, Int.from(75));
                const attr = await device.getAttribute('patternAttribute5');
                expect(attr?.value).toStrictEqual(Int.from(75));
            });

            it('throws when the PatternMinMaxChange response is not OK', async () => {
                mockMsgFactory.createPatternMinMaxChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    patternAttribute5: IntRangeDeviceAttribute.createInitialized(
                        'patternAttribute5',
                        'Intensity',
                        DeviceAttributeModifier.readWrite,
                        undefined,
                        Int.ZERO,
                        Int.from(100),
                        Int.from(1),
                        Int.from(50),
                    ),
                });

                await expect(
                    device.setAttribute('patternAttribute5', Int.from(75))
                ).rejects.toThrow('Device response is not OK, but ERROR: something went wrong');
            });
        });

        describe('patternAttribute (MultiChoice)', () => {
            it('sends PatternMultiChoiceChange and updates the attribute value', async () => {
                mockMsgFactory.createPatternMultiChoiceChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(okResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    patternAttribute7: ListDeviceAttribute.createInitialized<Int, string>(
                        'patternAttribute7',
                        'Mode',
                        DeviceAttributeModifier.readWrite,
                        [
                            { key: Int.from(0), value: 'Sine' },
                            { key: Int.from(1), value: 'Square' },
                        ],
                        Int.from(0),
                    ),
                });

                await device.setAttribute('patternAttribute7', Int.from(1));

                expect(mockMsgFactory.createPatternMultiChoiceChange).toHaveBeenCalledWith(7, Int.from(1));
                const attr = await device.getAttribute('patternAttribute7');
                expect(attr?.value).toStrictEqual(Int.from(1));
            });

            it('throws when the PatternMultiChoiceChange response is not OK', async () => {
                mockMsgFactory.createPatternMultiChoiceChange.mockReturnValue(fakeMsgId);
                mockMsgHandler.send.mockResolvedValue(errorResponse);

                const device = createDevice({
                    activePattern: createActivePatternAttr(),
                    patternStarted: createPatternStartedAttr(true),
                    patternAttribute7: ListDeviceAttribute.createInitialized<Int, string>(
                        'patternAttribute7',
                        'Mode',
                        DeviceAttributeModifier.readWrite,
                        [
                            { key: Int.from(0), value: 'Sine' },
                            { key: Int.from(1), value: 'Square' },
                        ],
                        Int.from(0),
                    ),
                });

                await expect(
                    device.setAttribute('patternAttribute7', Int.from(1))
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

        it('updates the channel max and value from power status', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(true),
                ...createPowerChannelAttrs(),
            });

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // value = floor(MaxOutputPower * 0.1) = floor(500 * 0.1) = 50
            // max   = floor(PowerLimit * 0.1)     = floor(700 * 0.1) = 70
            const ch1 = await device.getAttribute('powerChannel1');
            expect(ch1?.value).toStrictEqual(Int.from(50));
            expect(ch1?.max).toStrictEqual(Int.from(70));

            // value = floor(300 * 0.1) = 30, max = floor(1000 * 0.1) = 100
            const ch2 = await device.getAttribute('powerChannel2');
            expect(ch2?.value).toStrictEqual(Int.from(30));
            expect(ch2?.max).toStrictEqual(Int.from(100));
        });

        it('sets value to MaxOutputPower percentage even when current value exceeded the power limit', async () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            const overLimitAttrs = createPowerChannelAttrs();
            overLimitAttrs.powerChannel1 = IntRangeDeviceAttribute.createInitialized(
                'powerChannel1',
                'Channel 1',
                DeviceAttributeModifier.readWrite,
                undefined,
                Int.ZERO,
                Int.from(100),
                Int.from(1),
                Int.from(90), // current value 90 was above the new power limit of 70
            );

            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(true),
                ...overLimitAttrs,
            });

            const onReceive = getOnReceiveCallback();
            onReceive(buildPowerStatusBuffer(powerStatusMsg));

            // Final value = floor(MaxOutputPower * 0.1) = floor(500 * 0.1) = 50
            // max         = floor(PowerLimit * 0.1) = floor(700 * 0.1) = 70
            const ch1 = await device.getAttribute('powerChannel1');
            expect(ch1?.value).toStrictEqual(Int.from(50));
            expect(ch1?.max).toStrictEqual(Int.from(70));
        });

        it('ignores channels that are not in the attributes', () => {
            mockProtocol.decode.mockReturnValue({ message: powerStatusMsg });

            // No power channel attributes registered
            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(false),
            });

            const onReceive = getOnReceiveCallback();
            expect(() => onReceive(buildPowerStatusBuffer(powerStatusMsg))).not.toThrow();
        });

        it('logs an error and does not throw when message decoding fails', () => {
            mockProtocol.decode.mockReturnValue({
                error: { type: 'invalid_frame', reason: 'bad JSON' },
            });

            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(false),
            });

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

            const device = createDevice({
                activePattern: createActivePatternAttr(),
                patternStarted: createPatternStartedAttr(false),
            });

            const onReceive = getOnReceiveCallback();
            expect(() => onReceive(Buffer.from('{}'))).not.toThrow();
        });
    });
});
