import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import BaseError from 'modern-errors';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { promiseWithTimeout } from '../../../util/async.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airtonicProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import BleProtocolFactory from '../../provider/bleProtocolFactory.js';
import { hsvByteToRgb } from '../../../util/color.js';
import KnownDeviceResolver from '../../knownDeviceResolver.js';
import { DeviceId } from '../../deviceId.js';

export default class AiroticDeviceFactory implements BleProtocolFactory<AiroticDevice>
{
    public static readonly protocolName = 'airotic';

    public readonly protocolName = AiroticDeviceFactory.protocolName;

    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    private readonly knownDeviceResolver: KnownDeviceResolver;

    private readonly logger: Logger;

    public constructor(knownDeviceResolver: KnownDeviceResolver, logger: Logger) {
        this.knownDeviceResolver = knownDeviceResolver;
        this.logger = logger.child({ name: AiroticDeviceFactory.name });
    }

    public async tryConnect(deviceId: DeviceId, peripheral: Peripheral): Promise<AiroticDevice | undefined> {
        const transport = await promiseWithTimeout(BleUartDeviceTransport.create(
            peripheral,
            AiroticDeviceFactory.UART_RX_CHAR_UUID,
            AiroticDeviceFactory.UART_TX_CHAR_UUID
        ), 5000, `Timed out while creating BLE transport for device ${deviceId}`);

        this.logger.debug(`Connected to device: ${deviceId}`);

        const protocol = new AiroticProtocol();
        const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger, 2000);

        const handshakeSucceeded = await this.doHandshake(messageResponseHandler);

        if (!handshakeSucceeded) {
            await transport.close();
            return undefined;
        }

        const knownDevice = this.knownDeviceResolver.resolveOrCreate(
            deviceId,
            AiroticDeviceFactory.protocolName,
            AiroticDeviceFactory.protocolName,
            peripheral.advertisement.localName ?? `Airotic ${deviceId}`,
        );

        const advertisedColors = this.parseAdvertisedColors(peripheral.advertisement.manufacturerData);

        return new AiroticDevice(
            knownDevice.id,
            knownDevice.name,
            AiroticDeviceFactory.protocolName,
            peripheral,
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
