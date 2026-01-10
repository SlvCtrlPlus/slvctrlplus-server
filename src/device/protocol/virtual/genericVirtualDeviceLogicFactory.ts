import VirtualDeviceLogic from './virtualDeviceLogic.js';
import Logger from '../../../logging/Logger.js';
import VirtualDeviceLogicFactory from './virtualDeviceLogicFactory.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;
type Constructor<TDeviceLogic extends VirtualDeviceLogic<any>> = new (config: ExtractConfig<TDeviceLogic>, logger: Logger) => TDeviceLogic;

export default class GenericVirtualDeviceLogicFactory<
    TDeviceLogic extends VirtualDeviceLogic<any, any>
> implements VirtualDeviceLogicFactory<TDeviceLogic>
{
    private readonly ctor: Constructor<TDeviceLogic>;

    private readonly logger: Logger;

    private constructor(ctor: Constructor<TDeviceLogic>, logger: Logger) {
        this.ctor = ctor;
        this.logger = logger;
    }

    public static from<TDeviceLogic extends VirtualDeviceLogic<any>>(
        genericVirtualDeviceLogicLogicConstructor: Constructor<TDeviceLogic>,
        logger: Logger
    ): GenericVirtualDeviceLogicFactory<TDeviceLogic> {
        return new GenericVirtualDeviceLogicFactory(
            genericVirtualDeviceLogicLogicConstructor,
            logger,
        );
    }

    public create(config: ExtractConfig<TDeviceLogic>): TDeviceLogic {
        return new this.ctor(config, this.logger);
    }

    public forDeviceType(): string
    {
        return this.ctor.name;
    }
}
