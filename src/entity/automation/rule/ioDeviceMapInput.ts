import {Exclude, Expose} from 'class-transformer';
import IoReference from "./ioReference.js";

@Exclude()
export default class IoDeviceMapInput
{
    @Expose()
    private readonly reference: IoReference;

    @Expose()
    private readonly targetDeviceId: string;

    public constructor(targetDeviceId: string, reference: IoReference) {
        this.reference = reference;
        this.targetDeviceId = targetDeviceId;
    }

    public get getReference(): IoReference {
        return this.reference;
    }

    public get getTargetDeviceId(): string {
        return this.targetDeviceId;
    }
}
