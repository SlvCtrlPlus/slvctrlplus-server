import type { Peripheral } from '@stoprocent/noble';
import type DateFactory from '../../../factory/dateFactory.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type Logger from '../../../logging/Logger.js';
import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import type BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import { hsvByteToRgb } from '../../../util/color.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';
import type { AiroticDeviceAttributes } from './airoticDevice.js';
import AiroticDevice from './airoticDevice.js';
import type AiroticProtocol from './airoticProtocol.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import { BYTE_MAX } from '../../../util/numbers.js';

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
        logger: Logger,
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceRegistry = knownDeviceRegistry;
        this.logger = logger;
    }

    public create(
        detectionId: DetectionId,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        provider: string,
    ): AiroticDevice {
        const deviceId = DeviceId.fromDetectionId(detectionId);

        const knownDevice = this.knownDeviceRegistry.resolve(
            deviceId,
            'airotic',
            provider,
            peripheral.advertisement.localName,
        );

        const advertisedColors = AiroticDeviceFactory.parseAdvertisedColors(peripheral.advertisement.manufacturerData);
        const attributes = AiroticDeviceFactory.getAttributes(advertisedColors);

        const device = new AiroticDevice(
            {
                deviceId: knownDevice.id,
                deviceName: knownDevice.name,
                provider: provider,
                connectedSince: this.dateFactory.now(),
                controllable: true,
            },
            peripheral,
            transport,
            messageResponseHandler,
            attributes,
            {},
            this.eventEmitterFactory.create(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }

    private static getAttributes(advertisedColors: { restColor?: string, breathInColor?: string } | undefined): AiroticDeviceAttributes {
        return {
            restColor: StrDeviceAttribute.create({
                name: 'restColor', label: 'Rest Color', modifier: DeviceAttributeModifier.readWrite,
                uninitialized: true, initialValue: advertisedColors?.restColor,
            }),
            breathInColor: StrDeviceAttribute.create({
                name: 'breathInColor', label: 'Breath In Color', modifier: DeviceAttributeModifier.readWrite,
                uninitialized: true, initialValue: advertisedColors?.breathInColor,
            }),
            resetColors: BoolDeviceAttribute.create({
                name: 'resetColors', label: 'Reset Colors', modifier: DeviceAttributeModifier.writeOnly, initialValue: false,
            }),
            reboot: BoolDeviceAttribute.create({
                name: 'reboot', label: 'Reboot bottle', modifier: DeviceAttributeModifier.writeOnly, initialValue: false,
            }),
            breathsPerMin: FloatDeviceAttribute.create({
                name: 'breathsPerMin', label: 'Breaths/min', modifier: DeviceAttributeModifier.readOnly, uom: 'breaths/min',
                nullable: true, initialValue: null,
            }),
            bpmTrend: StrDeviceAttribute.create({
                name: 'bpmTrend', label: 'BPM Trend', modifier: DeviceAttributeModifier.readOnly, nullable: true, initialValue: null,
            }),
        };
    }

    /**
     * Parses colors broadcast in the BLE advertising manufacturer data payload, so
     * initial rest/breath-in colors can be reflected without needing a UART round-trip.
     * Byte layout (0-indexed): 3 = colorStart.h, 4 = colorStart.s, 5 = colorTarget.h, 6 = colorTarget.s
     */
    private static parseAdvertisedColors(manufacturerData: Buffer | undefined): { restColor?: string, breathInColor?: string } | undefined {
        const minManufacutrerDataLength = 7;

        if (undefined === manufacturerData || manufacturerData.length < minManufacutrerDataLength) {
            return undefined;
        }

        const [, , , colorStartH, colorStartS, colorTargetH, colorTargetS] = manufacturerData;

        if (colorStartH === undefined || colorStartS === undefined || colorTargetH === undefined || colorTargetS === undefined) {
            return undefined;
        }

        const target = hsvByteToRgb(colorTargetH, colorTargetS, BYTE_MAX);
        const start = hsvByteToRgb(colorStartH, colorStartS, BYTE_MAX);

        return {
            restColor: `${start.r},${start.g},${start.b}`,
            breathInColor: `${target.r},${target.g},${target.b}`,
        };
    }
}
