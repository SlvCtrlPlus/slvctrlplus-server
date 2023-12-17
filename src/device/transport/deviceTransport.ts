export default interface DeviceTransport
{
    /**
     * Writes a line and waits for a response associated to it and returns it as a result
     * @param str The command/input for the device
     * @param timeout The timeout the transport should wait for the operation to complete and get a response
     */
    writeLineAndExpect(str: string, timeout?: number): Promise<string>;

    /**
     * Returns a deterministic and unique device identifier (for example hardware serial number)
     */
    getDeviceIdentifier(): string;
}
