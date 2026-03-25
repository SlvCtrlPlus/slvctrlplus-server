import { Exclude, Expose, Transform } from 'class-transformer';
import KnownDevice from './knownDevice.js';
import createMapTransformFn from '../util/createMapTransformFn.js';
import DeviceSource from './deviceSource.js';
import { DeviceId } from '../device/deviceId.js';
import { Type } from '@sinclair/typebox';

export const SettingsSchema = Type.Object({
  knownDevices: Type.Record(
    Type.String(),
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      serialNo: Type.Optional(Type.String()),
      name: Type.String(),
      type: Type.String(),
      source: Type.String(),
      config: Type.Optional(Type.Object({}, { additionalProperties: true }))
    }, {
      additionalProperties: false,
      required: ['id', 'name', 'type', 'source']
    })
  ),
  deviceSources: Type.Record(
    Type.String(),
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      type: Type.String(),
      config: Type.Object({}, { additionalProperties: true })
    }, {
      additionalProperties: false,
      required: ['id', 'type', 'config']
    })
  )
}, {
  additionalProperties: false,
  required: ['knownDevices', 'deviceSources']
});

@Exclude()
export default class Settings
{
    @Expose()
    @Transform(createMapTransformFn(KnownDevice))
    private readonly knownDevices: Map<string, KnownDevice>;

    @Expose()
    @Transform(createMapTransformFn(DeviceSource))
    private readonly deviceSources: Map<string, DeviceSource>;

    public constructor() {
        this.deviceSources = new Map();
        this.knownDevices = new Map();
    }

    public getDeviceSources(): Map<string, DeviceSource> {
        return this.deviceSources;
    }

    public getKnownDevices(): Map<string, KnownDevice> {
        return this.knownDevices;
    }

    public getKnownDevicesBySource(sourceName: string): Map<string, KnownDevice> {
        const filteredDevices = new Map<string, KnownDevice>();

        for (const [key, value] of this.knownDevices) {
            if (value.source === sourceName) {
                filteredDevices.set(key, value);
            }
        }

        return filteredDevices;
    }

    public getKnownDeviceById(id: DeviceId): KnownDevice|undefined
    {
        // Return already existing device if already known (previously detected serial number)
        return this.knownDevices.get(id);
    }

    public addKnownDevice(knownDevice: KnownDevice): void
    {
        this.knownDevices.set(knownDevice.id, knownDevice);
    }

    public addDeviceSource(deviceSource: DeviceSource): void
    {
        this.deviceSources.set(deviceSource.id, deviceSource);
    }
}
