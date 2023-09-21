export default interface Transport
{
    writeLineAndExpect(str: string, timeout: number): Promise<string>;

    getDeviceIdentifier(): string;
}
