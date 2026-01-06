import { Matcher, MatcherCreator } from 'jest-mock-extended';

export const equals: MatcherCreator<any> = expectedValue => new Matcher((actualValue) => {
    return compareValue(expectedValue, actualValue);
}, '');

function compareValue(expectedValue: any, actualValue: any): boolean
{
    if (typeof actualValue !== typeof expectedValue) {
        return false;
    }

    if ('object' === typeof actualValue) {
        return compareObject(expectedValue, actualValue);
    }

    return expectedValue === actualValue;
}

function compareObject(expectedValue: Record<any, any>, actualValue: Record<any, any>): boolean
{
    for (const key in expectedValue) {
        if (false === compareValue(expectedValue[key], actualValue[key])) {
            return false;
        }
    }

    return true;
}
