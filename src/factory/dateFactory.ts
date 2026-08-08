export default class DateFactory
{
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public now(): Date
    {
        return new Date();
    }
}
