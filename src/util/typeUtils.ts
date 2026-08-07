import BaseError from 'modern-errors';

type TupleOfExactly<T, N extends number, Acc extends T[] = []> =
    Acc['length'] extends N ? Acc : TupleOfExactly<T, N, [...Acc, T]>;

export const hasExactLength = <T, N extends number>(
    arr: readonly T[],
    length: N,
): arr is TupleOfExactly<T, N> => arr.length === length;

export const normalizeError = (error: unknown): Error => error instanceof Error ? error : BaseError.normalize(error);
