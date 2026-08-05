import DeviceReadableTransport from './deviceReadableTransport.js';
import DeviceWritableTransport from './deviceWritableTransport.js';

type DeviceTransport = {
    /**
     * Writes data and waits for a response associated to it and returns it as a result
     * @param data The command/input for the device
     * @param timeout The timeout the transport should wait for the operation to complete and get a response
     */
    sendAndAwaitReceive(data: Buffer, timeout?: number): Promise<Buffer>;
} & DeviceReadableTransport & DeviceWritableTransport
export default DeviceTransport
