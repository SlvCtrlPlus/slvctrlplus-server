import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import Zc95DeviceFactory from '../../../../../src/device/protocol/zc95/zc95DeviceFactory.js';
import KnownDeviceRegistry from '../../../../../src/device/knownDeviceRegistry.js';
import KnownDevice from '../../../../../src/settings/knownDevice.js';
import DateFactory from '../../../../../src/factory/dateFactory.js';
import EventEmitterFactory from '../../../../../src/factory/eventEmitterFactory.js';
import Logger from '../../../../../src/logging/Logger.js';
import Zc95Protocol from '../../../../../src/device/protocol/zc95/zc95Protocol.js';
import DeviceBidirectionalTransport from '../../../../../src/device/transport/deviceBidirectionalTransport.js';
import MessageResponseHandler from '../../../../../src/device/protocol/messageResponseHandler.js';
import Zc95MessageFactory, {
    GetPatternsMsg,
    PatternsMsgResponse,
    VersionMsgResponse,
} from '../../../../../src/device/protocol/zc95/zc95MessageFactory.js';
import { MsgAndResponseIdentifier } from '../../../../../src/device/protocol/zc95/zc95Protocol.js';
import { DeviceId, DetectionId } from '../../../../../src/device/deviceId.js';

describe('Zc95DeviceFactory', () => {
    let knownDeviceRegistry: MockProxy<KnownDeviceRegistry>;
    let eventEmitterFactory: EventEmitterFactory;
    let dateFactory: DateFactory;
    let logger: MockProxy<Logger>;
    let mockProtocol: MockProxy<Zc95Protocol>;
    let mockTransport: MockProxy<DeviceBidirectionalTransport>;
    let mockMsgFactory: MockProxy<Zc95MessageFactory>;
    let mockMsgHandler: MockProxy<MessageResponseHandler<Zc95Protocol>>;

    const fakeGetPatternsMsg = {} as MsgAndResponseIdentifier<GetPatternsMsg, PatternsMsgResponse>;
    const patternsResponse: PatternsMsgResponse = {
        Type: 'PatternList',
        MsgId: 1,
        Result: 'OK',
        Patterns: [{ Type: 'PatternDetail', Id: 0, Name: 'Pattern A' }],
    };

    const transportDetectionId = DetectionId.create('transport-device-id');
    const transportDeviceId = DeviceId.fromDetectionId(transportDetectionId);
    const provider = 'usb';

    function baseVersionDetails(overrides: Partial<VersionMsgResponse> = {}): VersionMsgResponse {
        return {
            Type: 'VersionDetails',
            MsgId: 1,
            Result: 'OK',
            ZC95: '2.0.0',
            WsMajor: 1,
            WsMinor: 0,
            ...overrides,
        };
    }

    function createFactory(): Zc95DeviceFactory {
        return new Zc95DeviceFactory(dateFactory, eventEmitterFactory, knownDeviceRegistry, logger);
    }

    beforeEach(() => {
        knownDeviceRegistry = mock<KnownDeviceRegistry>();
        eventEmitterFactory = new EventEmitterFactory();
        dateFactory = new DateFactory();
        logger = mock<Logger>();
        mockProtocol = mock<Zc95Protocol>();
        mockTransport = mock<DeviceBidirectionalTransport>();
        mockMsgFactory = mock<Zc95MessageFactory>();
        mockMsgHandler = mock<MessageResponseHandler<Zc95Protocol>>();

        mockMsgFactory.createGetPatterns.mockReturnValue(fakeGetPatternsMsg);
        mockMsgHandler.send.mockResolvedValue(patternsResponse);
        knownDeviceRegistry.resolve.mockImplementation(
            (deviceId, type, provider) => new KnownDevice(deviceId, 'Generated Name', type, provider)
        );
    });

    it('uses the transport device id and does not persist a known device when no SerialNo is provided (fw <2.0)', async () => {
        const factory = createFactory();

        const device = await factory.create(
            transportDetectionId,
            baseVersionDetails({ SerialNo: undefined }),
            mockProtocol,
            mockTransport,
            mockMsgFactory,
            mockMsgHandler,
            provider,
        );

        expect(device.getDeviceId).toStrictEqual(transportDeviceId);
        expect(device.getDeviceName).toStrictEqual('Generated Name');
        expect(knownDeviceRegistry.resolve).toHaveBeenCalledWith(transportDeviceId, 'zc95', provider);
        expect(knownDeviceRegistry.persist).not.toHaveBeenCalled();
    });

    it('derives a deterministic device id from SerialNo and persists it as a known device when SerialNo is provided', async () => {
        const factory = createFactory();
        const expectedDeviceId = DeviceId.create('ZC95-SERIAL-123');

        const device = await factory.create(
            transportDetectionId,
            baseVersionDetails({ SerialNo: 'ZC95-SERIAL-123' }),
            mockProtocol,
            mockTransport,
            mockMsgFactory,
            mockMsgHandler,
            provider,
        );

        expect(device.getDeviceId).toStrictEqual(expectedDeviceId);
        expect(device.getDeviceId).not.toStrictEqual(transportDeviceId);
        expect(device.getDeviceName).toStrictEqual('Generated Name');
        expect(knownDeviceRegistry.resolve).toHaveBeenCalledWith(expectedDeviceId, 'zc95', provider);
        expect(knownDeviceRegistry.persist).toHaveBeenCalledTimes(1);

        const persisted = knownDeviceRegistry.persist.mock.calls[0][0];
        expect(persisted.id).toStrictEqual(expectedDeviceId);
        expect(persisted.type).toStrictEqual('zc95');
        expect(persisted.source).toStrictEqual(provider);
    });

    it('reuses an already known device (id and name) when the derived serial-based id is already known', async () => {
        const existingKnownDevice = new KnownDevice(
            DeviceId.create('ZC95-SERIAL-123'),
            'Existing Device Name',
            'zc95',
            provider,
        );
        knownDeviceRegistry.resolve.mockReturnValue(existingKnownDevice);

        const factory = createFactory();

        const device = await factory.create(
            transportDetectionId,
            baseVersionDetails({ SerialNo: 'ZC95-SERIAL-123' }),
            mockProtocol,
            mockTransport,
            mockMsgFactory,
            mockMsgHandler,
            provider,
        );

        expect(device.getDeviceId).toStrictEqual(existingKnownDevice.id);
        expect(device.getDeviceName).toStrictEqual('Existing Device Name');
        expect(knownDeviceRegistry.persist).toHaveBeenCalledWith(existingKnownDevice);
    });

    it('throws and does not create a device when retrieving the pattern list fails', async () => {
        mockMsgHandler.send.mockRejectedValue(new Error('timeout'));

        const factory = createFactory();

        await expect(
            factory.create(
                transportDetectionId,
                baseVersionDetails({ SerialNo: undefined }),
                mockProtocol,
                mockTransport,
                mockMsgFactory,
                mockMsgHandler,
                provider,
            ),
        ).rejects.toThrow('timeout');

        expect(knownDeviceRegistry.persist).not.toHaveBeenCalled();
    });
});
