import { SerialPortMock } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import { BindingInterface } from '@serialport/bindings-interface';
import { SerialPortOpenOptions } from 'serialport';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import SerialPortFactory from '../../../src/factory/serialPortFactory.js';
import { SlvCtrlPlusDeviceSimulator } from './slvCtrlPlusDeviceSimulator.js';

/**
 * A SerialPortFactory that creates SerialPortMock instances backed by
 * MockBinding instead of real hardware. The provided simulator is wired
 * up to each created port as soon as it opens.
 */
export default class MockSerialPortFactory extends SerialPortFactory {
    private readonly simulator: SlvCtrlPlusDeviceSimulator;

    public constructor(simulator: SlvCtrlPlusDeviceSimulator) {
        super();
        this.simulator = simulator;
    }

    public override create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPortStream<BindingInterface> {
        const mockPort = new SerialPortMock({
            path: options.path,
            baudRate: options.baudRate ?? 9600,
            autoOpen: false,
        });

        // Attach the simulator once the port binding is ready (after open).
        mockPort.once('open', () => {
            if (mockPort.port) {
                this.simulator.attachToPort(mockPort.port);
            }
        });

        return mockPort;
    }
}
