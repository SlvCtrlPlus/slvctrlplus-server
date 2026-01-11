import KnownDevice from '../../../settings/knownDevice.js';
import VirtualDevice from './virtualDevice.js';

export default interface VirtualDeviceFactory {
    create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice<any>>;
}
