import { v5 as uuidv5 } from 'uuid';

const DEVICE_NAMESPACE = '1e0758c9-799d-40b5-b2fc-63f1e66afb76';
const deviceIdSymbol = Symbol();
const detectionIdSymbol = Symbol();

export type DeviceId = string & { [deviceIdSymbol]: never }
export type DetectionId = string & { [detectionIdSymbol]: never }

export const DeviceId = {
    create: (seed: string): DeviceId => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return uuidv5(seed, DEVICE_NAMESPACE).toString() as DeviceId;
    },
    fromDetectionId: (detectionId: DetectionId): DeviceId => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return detectionId as unknown as DeviceId;
    },
}

export const DetectionId = {
    create: (seed: string): DetectionId => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return uuidv5(seed, DEVICE_NAMESPACE).toString() as DetectionId;
    },
    fromDeviceId: (deviceId: DeviceId): DetectionId => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return deviceId as unknown as DetectionId;
    },
}
