import EventEmitter from 'events';
import BaseError from 'modern-errors';
import DeviceManager from '../../deviceManager.js';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { promiseWithTimeout } from '../../../util/async.js';
import { BleDeviceInfo } from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airtonicProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import BleDeviceProvider from '../../provider/bleDeviceProvider.js';
import { hsvByteToRgb } from '../../../util/color.js';
import { NoDeviceProviderConfig } from '../../provider/deviceProviderConfig.js';

export default class AiroticDeviceProvider extends BleDeviceProvider<AiroticDevice, NoDeviceProviderConfig>
{
    public static readonly providerName = 'airotic';

    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    public constructor(
        config: NoDeviceProviderConfig,
        deviceManager: DeviceManager,
        knownDeviceRegistry: KnownDeviceRegistry,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(config, deviceManager, eventEmitter, logger.child({ name: AiroticDeviceProvider.name }));

        this.knownDeviceRegistry = knownDeviceRegistry;
    }

    public override async init(): Promise<void> {
        this.logger.debug('Initialized AiroticDeviceProvider');
    }

    protected override async connectBleDevice(deviceInfo: BleDeviceInfo): Promise<AiroticDevice | undefined> {
        const transport = await promiseWithTimeout(BleUartDeviceTransport.create(
            deviceInfo.peripheral,
            AiroticDeviceProvider.UART_RX_CHAR_UUID,
            AiroticDeviceProvider.UART_TX_CHAR_UUID
        ), 5000, `Timed out while creating BLE transport for device ${deviceInfo.id}`);

        this.logger.debug(`Connected to device: ${deviceInfo.id}`);

        const protocol = new AiroticProtocol();
        const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger, 2000);

        const handshakeSucceeded = await this.doHandshake(messageResponseHandler);

        if (!handshakeSucceeded) {
            await transport.close();
            return undefined;
        }

        const knownDevice = this.knownDeviceRegistry.resolve(
            deviceInfo.id,
            'airotic',
            AiroticDeviceProvider.providerName,
            deviceInfo.peripheral.advertisement.localName ?? `Airotic ${deviceInfo.id}`,
        );

        const advertisedColors = this.parseAdvertisedColors(deviceInfo.peripheral.advertisement.manufacturerData);

        const device = new AiroticDevice(
            knownDevice.id,
            knownDevice.name,
            AiroticDeviceProvider.providerName,
            deviceInfo.peripheral,
            transport,
            messageResponseHandler,
            new Date(),
            true,
            {
                restColor: StrDeviceAttribute.create('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, advertisedColors?.restColor),
                breathInColor: StrDeviceAttribute.create('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, advertisedColors?.breathInColor),
                resetColors: BoolDeviceAttribute.create('resetColors', 'Reset Colors', DeviceAttributeModifier.writeOnly),
                reboot: BoolDeviceAttribute.create('reboot', 'Reboot bottle', DeviceAttributeModifier.writeOnly),
                breathsPerMin: FloatDeviceAttribute.create('breathsPerMin', 'Breaths/min', DeviceAttributeModifier.readOnly, 'breaths/min'),
                bpmTrend: StrDeviceAttribute.create('bpmTrend', 'BPM Trend', DeviceAttributeModifier.readOnly),
            },
            {},
            new EventEmitter(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }

    /**
     * Parses colors broadcast in the BLE advertising manufacturer data payload, so
     * initial rest/breath-in colors can be reflected without needing a UART round-trip.
     * Byte layout (0-indexed): 3 = colorTarget.h, 4 = colorTarget.s, 5 = colorStart.h, 6 = colorStart.s
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

    private async doHandshake(messageResponseHandler: MessageResponseHandler<AiroticProtocol>): Promise<boolean> {
        try {
            const answer = await messageResponseHandler.send(AiroticProtocol.createHelloMessage(), 500);
            this.logger.debug(`Received handshake answer: ${answer}`);
            return true;
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.info(`Handshake failed: ${error.message}`);
        }

        return false;
    }
}
