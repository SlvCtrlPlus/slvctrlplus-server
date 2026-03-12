export default interface DeviceTransport
{
    /**
     * Writes data and waits for a response associated to it and returns it as a result
     * @param data The command/input for the device
     * @param timeout The timeout the transport should wait for the operation to complete and get a response
     */
    sendAndAwaitReceive(data: Buffer, timeout?: number): Promise<Buffer>;

    /**
     * Writes data
     * @param data The command/input for the device
     */
    send(data: Buffer): Promise<void>;

    /**
     * When data is received
     * @param dataProcessor
     */
    onReceive(dataProcessor: (data: Buffer) => Promise<void>): void;

    /**
     * Called when the transport is closed (for example when a serial device is unplugged)
     * @param callback
     */
    onClose(callback: () => Promise<void>): void;

    /**
     * Returns whether the transport is currently open/active or not
     */
    isOpen(): boolean;

    /**
     * Closes the transport
     */
    close(): Promise<void>;

    /**
     * Returns a deterministic and unique device identifier (for example hardware serial number)
     */
    getDeviceIdentifier(): string;
}
