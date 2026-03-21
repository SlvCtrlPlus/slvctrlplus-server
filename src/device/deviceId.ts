import { v5 as uuidv5 } from 'uuid';

export default class DeviceId
{
    private static readonly DEVICE_NAMESPACE = '1e0758c9-799d-40b5-b2fc-63f1e66afb76';

    private readonly id: string;

    public constructor(seed: string)
    {
        this.id = uuidv5(seed, DeviceId.DEVICE_NAMESPACE);
    }

    public toString(): string
    {
        return this.id;
    }

    public toJSON(): string
    {
        return this.id;
    }
}
