import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import { SerialPortStream } from '@serialport/stream';
import { SerialPortOpenOptions } from 'serialport';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import PeripheralDevice, { InferPeripheralDeviceAttributes, InferPeripheralDeviceConfig } from '../peripheralDevice.js';
import { DeviceAttributes } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';
import { DeviceId } from '../deviceId.js';

export type SerialDeviceProviderPortOpenOptions = Omit<SerialPortOpenOptions<AutoDetectTypes>, 'path' | 'autoOpen'>;

export type SerialDeviceInfo = {
    id: DeviceId;
    portInfo: PortInfo;
};

/**
 * Implemented by protocol-specific factories that know how to probe a freshly discovered serial
 * port and, if it speaks their protocol, construct the resulting Device.
 *
 * `SerialDeviceProvider` tries every registered factory (in registration order) against a newly
 * discovered port until one of them successfully connects, or none of them do. Since each
 * protocol may require different port settings (e.g. baud rate), the port is (re-)opened fresh
 * with `getPortOpenOptions()` before every attempt.
 */
export default interface SerialProtocolFactory<
    D extends PeripheralDevice<any, TAttributes, any, TConfig>,
    TAttributes extends DeviceAttributes = InferPeripheralDeviceAttributes<D>,
    TConfig extends AnyDeviceConfig = InferPeripheralDeviceConfig<D>
>
{
    readonly protocolName: string;

    getPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;

    /**
     * Attempt to connect to and identify the device at the other end of an already-open port as
     * this factory's protocol. Resolve with `undefined` (rather than throwing) when the device
     * simply doesn't speak this protocol, so the provider can move on to the next registered
     * factory.
     */
    tryConnect(deviceInfo: SerialDeviceInfo, port: SerialPortStream<BindingInterface>): Promise<D | undefined>;

    /**
     * Optional hook to prepare a freshly opened port before `tryConnect()` is called (e.g.
     * waiting for a module-ready signal). Defaults to a no-op when omitted.
     */
    preparePort?(port: SerialPortStream<BindingInterface>, portInfo: PortInfo): Promise<void>;
}
