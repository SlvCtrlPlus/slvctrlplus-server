import BaseError from 'modern-errors';
import DeviceManager from '../../deviceManager.js';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { promiseWithTimeout } from '../../../util/async.js';
import { logError } from '../../../util/error.js';
import BleObserver, { BleDeviceDetectionInfo } from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airoticProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import BleDeviceProvider from '../../provider/bleDeviceProvider.js';
import AiroticDeviceFactory from './airoticDeviceFactory.js';

export default class AiroticDeviceProvider extends BleDeviceProvider<AiroticDevice>
{
    public static readonly providerName = 'airotic';

    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    private readonly deviceFactory: AiroticDeviceFactory;

    public constructor(
        deviceManager: DeviceManager,
        bleObserver: BleObserver,
        deviceFactory: AiroticDeviceFactory,
        logger: Logger
    ) {
        super(deviceManager, bleObserver, logger.child({ name: AiroticDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    protected override async connectBleDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<AiroticDevice> {
        const transport = await promiseWithTimeout(BleUartDeviceTransport.create(
            deviceDetectionInfo.peripheral,
            AiroticDeviceProvider.UART_RX_CHAR_UUID,
            AiroticDeviceProvider.UART_TX_CHAR_UUID
        ), 5000, `Timed out while creating BLE transport for device ${deviceDetectionInfo.detectionId}`);

        this.logger.debug(`Connected to device: ${deviceDetectionInfo.detectionId}`);

        const protocol = new AiroticProtocol();
        const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger, 2000);

        const handshakeSucceeded = await this.doHandshake(messageResponseHandler);

        if (!handshakeSucceeded) {
            try {
                await transport.close();
            } catch (e: unknown) {
                logError(this.logger, `Failed to close BLE transport for device '${deviceDetectionInfo.detectionId}' after a failed handshake`, e);
            }
            throw new Error(`Handshake failed for bottle ${deviceDetectionInfo.detectionId}`);
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
