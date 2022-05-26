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

    @Expose({ toPlainOnly: true })
    private readonly connected: boolean;

    @Expose()
    private readonly adc: boolean;

    public constructor(connected: boolean, adc: boolean, mode: number, levelA: number, levelB: number) {
        this.connected = connected;
        this.levelA = levelA;
        this.levelB = levelB;
        this.mode = mode;
        this.adc = adc;
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

    public get getAdc(): boolean {
        return this.adc;
    }
}
