import { validate as isUuid, v4 as uuidv4, v5 as uuidv5 } from 'uuid';

export default class UuidFactory
{
    public static readonly DEFAULT_NAMESPACE = '1eb996d5-15ee-4c2c-9a4c-4f84a7dedb56'

    private readonly namespace: string;

    public constructor(namespace: string)
    {
        if (!isUuid(namespace)) {
            throw new Error(`Invalid UUID namespace: ${namespace}`);
        }

        this.namespace = namespace;
    }

    public create(seed?: string): string
    {
        if (undefined === seed) {
            return uuidv4();
        }

        return uuidv5(seed, this.namespace);
    }
}
