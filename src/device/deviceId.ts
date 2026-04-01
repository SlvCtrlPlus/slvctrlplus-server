import { v5 as uuidv5 } from 'uuid';

const DEVICE_NAMESPACE = '1e0758c9-799d-40b5-b2fc-63f1e66afb76';
const deviceIdSymbol = Symbol();

export type DeviceId = string & { [deviceIdSymbol]: never }

export const DeviceId = {
    create: (seed: string): DeviceId => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return uuidv5(seed, DEVICE_NAMESPACE).toString() as DeviceId;
    }
}
