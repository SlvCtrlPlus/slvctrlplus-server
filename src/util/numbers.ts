export type Int = number & { __integer__: never };

export const Int = {
    from: (value: number): Int => {
        if (!Number.isInteger(value)) {
            throw new Error(`Not an integer`);
        }
        return value as Int;
    },
    ZERO: 0 as Int
};

export type Float = number & { __float__: never };

export const Float = {
    from: (value: number): Float => {
        if (isNaN(value) || !Number.isFinite(value)) {
            throw new Error(`Not a float`);
        }
        return value as Float;
    },
    ZERO: 0 as Float
};
