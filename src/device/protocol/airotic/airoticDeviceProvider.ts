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
import Settings from '../../../settings/settings.js';
import KnownDevice from '../../../settings/knownDevice.js';
import { DeviceId } from '../../deviceId.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import BleDeviceProvider from '../../provider/bleDeviceProvider.js';

export default class AiroticDeviceProvider extends BleDeviceProvider<AiroticDevice>
{
    public static readonly providerName = 'airotic';

    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    private readonly settings: Settings;

    public constructor(deviceManager: DeviceManager, settings: Settings, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger.child({ name: AiroticDeviceProvider.name }));

        this.settings = settings;
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

        const knownDevice = this.createKnownDevice(
            deviceInfo.id,
            deviceInfo.peripheral.advertisement.localName ?? `Airotic ${deviceInfo.id}`,
        );

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
                restColor: new StrDeviceAttribute('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, undefined),
                breathInColor: new StrDeviceAttribute('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, undefined),
                resetColors: new BoolDeviceAttribute('resetColors', 'Reset Colors', DeviceAttributeModifier.writeOnly, undefined),
                reboot: new BoolDeviceAttribute('reboot', 'Reboot bottle', DeviceAttributeModifier.writeOnly, undefined),
            },
            {},
            new EventEmitter(),
            this.logger,
        );

        this.settings.addKnownDevice(knownDevice);

        return device;
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

    private createKnownDevice(deviceId: DeviceId, deviceName: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId);

        if (undefined !== knownDevice) {
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        return new KnownDevice(deviceId, deviceName, 'airotic', AiroticDeviceProvider.providerName);
    }
}
