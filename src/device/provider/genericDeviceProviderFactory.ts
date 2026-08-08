import type { AnyDeviceProvider } from './deviceProvider.js';
import type DeviceProviderFactory from './deviceProviderFactory.js';

type TypedCtor<T> = new (...args: never[]) => T;

// intersection makes T's instance type resolvable here (opaque T alone can't)
type ResolvedCtor<T extends TypedCtor<AnyDeviceProvider>> = TypedCtor<InstanceType<T>> & T;

export default class GenericDeviceProviderFactory<
    T extends TypedCtor<AnyDeviceProvider>,
> implements DeviceProviderFactory<InstanceType<T>>
{
    private readonly ctor: ResolvedCtor<T>;
    private readonly args: ConstructorParameters<T>;

    public constructor(ctor: ResolvedCtor<T>, ...args: ConstructorParameters<T>) {
        this.ctor = ctor;
        this.args = args;
    }

    public create(): InstanceType<T> {
        return new this.ctor(...this.args);
    }
}
