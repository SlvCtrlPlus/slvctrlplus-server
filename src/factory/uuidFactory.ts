import { v4 as uuidv4 } from 'uuid';

export default class UuidFactory
{
    public create(): string
    {
        return uuidv4();
    }
}
