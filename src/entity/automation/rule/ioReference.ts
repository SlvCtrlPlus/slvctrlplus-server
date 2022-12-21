import {Exclude, Expose} from 'class-transformer';

@Exclude()
export default class IoReference
{
    @Expose()
    private readonly deviceType: string;

    @Expose()
    private readonly name: string;

    constructor(deviceType: string, name: string) {
        this.deviceType = deviceType;
        this.name = name;
    }

    public get getDeviceType(): string {
        return this.deviceType;
    }

    public get getName(): string {
        return this.name;
    }
}
