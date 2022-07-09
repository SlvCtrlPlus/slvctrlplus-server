export default interface ValueMapperInterface<I, O>
{
    map(inputValue: I): O;
}
