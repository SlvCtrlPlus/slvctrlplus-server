import BaseError from 'modern-errors';
import type DeviceManager from '../../deviceManager.js';
import type AiroticDevice from './airoticDevice.js';
import type Logger from '../../../logging/Logger.js';
import { promiseWithTimeout } from '../../../util/async.js';
import type { BleDeviceDetectionInfo } from '../../transport/bleObserver.js';
import type BleObserver from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airoticProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import BleDeviceProvider from '../../provider/bleDeviceProvider.js';
import type AiroticDeviceFactory from './airoticDeviceFactory.js';

export default class AiroticDeviceProvider extends BleDeviceProvider<AiroticDevice>
{
    public static readonly providerName = 'airotic';

    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';
    private static readonly MESSAGE_ROUNDTRIP_TIMEOUT_MS = 2000;
    private static readonly TRANSPORT_OPEN_CLOSE_TIMEOUT_MS = 5000;
    private static readonly HANDSHAKE_TIMEOUT_MS = 500;

    private readonly deviceFactory: AiroticDeviceFactory;

    public constructor(
        deviceManager: DeviceManager,
        bleObserver: BleObserver,
        deviceFactory: AiroticDeviceFactory,
        logger: Logger,
    ) {
        super(deviceManager, bleObserver, logger.child({ name: AiroticDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    protected override async connectBleDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<AiroticDevice> {
        const transport = await promiseWithTimeout(BleUartDeviceTransport.create(
            deviceDetectionInfo.peripheral,
            AiroticDeviceProvider.UART_RX_CHAR_UUID,
            AiroticDeviceProvider.UART_TX_CHAR_UUID,
        ), AiroticDeviceProvider.TRANSPORT_OPEN_CLOSE_TIMEOUT_MS, `Timed out while creating BLE transport for device ${deviceDetectionInfo.detectionId}`);

        this.logger.debug(`Connected to device: ${deviceDetectionInfo.detectionId}`);

        const protocol = new AiroticProtocol();
        const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger, AiroticDeviceProvider.MESSAGE_ROUNDTRIP_TIMEOUT_MS);

        const handshakeSucceeded = await this.doHandshake(messageResponseHandler);

        if (!handshakeSucceeded) {
            let closeError: unknown;

            try {
                await promiseWithTimeout(transport.close(), AiroticDeviceProvider.TRANSPORT_OPEN_CLOSE_TIMEOUT_MS, 'Timed out');
            } catch (e: unknown) {
                closeError = e;
            }

            throw new Error(`Handshake failed for bottle ${deviceDetectionInfo.detectionId}`, { cause: closeError });
        }

        return this.deviceFactory.create(
            deviceDetectionInfo.detectionId,
            deviceDetectionInfo.peripheral,
            transport,
            messageResponseHandler,
            AiroticDeviceProvider.providerName,
        );
    }

    private async doHandshake(messageResponseHandler: MessageResponseHandler<AiroticProtocol>): Promise<boolean> {
        try {
            const answer = await messageResponseHandler.send(AiroticProtocol.createHelloMessage(), AiroticDeviceProvider.HANDSHAKE_TIMEOUT_MS);
            this.logger.debug(`Received handshake answer: ${answer}`);
            return true;
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.info(`Handshake failed: ${error.message}`);
        }

        return false;
    }
}
