import { Peripheral } from '@stoprocent/noble';
import DateFactory from '../../../factory/dateFactory.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import Logger from '../../../logging/Logger.js';
import KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import { hsvByteToRgb } from '../../../util/color.js';
import { DeviceId } from '../../deviceId.js';
import AiroticDevice, { AiroticDeviceAttributes } from './airoticDevice.js';
import AiroticProtocol from './airoticProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';

export default class AiroticDeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceRegistry = knownDeviceRegistry;
        this.logger = logger;
    }

    public create(
        deviceId: DeviceId,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        provider: string
    ): AiroticDevice {
        const knownDevice = this.knownDeviceRegistry.resolve(
            deviceId,
            'airotic',
            provider,
            peripheral.advertisement.localName ?? `Airotic ${deviceId}`,
        );

        const advertisedColors = this.parseAdvertisedColors(peripheral.advertisement.manufacturerData);
        const attributes = this.getAttributes(advertisedColors);

        const device = new AiroticDevice(
            knownDevice.id,
            knownDevice.name,
            provider,
            peripheral,
            transport,
            messageResponseHandler,
            this.dateFactory.now(),
            true,
            attributes,
            {},
            this.eventEmitterFactory.create(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }

    private getAttributes(advertisedColors: { restColor?: string, breathInColor?: string } | undefined): AiroticDeviceAttributes {
        return {
            restColor: StrDeviceAttribute.create('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, advertisedColors?.restColor),
            breathInColor: StrDeviceAttribute.create('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, advertisedColors?.breathInColor),
            resetColors: BoolDeviceAttribute.create('resetColors', 'Reset Colors', DeviceAttributeModifier.writeOnly),
            reboot: BoolDeviceAttribute.create('reboot', 'Reboot bottle', DeviceAttributeModifier.writeOnly),
            breathsPerMin: FloatDeviceAttribute.create('breathsPerMin', 'Breaths/min', DeviceAttributeModifier.readOnly, 'breaths/min'),
            bpmTrend: StrDeviceAttribute.create('bpmTrend', 'BPM Trend', DeviceAttributeModifier.readOnly),
        };
    }

    /**
     * Parses colors broadcast in the BLE advertising manufacturer data payload, so
     * initial rest/breath-in colors can be reflected without needing a UART round-trip.
     * Byte layout (0-indexed): 3 = colorStart.h, 4 = colorStart.s, 5 = colorTarget.h, 6 = colorTarget.s
     */
    private parseAdvertisedColors(manufacturerData: Buffer | undefined): { restColor?: string, breathInColor?: string } | undefined {
        if (undefined === manufacturerData || manufacturerData.length < 7) {
            return undefined;
        }

        const colorStartH = manufacturerData[3];
        const colorStartS = manufacturerData[4];
        const colorTargetH = manufacturerData[5];
        const colorTargetS = manufacturerData[6];

        const target = hsvByteToRgb(colorTargetH, colorTargetS, 255);
        const start = hsvByteToRgb(colorStartH, colorStartS, 255);

        return {
            restColor: `${start.r},${start.g},${start.b}`,
            breathInColor: `${target.r},${target.g},${target.b}`,
        };
    }
}
