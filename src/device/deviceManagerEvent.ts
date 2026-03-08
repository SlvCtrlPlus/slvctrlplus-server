import Device from './device.js';
import { DeviceInfo } from './deviceManager.js';

export default interface DeviceManagerEvents {
    deviceConnected: [device: Device];
    deviceDisconnected: [device: Device];
    deviceRefreshed: [device: Device];
    deviceAvailable: [deviceInfo: DeviceInfo];
}
