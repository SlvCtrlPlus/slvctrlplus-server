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

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        connectedSince: Date,
        controllable: boolean,
        attributes: AiroticDeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, peripheral, connectedSince, controllable, attributes, config, eventEmitter, logger);

        this.messageResponseHandler = messageResponseHandler;
    }

    public async setAttribute<K extends AttributeKeyOf<AiroticDeviceAttributes>, V extends AttributeValueOf<K>>(attributeName: K, value: V): Promise<V> {
        console.log(`Setting attribute ${attributeName} to value ${value}`);

        if (attributeName === 'restColor' && value !== null && typeof value === 'string') {
            const [r, g, b] = (value.split(',').map(c => parseInt(c, 10)));
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            return value;
        }

        if (attributeName === 'breathInColor' && value !== null && typeof value === 'string') {
            const [r, g, b] = (value.split(',').map(c => parseInt(c, 10)));
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
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
            }
            return value;
        }

        throw new Error(`Unknown attribute '${attributeName}' or invalid value type`);
    }
}
