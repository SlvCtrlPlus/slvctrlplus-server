import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import type { EStim2bStatus } from './estim2bProtocol.js';
import type EStim2bProtocol from './estim2bProtocol.js';
import { EStim2bMode } from './estim2bProtocol.js';
import Estim2bDevice from './estim2bDevice.js';
import type { EStim2bDeviceAttributes } from './estim2bDevice.js';
import EStim2bDevice from './estim2bDevice.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';

export default class Estim2bDeviceFactory
{
    private static readonly CHANNEL_POWER_MIN = 0;
    private static readonly CHANNEL_POWER_MAX = 100;

    private readonly dateFactory: DateFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        logger: Logger,
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;

        this.knownDeviceRegistry = knownDeviceRegistry;
        this.logger = logger;
    }

    public create(
        detectionId: DetectionId,
        protocol: EStim2bProtocol,
        transport: DeviceBidirectionalTransport,
        initialStatus: EStim2bStatus,
        provider: string,
    ): Estim2bDevice {
        const attributes = Estim2bDeviceFactory.getAttributes(initialStatus);
        const knownDevice = this.knownDeviceRegistry.resolve(DeviceId.fromDetectionId(detectionId), 'estim2b', provider);

        return new Estim2bDevice(
            {
                deviceId: knownDevice.id,
                deviceName: knownDevice.name,
                provider: provider,
                connectedSince: this.dateFactory.now(),
                controllable: true,
            },
            initialStatus,
            protocol,
            transport,
            attributes,
            this.eventEmitterFactory.create(),
            this.logger,
        );
    }

    private static getAttributes(initialStatus: EStim2bStatus): EStim2bDeviceAttributes {
        const availableModes = Object.entries(EStim2bMode)
            .filter(([key]) => !isNaN(Number(key)))
            .map(([key, value]) => ({ key: Int.from(parseInt(key, 10)), value: Estim2bDeviceFactory.formatMode(value) }))
        ;

        const mode = ListDeviceAttribute.createInitialized<Int, string>(
            'mode',
            'Mode',
            DeviceAttributeModifier.readWrite,
            availableModes,
            Int.from(initialStatus.currentMode),
        );

        const channelALevel = IntRangeDeviceAttribute.create({
            name: 'channelALevel',
            label: 'Channel A',
            modifier: DeviceAttributeModifier.readWrite,
            min: Int.from(Estim2bDeviceFactory.CHANNEL_POWER_MIN),
            max: Int.from(Estim2bDeviceFactory.CHANNEL_POWER_MAX),
            initialValue: Int.from(initialStatus.channelALevel),
        });

        const channelBLevel = IntRangeDeviceAttribute.create({
            name: 'channelBLevel',
            label: 'Channel B',
            modifier: DeviceAttributeModifier.readWrite,
            min: Int.from(Estim2bDeviceFactory.CHANNEL_POWER_MIN),
            max: Int.from(Estim2bDeviceFactory.CHANNEL_POWER_MAX),
            initialValue: Int.from(initialStatus.channelBLevel),
        });

        const highPowerMode = BoolDeviceAttribute.create({
            name: 'highPowerMode',
            label: 'High power mode',
            modifier: DeviceAttributeModifier.readWrite,
            initialValue: 'H' === initialStatus.powerMode,
        });

        const channelsJoined = BoolDeviceAttribute.create({
            name: 'channelsJoined',
            label: 'Channels joined',
            modifier: DeviceAttributeModifier.readOnly,
            initialValue: initialStatus.channelsJoined,
        });

        const batteryStatusValue = EStim2bDevice.humanReadableBatteryLevel(initialStatus.batteryLevel);

        const batteryStatus = StrDeviceAttribute.create({
            name: 'batteryStatus',
            label: 'Battery',
            modifier: DeviceAttributeModifier.readOnly,
            initialValue: batteryStatusValue,
        });

        return {
            mode,
            channelALevel,
            channelBLevel,
            channelsJoined,
            highPowerMode,
            batteryStatus,
        };
    }

    private static formatMode(str: string | EStim2bMode): string {
        if (typeof str !== 'string') return '';
        const withSpaces = str.replace(/([a-z])([A-Z])/g, '$1 $2');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }
}
