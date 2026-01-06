// eslint-disable-next-line @typescript-eslint/naming-convention
export type Int = number & { __integer__: never };

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-redeclare
export const Int = {
    from: (value: number): Int => {
        if (!Number.isInteger(value)) {
            throw new Error("Not an integer");
        }
        return value as Int;
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ZERO: 0 as Int
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export type Float = number & { __float__: never };

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-redeclare
export const Float = {
    from: (value: number): Float => {
        if (isNaN(value) || !Number.isFinite(value)) {
            throw new Error("Not a float");
        }
        return value as Float;
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ZERO: 0 as Float
};
