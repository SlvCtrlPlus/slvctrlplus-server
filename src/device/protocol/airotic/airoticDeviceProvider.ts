import EventEmitter from 'events';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../../deviceManager.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler } from '../../../util/async.js';
import { logError } from '../../../util/error.js';
import { BleDeviceInfo } from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airtonicProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';

export default class AiroticDeviceProvider extends DeviceProvider<AiroticDevice>
{
    public static readonly providerName = 'airotic';

    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    public constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger.child({ name: AiroticDeviceProvider.name }));

        this.deviceManager.on(
            DeviceManagerEvent.deviceDetected,
            asyncHandler(
                this.handleDeviceDetection.bind(this),
                (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
            )
        );
    }

    public override async init(): Promise<void> {
        // no initialization needed, Airotic devices are announced by the AiroticBleObserver
        this.logger.debug('Initialized AiroticDeviceProvider');
    }

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.isBleDeviceInfo(deviceInfo)) {
            return;
        }

        try {
            this.logger.debug(`Requesting to acquire device: ${deviceInfo.id}`);

            await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

            this.logger.debug(`Connected to device: ${deviceInfo.id}`);

            const transport = await BleUartDeviceTransport.create(
                deviceInfo.peripheral,
                AiroticDeviceProvider.UART_RX_CHAR_UUID,
                AiroticDeviceProvider.UART_TX_CHAR_UUID
            );

            const protocol = new AiroticProtocol();

            const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger);

            const handshakeResult = await this.doHandshake(messageResponseHandler);

            console.log(`Handshake result: ${handshakeResult}, create device and add to device manager!`);

            this.deviceManager.claimDetectedDevice(deviceInfo.id);
        } catch (e: unknown) {
            logError(this.logger, `Error while connecting to device`, e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
        }
    }

    private async doHandshake(messageResponseHandler: MessageResponseHandler<AiroticProtocol>): Promise<boolean> {
        try {
            await messageResponseHandler.send(AiroticProtocol.createHelloMessage(), 500);
            return true;
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.info(`Handshake failed: ${error.message}`);
        }

        return false;
    }

    private isBleDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is BleDeviceInfo
    {
        return 'peripheral' in deviceInfo;
    }
}
