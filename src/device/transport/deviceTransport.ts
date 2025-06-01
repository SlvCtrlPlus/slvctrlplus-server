export default interface DeviceTransport
{
    /**
     * Writes data and waits for a response associated to it and returns it as a result
     * @param str The command/input for the device
     * @param timeout The timeout the transport should wait for the operation to complete and get a response
     */
    sendAndAwaitReceive(str: string, timeout?: number): Promise<string>;

    /**
     * Writes data
     * @param str The command/input for the device
     */
    send(str: string): Promise<void>;

    /**
     * When data is received
     * @param dataProcessor
     */
    receive(dataProcessor: (data: string) => Promise<void>): void;

    /**
     * Returns a deterministic and unique device identifier (for example hardware serial number)
     */
    getDeviceIdentifier(): string;
}
