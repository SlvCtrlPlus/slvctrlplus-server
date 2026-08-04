import KnownDevice from '../../../settings/knownDevice.js';
import VirtualDevice from './virtualDevice.js';

type VirtualDeviceFactory = {
    create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice<any>>;
};

export default VirtualDeviceFactory;
