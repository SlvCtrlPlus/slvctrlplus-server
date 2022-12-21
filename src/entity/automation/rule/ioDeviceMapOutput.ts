import {Exclude, Expose} from 'class-transformer';
import IoReference from "./ioReference.js";

@Exclude()
export default class IoDeviceMapOutput
{
    @Expose()
    private readonly reference: IoReference;

    constructor(reference: IoReference) {
        this.reference = reference;
    }

    public get getReference(): IoReference {
        return this.reference;
    }
}
