import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import DeviceNameGenerator from '../../deviceNameGenerator.js';
import DateFactory from '../../../factory/dateFactory.js';
import Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import EStim2bProtocol, { EStim2bMode, EStim2bStatus } from './estim2bProtocol.js';
import Estim2bDevice from './estim2bDevice.js';
import EStim2bDevice, { EStim2bDeviceAttributes } from './estim2bDevice.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';

export default class Estim2bDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(
        uuidFactory: UuidFactory,
        dateFactory: DateFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator,
        logger: Logger
    ) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger;
    }

    public async create(
        protocol: EStim2bProtocol,
        initialStatus: EStim2bStatus,
        provider: string
    ): Promise<Estim2bDevice> {
        const attributes = this.getAttributes(initialStatus);

        return new Estim2bDevice(
            this.uuidFactory.create(),
            this.nameGenerator.generateName(),
            provider,
            this.dateFactory.now(),
            true,
            initialStatus,
            protocol,
            attributes
        );
    }

    private getAttributes(initialStatus: EStim2bStatus): EStim2bDeviceAttributes {
        const availableModes = new Map<Int, string>(
            Object.entries(EStim2bMode)
                .filter(([key]) => !isNaN(Number(key)))
                .map(([key, value]) =>  [Int.from(parseInt(key, 10)), Estim2bDeviceFactory.formatMode(value)])
        );

        const mode = ListDeviceAttribute.createInitialized<Int, string>(
            'mode',
            'Mode',
            DeviceAttributeModifier.readWrite,
            availableModes,
            Int.from(initialStatus.currentMode)
        );

        const channelALevel = IntRangeDeviceAttribute.createInitialized(
            'channelALevel',
            'Channel A',
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.ZERO,
            Int.from(100),
            Int.from(1),
            Int.from(initialStatus.channelALevel)
        );

        const channelBLevel = IntRangeDeviceAttribute.createInitialized(
            'channelBLevel',
            'Channel B',
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.ZERO,
            Int.from(100),
            Int.from(1),
            Int.from(initialStatus.channelBLevel)
        );

        const highPowerMode = BoolDeviceAttribute.createInitialized(
            'highPowerMode',
            'High power mode',
            DeviceAttributeModifier.readWrite,
            'H' === initialStatus.powerMode,
        );

        const channelsJoined = BoolDeviceAttribute.createInitialized(
            'channelsJoined',
            'Channels joined',
            DeviceAttributeModifier.readOnly,
            initialStatus.channelsJoined,
        );

        const batteryStatusValue = EStim2bDevice.humanReadableBatteryLevel(initialStatus.batteryLevel);

        const batteryStatus = StrDeviceAttribute.createInitialized(
            'batteryStatus',
            'Battery',
            DeviceAttributeModifier.readOnly,
            batteryStatusValue,
        );

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
