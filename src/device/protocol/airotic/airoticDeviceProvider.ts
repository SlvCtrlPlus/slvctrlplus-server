import EventEmitter from 'events';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../../deviceManager.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import AiroticDevice from './airoticDevice.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../../../util/async.js';
import { logError } from '../../../util/error.js';
import { BleDeviceInfo } from '../../transport/bleObserver.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import AiroticProtocol from './airtonicProtocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import { Peripheral } from '@stoprocent/noble';
import Settings from '../../../settings/settings.js';
import KnownDevice from '../../../settings/knownDevice.js';
import { DeviceId } from '../../deviceId.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { DeviceEvent } from '../../device.js';

export default class AiroticDeviceProvider extends DeviceProvider
{
    public static readonly providerName = 'airotic';

    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
    private static readonly UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

    private readonly settings: Settings;

    public constructor(deviceManager: DeviceManager, settings: Settings, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger.child({ name: AiroticDeviceProvider.name }));

        this.settings = settings;

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
        this.logger.debug(`Handling detected device with id ${deviceInfo.id}`);

        if (!this.isBleDeviceInfo(deviceInfo)) {
            return;
        }

        try {
            this.logger.debug(`Requesting to acquire device: ${deviceInfo.id}`);

            await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

            const transport = await promiseWithTimeout(BleUartDeviceTransport.create(
                deviceInfo.peripheral,
                AiroticDeviceProvider.UART_RX_CHAR_UUID,
                AiroticDeviceProvider.UART_TX_CHAR_UUID
            ), 2000);

            this.logger.debug(`Connected to device: ${deviceInfo.id}`);

            const protocol = new AiroticProtocol();

            const messageResponseHandler = MessageResponseHandler.create(protocol, transport, this.logger);

            const handshakeResult = await this.doHandshake(messageResponseHandler);

            if (handshakeResult) {
                const device = this.createDevice(deviceInfo, deviceInfo.peripheral, messageResponseHandler, protocol);

                device.on(DeviceEvent.deviceDisconnected, asyncHandler(
                    async () => await transport.close(),
                    (e: unknown) => logError(this.logger, `Error in device disconnected handler for device ${device.getDeviceId}`, e))
                );

                this.deviceManager.addDevice(device);

                this.deviceManager.claimDetectedDevice(deviceInfo.id);
            } else {
                this.deviceManager.releaseDetectedDevice(deviceInfo.id);
            }
        } catch (e: unknown) {
            logError(this.logger, `Error while connecting to device`, e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
        }
    }

    private createDevice(
        deviceInfo: BleDeviceInfo,
        peripheral: Peripheral,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        protocol: AiroticProtocol
    ): AiroticDevice
    {
        const knownDevice = this.createKnownDevice(deviceInfo.id, deviceInfo.peripheral.advertisement.localName ?? `Airotic ${deviceInfo.id}`, AiroticDeviceProvider.providerName);

        const device = new AiroticDevice(
            knownDevice.id,
            knownDevice.name,
            AiroticDeviceProvider.providerName,
            peripheral,
            messageResponseHandler,
            new Date(),
            true,
            {
                restColor: new StrDeviceAttribute('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, ''),
                breathInColor: new StrDeviceAttribute('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, ''),
                resetColors: new BoolDeviceAttribute('resetColors', 'Reset Colors', DeviceAttributeModifier.writeOnly, false),
                reboot: new BoolDeviceAttribute('reboot', 'Reboot bottle', DeviceAttributeModifier.writeOnly, false),
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


    private createKnownDevice(deviceId: DeviceId, deviceName: string, provider: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId)

        if (undefined !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        // Create a new device and return if not yet known (new serial number)
        return new KnownDevice(
            deviceId,
            deviceName,
            'airotic',
            provider
        );
    }

    private isBleDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is BleDeviceInfo
    {
        return 'peripheral' in deviceInfo;
    }
}
