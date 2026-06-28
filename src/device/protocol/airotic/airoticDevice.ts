import { Exclude } from 'class-transformer';
import EventEmitter from 'events';
import { AttributeKeyOf, AttributeValueOf } from '../../device.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { NoDeviceConfig } from '../../deviceConfig.js';
import { Peripheral } from '@stoprocent/noble';
import { DeviceId } from '../../deviceId.js';
import Logger from '../../../logging/Logger.js';
import BleDevice from '../../bleDevice.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import AiroticProtocol from './airtonicProtocol.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { sleep } from '../../../util/async.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import { logError } from '../../../util/error.js';

export type AiroticDeviceAttributes = {
    restColor: StrDeviceAttribute,
    breathInColor: StrDeviceAttribute,
    resetColors: BoolDeviceAttribute,
    reboot: BoolDeviceAttribute,
};

@Exclude()
export default class AiroticDevice extends BleDevice<AiroticDeviceAttributes, NoDeviceConfig>
{
    private readonly messageResponseHandler: MessageResponseHandler<AiroticProtocol>;

    private readonly transport: BleUartDeviceTransport;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        connectedSince: Date,
        controllable: boolean,
        attributes: AiroticDeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, peripheral, connectedSince, controllable, attributes, config, eventEmitter, logger);

        this.transport = transport;
        this.messageResponseHandler = messageResponseHandler;

        this.transport.onConnected(() => {
            this.syncState().catch(
                (e: unknown) => logError(this.logger, `Error syncing state after reconnect for device ${this.deviceId}`, e)
            );
        });

        this.transport.onReceive(data => this.onReceiveTransportData(data));
    }

    private onReceiveTransportData(data: Buffer): void {
        const dataStr = data.toString('utf-8');
        if ('*B' !== dataStr && '*R' !== dataStr) {
            return;
        }

        // *B = Breath In Color, *R = Rest Color

        this.logger.debug(`Received data from device ${this.deviceId}: ${dataStr}`);
    }

    protected override async syncState(): Promise<void> {
        const { restColor, breathInColor } = this.attributes;

        if (undefined !== restColor.value) {
            const { r, g, b } = this.parseColor(restColor.value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
        }

        if (undefined !== breathInColor.value) {
            const { r, g, b } = this.parseColor(breathInColor.value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
        }
    }

    public async setAttribute<K extends AttributeKeyOf<AiroticDeviceAttributes>, V extends AttributeValueOf<K>>(attributeName: K, value: V): Promise<V> {
        if (attributeName === 'restColor' && value !== null && typeof value === 'string') {
            const { r, g, b } = this.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.restColor.value = value;
            return value;
        }

        if (attributeName === 'breathInColor' && value !== null && typeof value === 'string') {
            const { r, g, b } = this.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.breathInColor.value = value;
            return value;
        }

        if (attributeName === 'resetColors' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createResetColorsMessage());
            }
            return value;
        }

        if (attributeName === 'reboot' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createRebootMessage());
                await sleep(500);
                await this.close();
            }

            return value;
        }

        throw new Error(`Unknown attribute '${attributeName}' or invalid value type`);
    }

    public override async doClose(): Promise<void> {
        await super.doClose();
        await this.transport.close();
    }

    private parseColor(value: string): { r: number, g: number, b: number } {
        const channels = value.split(',');

        if (channels.length !== 3) {
            throw new Error(`Invalid color format: expected 3 components, got ${channels.length}`);
        }

        const [r, g, b] = channels.map(c => {
            const channelNumber = parseInt(c, 10);

            if (isNaN(channelNumber) || channelNumber < 0 || channelNumber > 255) {
                throw new Error(`Invalid color channel value: ${c}`);
            }

            return channelNumber;
        });

        return { r, g, b };
    }
}
