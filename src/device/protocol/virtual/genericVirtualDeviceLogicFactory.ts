import VirtualDeviceLogic, { ExtractConfig } from './virtualDeviceLogic.js';
import Logger from '../../../logging/Logger.js';
import VirtualDeviceLogicFactory from './virtualDeviceLogicFactory.js';

type Constructor<TDeviceLogic extends VirtualDeviceLogic> = new (config: ExtractConfig<TDeviceLogic>, logger: Logger) => TDeviceLogic;

export default class GenericVirtualDeviceLogicFactory<
    TDeviceLogic extends VirtualDeviceLogic,
> implements VirtualDeviceLogicFactory<TDeviceLogic>
{
    private readonly ctor: Constructor<TDeviceLogic>;

    private readonly logger: Logger;

    private constructor(ctor: Constructor<TDeviceLogic>, logger: Logger) {
        this.ctor = ctor;
        this.logger = logger;
    }

    public static from<TDeviceLogic extends VirtualDeviceLogic>(
        genericVirtualDeviceLogicLogicConstructor: Constructor<TDeviceLogic>,
        logger: Logger,
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
