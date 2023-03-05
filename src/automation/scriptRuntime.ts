import {NodeVM, VMScript} from "vm2";
import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import DeviceEventType from "../device/deviceEventType.js";

type DeviceEvent = { type: string|null, device: Device|null }
type Sandbox = {
    devices: DeviceRepositoryInterface,
    event: DeviceEvent
    context: { [key: string]: string }
}

export default class ScriptRuntime
{

    private scriptCode: VMScript = null;

    private vm: NodeVM = null;

    private sandbox: Sandbox;

    private readonly deviceRepository: DeviceRepositoryInterface;

    public constructor(deviceRepository: DeviceRepositoryInterface) {
        this.deviceRepository = deviceRepository;
    }

    public load(scriptCode: string): void
    {
        this.scriptCode = new VMScript(scriptCode);

        this.sandbox = {
            event: { type: null, device: null },
            devices: this.deviceRepository,
            context: {},
        }

        this.vm = new NodeVM({
            console: 'redirect',
            require: {
                external: true,
                root: './',
            },
            sandbox: this.sandbox
        });

        this.vm.on('console.log', (data) => {
            console.log(`VM stdout: ${data}`);
        });

        console.log('script loaded')
    }

    public unload(): void
    {
        this.vm = null;
        this.sandbox = null;

        console.log('script unloaded')
    }

    public runForEvent(eventType: DeviceEventType, device: Device): void
    {
        if (null === this.vm) {
            return;
        }

        this.sandbox.event.type = eventType;
        this.sandbox.event.device = device;

        try {
            this.vm.run(this.scriptCode);
        } catch (e: unknown) {
            console.error(`VM stdout: ${(e as Error).message}`);
        }
    }
}
