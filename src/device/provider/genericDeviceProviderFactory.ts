import DeviceProvider from './deviceProvider.js';
import DeviceProviderFactory from './deviceProviderFactory.js';

type ConcreteCtor<T> = new (...args: any[]) => T;

export default class GenericDeviceProviderFactory<
    DP extends DeviceProvider
> implements DeviceProviderFactory<DP>
{
    private readonly ctor: ConcreteCtor<DP>;
    private readonly args: ConstructorParameters<ConcreteCtor<DP>>;

    public constructor(ctor: ConcreteCtor<DP>, ...args: ConstructorParameters<ConcreteCtor<DP>>) {
        this.ctor = ctor;
        this.args = args;
    }

    public create(): DP {
        return new this.ctor(...this.args);
    }
}
