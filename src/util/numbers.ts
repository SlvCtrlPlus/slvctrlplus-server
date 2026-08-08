/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-redeclare */
export const MIN_AS_SECONDS = 60;
export const SECOND_AS_MILLISECONDS = 1000;
export const BITS_PER_BYTE = 8;
export const BYTE_MAX = 255;
export const JSON_INDENTION_SPACES = 2;
export const HALF_FACTOR = 0.5;

export type Int = number & { __integer__: never };

export const Int = {
    from: (value: number): Int => {
        if (!Number.isInteger(value)) {
            throw new Error(`Not an integer`);
        }
        return value as Int;
    },
    ZERO: 0 as Int,
};

export type Float = number & { __float__: never };

export const Float = {
    from: (value: number): Float => {
        if (isNaN(value) || !Number.isFinite(value)) {
            throw new Error(`Not a float`);
        }
        return value as Float;
    },
    ZERO: 0 as Float,
};
