import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class DeviceSource
{
    @Expose({ name: "id" })
    private readonly _id: string;

    @Expose({ name: "type" })
    private readonly _type: string;

    @Expose({ name: "config" })
    private readonly _config: JsonObject;

    public constructor(id: string, type: string, config: JsonObject) {
        this._id = id;
        this._type = type;
        this._config = config;
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
}
