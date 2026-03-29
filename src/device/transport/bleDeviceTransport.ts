import { Characteristic, Peripheral } from '@stoprocent/noble';
import DeviceTransport from './deviceTransport.js';
import { asyncHandler } from '../../util/async.js';

export default class BleUartDeviceTransport implements DeviceTransport
{
    private readonly peripheral: Peripheral;
    private rx?: Characteristic;
    private tx?: Characteristic;

    private readonly uartRxCharacteristicUuid: string;
    private readonly uartTxCharacteristicUuid: string;

    private isConnected: boolean = false;
    private isSubscribing: boolean = false;

    private onCloseSubscribers: (() => Promise<void>)[] = [];
    private onReceiveSubscribers: ((data: Buffer) => void)[] = [];

    public static async create(
        peripheral: Peripheral,
        uartRxCharacteristicUuid: string,
        uartTxCharacteristicUuid: string
    ): Promise<BleUartDeviceTransport> {
        const transport = new this(peripheral, uartRxCharacteristicUuid, uartTxCharacteristicUuid);
        await transport.subscribe();
        return transport;
    }

    private constructor(peripheral: Peripheral, uartRxCharacteristicUuid: string, uartTxCharacteristicUuid: string) {
        this.peripheral = peripheral;
        this.uartRxCharacteristicUuid = uartRxCharacteristicUuid;
        this.uartTxCharacteristicUuid = uartTxCharacteristicUuid;

        this.peripheral.on('connect', asyncHandler(async () => await this.subscribe(), console.error));
        this.peripheral.on('disconnect', () => {
            this.isConnected = false;
        });
    }

    private async subscribe(): Promise<void> {
        if (this.isSubscribing) {
            return;
        }

        this.isSubscribing = true;

        try {
            if (this.peripheral.state === 'disconnected') {
                await this.peripheral.connectAsync();
            }

            const { characteristics } = await this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                [/* AiroticDeviceProvider.UART_SERVICE_UUID */],
                [this.uartRxCharacteristicUuid, this.uartTxCharacteristicUuid],
            );

            const rx = characteristics.find((c) => c.uuid === this.uartRxCharacteristicUuid);
            const tx = characteristics.find((c) => c.uuid === this.uartTxCharacteristicUuid);

            if (!rx || !tx) {
                throw new Error('Missing UART RX/TX characteristics on device.');
            }

            this.rx = rx;

            for (const subscriber of this.onReceiveSubscribers) {
                this.tx?.removeListener('data', subscriber);
            }

            this.tx = tx;

            await this.tx.subscribeAsync();

            for (const subscriber of this.onReceiveSubscribers) {
                this.tx.on('data', subscriber);
            }

            this.isConnected = true;
        } finally {
            this.isSubscribing = false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public sendAndAwaitReceive(data: Buffer, timeout?: number): Promise<Buffer> {
        throw new Error('Method not implemented.');
    }

    public async send(data: Buffer): Promise<void> {
        if (!this.rx) { throw new Error('RX characteristic not initialized'); }
        await this.rx.writeAsync(data, true);
    }

    public onReceive(dataProcessor: (data: Buffer) => void): void {
        this.onReceiveSubscribers.push(dataProcessor);
        this.tx?.on('data', dataProcessor);
    }

    public onClose(callback: () => Promise<void>): void {
        this.onCloseSubscribers.push(callback);
    }

    public isOpen(): boolean {
        return this.isConnected;
    }

    public async close(): Promise<void> {
        if (this.tx) {
            for (const subscriber of this.onReceiveSubscribers) {
                this.tx.removeListener('data', subscriber);
            }
            await this.tx.unsubscribeAsync();
        }

        this.isConnected = false;

        for (const callback of this.onCloseSubscribers) {
            await callback();
        }
    }

    public getDeviceIdentifier(): string {
        return this.peripheral.id;
    }
}