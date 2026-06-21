import { SerialPort, SerialPortMock } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import { SerialPortOpenOptions } from 'serialport';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import SerialPortFactory from '../../../src/factory/serialPortFactory.js';
import { SlvCtrlPlusDeviceSimulator } from './slvCtrlPlusDeviceSimulator.js';

/**
 * A SerialPortFactory that creates SerialPortMock instances backed by
 * MockBinding instead of real hardware.
 *
 * Supports routing different port paths to different simulators via a Map.
 * A single-simulator shorthand constructor is provided for backwards compatibility.
 */
export default class MockSerialPortFactory extends SerialPortFactory {
    private readonly simulators: Map<string, SlvCtrlPlusDeviceSimulator> = new Map();

    // Incremented on every attachDevice call so each mock port gets a unique serialNumber.
    // Without this the SerialPortObserver synthesizes the same "serial-1234-5678-undefined"
    // for every mock port (vendorId + productId + missing locationId), causing all devices
    // across all test iterations to share a single UUID via createKnownDevice. A unique
    // serial per connection means each device gets its own UUID and stale-device async-close
    // events can never accidentally evict a different test's device from the DeviceManager map.
    private productId = 1000;

    public constructor(simulator?: SlvCtrlPlusDeviceSimulator) {
        super();

        SerialPort.list = () => SerialPortMock.list();
    }

    public attachDevice(path: string, simulator: SlvCtrlPlusDeviceSimulator): void {
        SerialPortMock.binding.createPort(path, { echo: false, record: false, vendorId: '1234', productId: String(++this.productId), manufacturer: 'NotArduino' });
                
        this.simulators.set(path, simulator);
    }

    public reset(): void {
        this.simulators.clear();
        SerialPortMock.binding.reset();
    }

    public override create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPortStream<BindingInterface> {
        const mockPort = new SerialPortMock({
            path: options.path,
            baudRate: options.baudRate ?? 9600,
            autoOpen: false,
        });

        const simulator = this.simulators.get(options.path);
        
        if (!simulator) {
            throw new Error(`No simulator attached for path ${options.path}`);
        }

        // Attach the simulator once the port binding is ready (after open).
        mockPort.once('open', () => {
            if (mockPort.port && simulator) {
                simulator.attachToPort(mockPort.port);
            }
        });

        return mockPort;
    }
}
