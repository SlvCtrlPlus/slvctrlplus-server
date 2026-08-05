import { Exclude, Expose } from 'class-transformer';
import { JsonObject } from '../types.js';

@Exclude()
export default class DeviceSource
{
    @Expose({ name: 'id' })
    private readonly _id: string;

    @Expose({ name: 'type' })
    private readonly _type: string;

    @Expose({ name: 'config' })
    private readonly _config: JsonObject;

    @Expose({ name: 'enabled' })
    private readonly _enabled: boolean;

    public constructor(id: string, type: string, config: JsonObject, enabled = true) {
        this._id = id;
        this._type = type;
        this._config = config;
        this._enabled = enabled;
    }

    public get id(): string {
        return this._id;
    }

    public get type(): string {
        return this._type;
    }

    public get config(): JsonObject {
        return this._config;
    }

    public get enabled(): boolean {
        return this._enabled;
    }
}
