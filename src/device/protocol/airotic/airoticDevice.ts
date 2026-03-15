import { Int, Float } from '../../../util/numbers.js';
import Device from '../../device.js';

export default class AiroticDevice extends Device
{
    public override setAttribute<K extends string, V extends string | boolean | Int | Float | null | undefined>(attributeName: K, value: V): Promise<V> {
        console.log(attributeName, value);
        throw new Error('Method not implemented.');
    }
}
