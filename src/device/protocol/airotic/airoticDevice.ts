import { Exclude, Expose } from 'class-transformer';
import EventEmitter from 'events';
import Device, { AttributeKeyOf, AttributeValueOf } from '../../device.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { NoDeviceConfig } from '../../deviceConfig.js';
import { Peripheral } from '@stoprocent/noble';
import { DeviceId } from '../../deviceId.js';

export type AiroticDeviceAttributes = {
    color: StrDeviceAttribute,
};

@Exclude()
export default class AiroticDevice extends Device<AiroticDeviceAttributes, NoDeviceConfig>
{
    private readonly peripheral: Peripheral;

    @Expose()
    private rssi: number;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        connectedSince: Date,
        controllable: boolean,
        attributes: AiroticDeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config, eventEmitter);

        this.peripheral = peripheral;
        this.rssi = peripheral.rssi;

        setInterval(() => {
            peripheral.updateRssi((error, rssi) => {
                if (error) {
                    console.error(`Error updating RSSI for device ${this.deviceId}`, error);
                    return;
                }

                this.rssi = rssi;
                this.updateLastRefresh();
            });
        }, 5000);
    }

    public setAttribute<K extends AttributeKeyOf<AiroticDeviceAttributes>, V extends AttributeValueOf<K>>(attributeName: K, value: V): Promise<V> {
        console.log(attributeName, value);
        throw new Error('Method not implemented.');
    }
}
