import DeviceProvider from './deviceProvider.js';
import DeviceProviderFactory from './deviceProviderFactory.js';

type ConcreteCtor<T> = new (...args: any[]) => T;

export default class GenericDeviceProviderFactory<
    C extends ConcreteCtor<DeviceProvider>
> implements DeviceProviderFactory
{
    private readonly ctor: C;
    private readonly args: ConstructorParameters<C>;

    public constructor(ctor: C, ...args: ConstructorParameters<C>) {
        this.ctor = ctor;
        this.args = args;
    }

    public create(): DeviceProvider {
        return new this.ctor(...this.args);
    }
}
