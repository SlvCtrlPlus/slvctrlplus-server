import EventEmitter from 'events';
import { Characteristic, Peripheral } from '@stoprocent/noble';

const UART_RX_CHAR_UUID = '6e400002b5a3f393e0a9e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400003b5a3f393e0a9e50e24dcca9e';

/**
 * Minimal mock of a noble Characteristic that is sufficient for
 * BleUartDeviceTransport. The TX characteristic (device → host) can push
 * data to subscribed listeners via pushData(). The RX characteristic
 * (host → device) records every write in writtenData.
 */
export class MockBleCharacteristic extends EventEmitter {
    public readonly uuid: string;
    public writtenData: Buffer[] = [];

    public constructor(uuid: string) {
        super();
        this.uuid = uuid;
    }

    public async subscribeAsync(): Promise<void> {
        // no-op: simulates successful CCCD subscribe
    }

    public async unsubscribeAsync(): Promise<void> {
        // no-op
    }

    public async writeAsync(data: Buffer, _withoutResponse: boolean): Promise<void> {
        this.writtenData.push(Buffer.from(data));
    }

    /** Push data as if the physical device transmitted it (TX → host direction). */
    public pushData(data: Buffer): void {
        this.emit('data', Buffer.from(data));
    }
}

/**
 * Mock of a noble Peripheral sufficient for BleUartDeviceTransport and BleDevice.
 * State starts as 'disconnected' and is updated by connectAsync/disconnectAsync.
 */
export class MockBlePeripheral extends EventEmitter {
    public id: string;
    public rssi: number;
    public state: 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
    public advertisement: { localName: string };

    private readonly rxChar: MockBleCharacteristic;
    private readonly txChar: MockBleCharacteristic;

    public constructor(id: string, localName: string, rssi = -60) {
        super();
        this.id = id;
        this.rssi = rssi;
        this.state = 'disconnected';
        this.advertisement = { localName };

        this.rxChar = new MockBleCharacteristic(UART_RX_CHAR_UUID);
        this.txChar = new MockBleCharacteristic(UART_TX_CHAR_UUID);
    }

    public async connectAsync(): Promise<void> {
        this.state = 'connected';
        this.emit('connect', null);
    }

    public async disconnectAsync(): Promise<void> {
        this.state = 'disconnected';
        this.emit('disconnect');
    }

    public async updateRssiAsync(): Promise<number> {
        return this.rssi;
    }

    public cancelConnect(): void {
        this.state = 'disconnected';
        this.emit('connect', new Error('connection canceled!'));
    }

    public async discoverSomeServicesAndCharacteristicsAsync(
        _serviceUuids: string[],
        _characteristicUuids: string[],
    ): Promise<{ services: unknown[]; characteristics: MockBleCharacteristic[] }> {
        return {
            services: [],
            characteristics: [this.rxChar, this.txChar],
        };
    }

    /** Get the RX characteristic (host → device). Inspect writtenData after operations. */
    public get rx(): MockBleCharacteristic {
        return this.rxChar;
    }

    /** Get the TX characteristic (device → host). Call pushData() to simulate device output. */
    public get tx(): MockBleCharacteristic {
        return this.txChar;
    }
}

/**
 * Simulates an Airotic BLE device: auto-responds to the handshake (!H → "Hello I am bottle")
 * and records color/command messages received via the RX characteristic.
 */
export class AiroticDeviceSimulator {
    private readonly peripheral: MockBlePeripheral;

    public constructor(id: string, localName = 'Airotic Test', rssi = -60) {
        this.peripheral = new MockBlePeripheral(id, localName, rssi);

        // Intercept RX writes to auto-respond to the handshake message
        const originalWrite = this.peripheral.rx.writeAsync.bind(this.peripheral.rx);
        this.peripheral.rx.writeAsync = async (data: Buffer, withoutResponse: boolean): Promise<void> => {
            await originalWrite(data, withoutResponse);
            const msg = data.toString('utf-8');
            if (msg === '!H') {
                // Simulate the device's handshake response on the TX channel
                setImmediate(() => {
                    this.peripheral.tx.pushData(Buffer.from('Hello I am bottle 7', 'utf-8'));
                });
            }
        };
    }

    public getPeripheral(): MockBlePeripheral {
        return this.peripheral;
    }

    /** Simulate the device sending a breath-in notification (*B). */
    public sendBreathIn(): void {
        this.peripheral.tx.pushData(Buffer.from('*B', 'utf-8'));
    }

    /** Simulate the device sending a rest-color notification (*R). */
    public sendRest(): void {
        this.peripheral.tx.pushData(Buffer.from('*R', 'utf-8'));
    }

    /** Get all data written to the RX characteristic (commands sent by the server). */
    public getWrittenCommands(): Buffer[] {
        return this.peripheral.rx.writtenData;
    }
}

// ---------------------------------------------------------------------------
// Mock noble singleton used as a replacement for '@stoprocent/noble'.
// Tests import this to trigger BLE discovery events.
// ---------------------------------------------------------------------------

export class MockNoble extends EventEmitter {
    public async waitForPoweredOnAsync(): Promise<void> {
        // no-op: BLE always "powered on" in tests
    }

    public async startScanningAsync(_serviceUuids: string[], _allowDuplicates: boolean): Promise<void> {
        // no-op
    }

    public async stopScanningAsync(): Promise<void> {
        // no-op
    }

    public stop(): void {
        // no-op
    }

    /** Trigger discovery of a simulated peripheral. */
    public discoverPeripheral(peripheral: MockBlePeripheral): void {
        this.emit('discover', peripheral);
    }
}

export const mockNoble = new MockNoble();
