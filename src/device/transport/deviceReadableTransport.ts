export default interface DeviceReadableTransport
{
    /**
     * When data is received
     * @param dataProcessor
     */
    onReceive(dataProcessor: (data: Buffer) => void): void;

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
