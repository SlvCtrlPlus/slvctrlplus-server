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

    public constructor(id: string, type: string, config: JsonObject, enabled: boolean = true) {
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

    public isEnabled(): boolean {
        // class-transformer bypasses the constructor when deserializing from plain JSON, so a
        // missing 'enabled' property in the settings file results in `_enabled` being `undefined`
        // at runtime despite the constructor's default parameter. Treat that as enabled (default).
        return this._enabled ?? true;
    }
}
