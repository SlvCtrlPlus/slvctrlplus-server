import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class KnownDevice
{
    @Expose({ name: "id" })
    private readonly _id: string;

    @Expose({ name: "serialNo" })
    private readonly _serialNo: string;

    @Expose({ name: "name" })
    private readonly _name: string;

    @Expose({ name: "type" })
    private readonly _type: string;

    @Expose({ name: "source" })
    private readonly _source: string;

    @Expose({ name: "config" })
    private readonly _config: JsonObject;

    public constructor(
        id: string, serialNo: string, name: string, type: string, source: string, config: JsonObject = {}
    ) {
        this._id = id;
        this._serialNo = serialNo;
        this._name = name;
        this._type = type;
        this._source = source;
        this._config = config;
    }

    public get id(): string {
        return this._id;
    }

    public get serialNo(): string {
        return this._serialNo;
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
