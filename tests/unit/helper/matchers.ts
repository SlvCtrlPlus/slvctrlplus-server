import { Matcher, MatcherCreator } from 'vitest-mock-extended';
import { equals } from '@vitest/expect';

export const matchStrictlyEqual: MatcherCreator<any> = expectedValue => new Matcher(
    (actualValue) => equals(actualValue, expectedValue, [], true),
    'matchStrictlyEqual'
);
