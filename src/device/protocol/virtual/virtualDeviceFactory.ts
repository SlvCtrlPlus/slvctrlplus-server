import KnownDevice from '../../../settings/knownDevice.js';
import { AnyVirtualDevice } from './virtualDevice.js';

type VirtualDeviceFactory = {
    create(knownDevice: KnownDevice, provider: string): Promise<AnyVirtualDevice>;
};

export default VirtualDeviceFactory;
