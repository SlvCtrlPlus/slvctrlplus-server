import { TSchema } from '@sinclair/typebox';
import DeviceProvider from './deviceProvider.js';

/**
 * Extracts the `TConfig` a concrete `DeviceProvider` subclass was declared with, so
 * `DeviceProviderFactory<DP>` only needs a single type parameter instead of repeating the config
 * type separately.
 */
export type ConfigOf<DP> = DP extends DeviceProvider<infer TConfig> ? TConfig : never;

/**
 * Constructs one `DeviceProvider` instance for a single `DeviceSource` config entry.
 *
 * `configSchema` is the TypeBox schema for `ConfigOf<DP>` - `DeviceProviderManager` validates a
 * `DeviceSource`'s raw config against it before calling `create()`, so factories don't need to
 * defensively parse raw JSON themselves. TypeBox schemas carry their inferred type as a phantom
 * `static` property, so intersecting it with `{ static: ConfigOf<DP> }` is enough for TS to catch
 * a factory whose schema doesn't actually match its own `DP`'s config.
 *
 * Bounded to `TSchema` rather than `TObject`: `TObject` is itself generic with a recursive
 * default type parameter, and using it bare as a field type (rather than only ever as a generic
 * parameter bound, substituted with a concrete narrow type) blows TS's instantiation depth limit.
 * `TSchema` is a plain, non-generic marker interface, so it doesn't have this problem.
 *
 * Known limitation: this only catches a mismatched `configSchema` when `ConfigOf<DP>` has at
 * least one *required* property. If every property is optional (e.g. `{ scanIntervalMs?: number
 * }`), that type is structurally indistinguishable from `{}` under TS's assignability rules (each
 * is assignable to the other), so a wrong-but-also-all-optional schema slips through unnoticed at
 * compile time. Low practical impact: `DeviceProviderManager` still validates the real config
 * against `configSchema` via AJV at runtime, so a wrong pairing fails loudly (a validation error)
 * the first time it's actually exercised, rather than silently misbehaving.
 */
export default interface DeviceProviderFactory<DP extends DeviceProvider<any>>
{
    readonly configSchema: TSchema & { static: ConfigOf<DP> };

    create(config: ConfigOf<DP>): DP;
}
