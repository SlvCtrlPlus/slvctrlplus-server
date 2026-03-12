import DeviceTransport from './deviceTransport.js';
import SynchronousSerialPort from '../../serial/synchronousSerialPort.js';

export default class SerialDeviceTransport implements DeviceTransport
{
    private readonly serialPort: SynchronousSerialPort;
    private readonly frameStartBytes?: Buffer;
    private readonly frameEndBytes?: Buffer;

    public constructor(serialPort: SynchronousSerialPort, frameStartBytes?: Buffer, frameEndBytes?: Buffer) {
        this.serialPort = serialPort;
        this.frameStartBytes = frameStartBytes;
        this.frameEndBytes = frameEndBytes;
    }

    public async sendAndAwaitReceive(frame: Buffer, timeout?: number): Promise<Buffer> {
        return this.serialPort.writeAndExpect(this.addFrameBoundaries(frame), timeout);
    }

    public async send(frame: Buffer): Promise<void> {
        return this.serialPort.write(this.addFrameBoundaries(frame));
    }

    public onReceive(dataProcessor: (data: Buffer) => void): void {
        this.serialPort.onData(dataProcessor);
    }

    public onClose(callback: () => Promise<void>): void {
        this.serialPort.onClose(callback);
    }

    public isOpen(): boolean {
        return this.serialPort.isOpen();
    }

    public async close(): Promise<void> {
        await this.serialPort.close();
    }

    public getDeviceIdentifier(): string {
        const portInfo = this.serialPort.getPortInfo();

        if (undefined !== portInfo.serialNumber) {
            return portInfo.serialNumber;
        }

        // Fall back to some (hopefully) unique combination if serial number is missing
        if (undefined !== portInfo.vendorId && undefined !== portInfo.productId && undefined !== portInfo.locationId) {
            return `${portInfo.vendorId}-${portInfo.productId}-${portInfo.locationId}`;
        }

        // If only the bare minimum is available
        return portInfo.path;
    }

    private addFrameBoundaries(frame: Buffer): Buffer {
        const frameWithBoundaries: Buffer<ArrayBufferLike>[] = [];

        if (undefined !== this.frameStartBytes) {
            frameWithBoundaries.push(this.frameStartBytes);
        }

        frameWithBoundaries.push(frame);

        if (undefined !== this.frameEndBytes) {
            frameWithBoundaries.push(this.frameEndBytes);
        }

        return Buffer.concat(frameWithBoundaries);
    }
}
