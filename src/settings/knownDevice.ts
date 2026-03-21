import { Exclude, Expose, Type } from 'class-transformer';
import { JsonObject } from '../types.js';
import DeviceId from '../device/deviceId.js';

@Exclude()
export default class KnownDevice
{
    @Expose({ name: 'id' })
    @Type(() => DeviceId)
    private readonly _id: DeviceId;

    @Expose({ name: 'name' })
    private readonly _name: string;

    @Expose({ name: 'type' })
    private readonly _type: string;

    @Expose({ name: 'source' })
    private readonly _source: string;

    @Expose({ name: 'config' })
    private readonly _config: JsonObject;

    public constructor(
        id: DeviceId, name: string, type: string, source: string, config: JsonObject = {}
    ) {
        this._id = id;
        this._name = name;
        this._type = type;
        this._source = source;
        this._config = config;
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
}
