import VirtualDeviceLogic from './virtualDeviceLogic.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;

type VirtualDeviceLogicFactory<TDeviceLogic extends VirtualDeviceLogic<any, any>> = {
    create(config: ExtractConfig<TDeviceLogic>): TDeviceLogic;

    forDeviceType(): string;
};

export default VirtualDeviceLogicFactory;
