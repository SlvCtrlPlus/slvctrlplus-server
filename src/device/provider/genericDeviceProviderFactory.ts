import { TSchema } from '@sinclair/typebox';
import DeviceProvider from './deviceProvider.js';
import DeviceProviderFactory, { ConfigOf } from './deviceProviderFactory.js';

/**
 * Every `DeviceProvider` constructor starts with `config: ConfigOf<DP>` as its first parameter
 * (see `DeviceProvider`'s own doc comment) - this is what lets `GenericDeviceProviderFactory`
 * capture every other constructor argument once, at DI-wiring time (`TDependencyArgs` - the
 * "always the same, regardless of `DeviceSource`" deps, as opposed to `config`, which varies per
 * `DeviceSource`), and prepend the actual validated config later, once per `DeviceSource`, in
 * `create()`.
 */
export default class GenericDeviceProviderFactory<
    DP extends DeviceProvider<any>,
    TDependencyArgs extends any[] = any[]
> implements DeviceProviderFactory<DP>
{
    public readonly configSchema: TSchema & { static: ConfigOf<DP> };

    private readonly ctor: new (config: ConfigOf<DP>, ...dependencyArgs: TDependencyArgs) => DP;
    private readonly dependencyArgs: TDependencyArgs;

    public constructor(
        configSchema: TSchema & { static: ConfigOf<DP> },
        ctor: new (config: ConfigOf<DP>, ...dependencyArgs: TDependencyArgs) => DP,
        ...dependencyArgs: TDependencyArgs
    ) {
        this.configSchema = configSchema;
        this.ctor = ctor;
        this.dependencyArgs = dependencyArgs;
    }

    public create(config: ConfigOf<DP>): DP {
        return new this.ctor(config, ...this.dependencyArgs);
    }
}
