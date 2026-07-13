import { TSchema } from '@sinclair/typebox';
import VirtualDeviceLogic from './virtualDeviceLogic.js';

type ExtractConfig<T extends VirtualDeviceLogic<any, any>> = T extends VirtualDeviceLogic<any, infer C> ? C : never;

export default interface VirtualDeviceLogicFactory<TDeviceLogic extends VirtualDeviceLogic<any, any>>
{
    /**
     * Known limitation: this only catches a `configSchema` that doesn't match `TDeviceLogic`'s
     * own config when that config has at least one *required* property (verified: e.g. pairing
     * `PiperVirtualDeviceLogic`, whose config requires `model`, with `noDeviceConfigSchema` is
     * correctly rejected). If every property is optional (e.g. `TtsVirtualDeviceConfig`'s `{
     * voice?: string }`), that type is structurally indistinguishable from `{}` under TS's
     * assignability rules, so a wrong-but-also-all-optional schema slips through unnoticed at
     * compile time (verified: pairing `TtsVirtualDeviceLogic` with `noDeviceConfigSchema` compiles
     * without error). Low practical impact: `GenericVirtualDeviceFactory.create()` still validates
     * the real config against `configSchema` via AJV at runtime, so a wrong pairing fails loudly
     * (a validation error) the first time it's actually exercised, rather than silently
     * misbehaving.
     */
    readonly configSchema: TSchema & { static: ExtractConfig<TDeviceLogic> };

    create(config: ExtractConfig<TDeviceLogic>): TDeviceLogic;

    forDeviceType(): string;
}
