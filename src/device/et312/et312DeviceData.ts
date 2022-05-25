import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class Et312DeviceData
{
    @Expose()
    private readonly levelA: number;

    @Expose()
    private readonly levelB: number;

    @Expose()
    private readonly mode: number;

    public constructor() {
        this.levelA = -1;
        this.levelB = -1;
        this.mode = -1;
    }

    public get getLevelA(): number {
        return this.levelA;
    }

    public get getLevelB(): number {
        return this.levelB;
    }

    public get getMode(): number {
        return this.mode;
    }
}
