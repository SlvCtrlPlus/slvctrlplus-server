import type KnownDevice from '../../../settings/knownDevice.js';
import type { AnyVirtualDevice } from './virtualDevice.js';

type VirtualDeviceFactory = {
    create(knownDevice: KnownDevice, provider: string): Promise<AnyVirtualDevice>;
};

export default VirtualDeviceFactory;
