import EventEmitter from 'events';
import BaseError from 'modern-errors';
import DeviceManager from '../../deviceManager.js';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { promiseWithTimeout } from '../../../util/async.js';
import { BleDeviceInfo } from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airoticProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import SettingsManager from '../../../settings/settingsManager.js';
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
        deviceFactory: AiroticDeviceFactory,
        settingsManager: SettingsManager,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceManager, settingsManager, eventEmitter, logger.child({ name: AiroticDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
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

        return this.deviceFactory.create(
            deviceInfo.id,
            deviceInfo.peripheral,
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
