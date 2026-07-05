import { Peripheral } from '@stoprocent/noble';
import BleDevice, { InferBleDeviceAttributes, InferBleDeviceConfig } from '../bleDevice.js';
import { DeviceAttributes, DeviceNotifications, InferDeviceNotifications } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';
import { DeviceId } from '../deviceId.js';

/**
 * Implemented by protocol-specific factories that know how to probe a freshly discovered BLE
 * peripheral and, if it speaks their protocol, construct the resulting Device.
 *
 * `BleDeviceProvider` tries every registered factory (in registration order) against a newly
 * discovered peripheral until one of them returns a Device, or none of them do.
 */
export default interface BleProtocolFactory<
    D extends BleDevice<TAttributes, TNotifications, TConfig>,
    TAttributes extends DeviceAttributes = InferBleDeviceAttributes<D>,
    TNotifications extends DeviceNotifications = InferDeviceNotifications<D>,
    TConfig extends AnyDeviceConfig = InferBleDeviceConfig<D>
>
{
    readonly protocolName: string;

    /**
     * Attempt to connect to and identify the given peripheral as this factory's protocol.
     * Resolve with `undefined` (rather than throwing) when the peripheral simply doesn't speak
     * this protocol, so the provider can move on to the next registered factory.
     */
    tryConnect(deviceId: DeviceId, peripheral: Peripheral): Promise<D | undefined>;
}
