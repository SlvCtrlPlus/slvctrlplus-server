import { TSchema } from '@sinclair/typebox';
import VirtualDeviceLogic from './virtualDeviceLogic.js';
import Logger from '../../../logging/Logger.js';
import VirtualDeviceLogicFactory from './virtualDeviceLogicFactory.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;
type Constructor<TDeviceLogic extends VirtualDeviceLogic<any>> = new (config: ExtractConfig<TDeviceLogic>, logger: Logger) => TDeviceLogic;

export default class GenericVirtualDeviceLogicFactory<
    TDeviceLogic extends VirtualDeviceLogic<any, any>
> implements VirtualDeviceLogicFactory<TDeviceLogic>
{
    public readonly configSchema: TSchema & { static: ExtractConfig<TDeviceLogic> };

    private readonly ctor: Constructor<TDeviceLogic>;

    private readonly logger: Logger;

    public constructor(
        ctor: Constructor<TDeviceLogic>,
        configSchema: TSchema & { static: ExtractConfig<TDeviceLogic> },
        logger: Logger
    ) {
        this.ctor = ctor;
        this.configSchema = configSchema;
        this.logger = logger;
    }

    public create(config: ExtractConfig<TDeviceLogic>): TDeviceLogic {
        return new this.ctor(config, this.logger);
    }

    public forDeviceType(): string
    {
        return this.ctor.name;
    }
}
