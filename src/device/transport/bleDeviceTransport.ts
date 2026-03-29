import { Characteristic, Peripheral } from '@stoprocent/noble';
import DeviceTransport from './deviceTransport.js';

export default class BleUartDeviceTransport implements DeviceTransport
{
    private readonly peripheral: Peripheral;
    private readonly rx: Characteristic;
    private readonly tx: Characteristic;

    private isConnected: boolean = true;

    private onCloseSubscribers: (() => Promise<void>)[] = [];

    public static async create(
        peripheral: Peripheral,
        uartRxCharacteristicUuid: string,
        uartTxCharacteristicUuid: string
    ): Promise<BleUartDeviceTransport> {
        if (peripheral.state === 'disconnected') {
            await peripheral.connectAsync();
        }

        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [/* AiroticDeviceProvider.UART_SERVICE_UUID */],
            [uartRxCharacteristicUuid, uartTxCharacteristicUuid],
        );

        const rx = characteristics.find((c) => c.uuid === uartRxCharacteristicUuid);
        const tx = characteristics.find((c) => c.uuid === uartTxCharacteristicUuid);

        if (!rx || !tx) {
            throw new Error('Missing UART RX/TX characteristics on device.');
        }

        await tx.subscribeAsync();

        return await new this(peripheral, rx, tx);
    }

    private constructor(peripheral: Peripheral, rx: Characteristic, tx: Characteristic) {
        this.peripheral = peripheral;
        this.rx = rx;
        this.tx = tx;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public sendAndAwaitReceive(data: Buffer, timeout?: number): Promise<Buffer> {
        throw new Error('Method not implemented.');
    }

    public async send(data: Buffer): Promise<void> {
        await this.rx.writeAsync(data, true);
    }

    public onReceive(dataProcessor: (data: Buffer) => void): void {
        this.tx.on('data', dataProcessor);
    }

    public onClose(callback: () => Promise<void>): void {
        this.onCloseSubscribers.push(callback);
    }

    public isOpen(): boolean {
        return this.isConnected;
    }

    public async close(): Promise<void> {
        await this.tx.unsubscribeAsync();
        this.isConnected = false;

        for (const callback of this.onCloseSubscribers) {
            await callback();
        }
    }

    public getDeviceIdentifier(): string {
        return this.peripheral.id;
    }
}