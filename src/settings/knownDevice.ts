import { Exclude, Expose } from 'class-transformer';
import { JsonObject } from '../types.js';
import { DeviceId } from '../device/deviceId.js';

@Exclude()
export default class KnownDevice
{
    @Expose({ name: 'id' })
    private readonly _id: DeviceId;

    @Expose({ name: 'name' })
    private readonly _name: string;

    @Expose({ name: 'type' })
    private readonly _type: string;

    @Expose({ name: 'source' })
    private readonly _source: string;

    @Expose({ name: 'config' })
    private readonly _config: JsonObject;

    // Read the persisted value on the way in only. On the way out we expose the normalized getter
    // below instead, so the serialized payload always carries a real boolean (never undefined for
    // legacy entries that predate this field).
    @Expose({ name: 'enabled', toClassOnly: true })
    private readonly _enabled: boolean;

    public constructor(
        id: DeviceId, name: string, type: string, source: string, config: JsonObject = {}, enabled: boolean = true
    ) {
        this._id = id;
        this._name = name;
        this._type = type;
        this._source = source;
        this._config = config;
        this._enabled = enabled;
    }

    public get id(): DeviceId {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public get type(): string {
        return this._type;
    }

    public get source(): string {
        return this._source;
    }

    public get config(): JsonObject {
        return this._config;
    }

    @Expose({ name: 'enabled', toPlainOnly: true })
    public get enabled(): boolean {
        // class-transformer bypasses the constructor when deserializing from plain JSON, so a
        // missing 'enabled' property in the settings file results in `_enabled` being `undefined`
        // at runtime despite the constructor's default parameter. Treat that as enabled (default).
        return this._enabled ?? true;
    }
}
