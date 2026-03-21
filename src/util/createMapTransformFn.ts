/* eslint-disable */
import { ClassConstructor, instanceToPlain, plainToInstance, TransformationType, TransformFnParams } from "class-transformer";

/**
 * Create a transformation function for `Transform` decorator which decorates `Map<string, any>` type property.
 * THIS IS A WORKAROUND, SEE: https://github.com/typestack/class-transformer/issues/288
 *
 * @param mapValueClass Type of value. (e.g. `MyClass`, `Number`, `String`, `Boolean` ...)
 */
export default function createMapTransformFn<T>(mapValueClass: ClassConstructor<T>) {
    return (params: TransformFnParams): any => {
        const { type, value, options } = params;
        const isPrimitiveClass = [String, Number, Boolean].includes(mapValueClass as any);
        switch (type) {
            case TransformationType.PLAIN_TO_CLASS: {
                if (value instanceof Object === false) {
                    return new Map<string, T>();
                }
                const transformedEntries = Object.entries(value)
                    .filter(([, v]) => {
                        return isPrimitiveClass || typeof v === "object";
                    })
                    .map(([k, v]) => {
                        const transformedValue = isPrimitiveClass ? (mapValueClass as any)(v) : plainToInstance(mapValueClass, v, options);
                        console.log(options, k, transformedValue)
                        return [k, transformedValue];
                    }) as [string, T][];
                return new Map(transformedEntries);
            }

            case TransformationType.CLASS_TO_PLAIN: {
                if (value instanceof Map === false) {
                    return {};
                }
                const transformedEntries = Array.from((value as Map<string, T>).entries())
                    .filter(([k, v]) => {
                        return typeof k === "string" && (isPrimitiveClass || v instanceof mapValueClass);
                    })
                    .map(([k, v]) => {
                        return [k, isPrimitiveClass ? (mapValueClass as any)(v) : instanceToPlain(v, options)];
                    });
                return Object.fromEntries(transformedEntries);
            }

            default:
                return value;
        }
    };
}
