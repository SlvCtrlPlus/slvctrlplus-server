import VirtualDeviceLogic, { ExtractConfig } from './virtualDeviceLogic.js';

type VirtualDeviceLogicFactory<TDeviceLogic extends VirtualDeviceLogic> = {
    create(config: ExtractConfig<TDeviceLogic>): TDeviceLogic;

    forDeviceType(): string;
};

export default VirtualDeviceLogicFactory;
