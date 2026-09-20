import { Exclude, Expose } from 'class-transformer';
import DeviceState from './deviceState.js';
import type { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import type { EventEmitter } from 'events';
import type { DeviceId } from './deviceId.js';
import type { JsonObject } from '../types.js';
import type { DropFirst } from '../types.js';
import type Logger from '../logging/Logger.js';
import type { TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../schemaValidation/JsonSchemaValidator.js';
import DeviceDataValidationError from './deviceDataValidationError.js';

/** Flat key→value map for device attribute state. */
export type DeviceAttributeValues = Record<string, unknown>;

/**
 * Recursive deep-partial type for attribute updates.
 * Distributive over unions (handles discriminated union schemas).
 * Scalars and arrays pass through unchanged; only object keys become optional.
 */
export type DeviceDataUpdate<A> = A extends unknown
    ? A extends Record<string, unknown>
        ? { [K in keyof A]?: DeviceDataUpdate<A[K]> }
        : A
    : never;

export type DeviceData<T extends DeviceAttributeValues = DeviceAttributeValues> = DeviceDataUpdate<T>;

export type DeviceDataApplyError = { path: string, message: string };

export type DeviceDataUpdateResult<T extends DeviceAttributeValues = DeviceAttributeValues> = {
    deviceData: T;
    errors: DeviceDataApplyError[];
};

export type DeviceNotifications = JsonObject;
export type NoDeviceNotifications = Record<never, never>;
type AnyDeviceNotifications = JsonObject;

export type DeviceError = {
    reason: string;
    occurredAt: Date;
};

export enum DeviceEvent {
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceNotification = 'deviceNotification',
}

type DeviceNotification<TNotifications extends DeviceNotifications> =
    { [K in keyof TNotifications & string]: { type: K, data: TNotifications[K] } }[keyof TNotifications & string];

export type AnyDeviceNotification = DeviceNotification<AnyDeviceNotifications>;

export type DeviceEventMap<
    TDevice extends AnyDevice,
    TNotifications extends DeviceNotifications,
> = {
    [DeviceEvent.deviceRefreshed]: [device: TDevice];
    [DeviceEvent.deviceDisconnected]: [device: TDevice];
    [DeviceEvent.deviceNotification]: [device: TDevice, notification: DeviceNotification<TNotifications>];
};

export type WithUntypedAttributes<D extends AnyDevice> = Omit<D, 'updateDeviceData'> & {
    // Method syntax: this is the AnyDevice type-erasure boundary, and needs to structurally accept
    // any concrete device's narrower updateDeviceData. Property syntax would check
    // parameters contravariantly and break that (see AiroticDevice/Zc95Device/etc. assignability).
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    updateDeviceData(update: DeviceData): Promise<DeviceDataUpdateResult>;
};

export type AnyDevice = WithUntypedAttributes<Device>;

export type DeviceInfo = {
    deviceId: DeviceId;
    deviceName: string;
    provider: string;
    connectedSince: Date;
    controllable: boolean;
};

@Exclude()
export default abstract class Device<
    TDeviceData extends DeviceAttributeValues = DeviceAttributeValues,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> {
    @Expose()
    protected readonly deviceId: DeviceId;

    @Expose()
    protected readonly connectedSince: Date;

    @Expose()
    protected readonly deviceName: string;

    @Expose()
    protected readonly provider: string;

    @Expose()
    protected state: DeviceState;

    @Expose()
    protected errorInfo: DeviceError | undefined;

    @Expose()
    protected readonly type: string | undefined; // This field is only here to expose it explicitly

    @Expose()
    protected readonly controllable: boolean;

    @Expose()
    protected lastRefresh: Date | undefined;

    /** JSON Schema describing the device's current attributes (shape, validation, metadata). */
    @Expose()
    protected dataSchema: TSchema;

    /** Flat key→value map of current attribute state. */
    @Expose()
    protected data: TDeviceData;

    @Expose()
    protected readonly config: TConfig;

    protected readonly logger: Logger;

    private readonly validatorFactory: JsonSchemaValidatorFactory;

    private validator: JsonSchemaValidator<TSchema>;

    private closePromise?: Promise<void>;

    private readonly eventEmitter: EventEmitter;

    protected constructor(
        deviceInfo: DeviceInfo,
        attributesSchema: TSchema,
        attributes: TDeviceData,
        validatorFactory: JsonSchemaValidatorFactory,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        this.deviceId = deviceInfo.deviceId;
        this.deviceName = deviceInfo.deviceName;
        this.provider = deviceInfo.provider;
        this.connectedSince = deviceInfo.connectedSince;
        this.controllable = deviceInfo.controllable;
        this.dataSchema = attributesSchema;
        this.data = attributes;
        this.validatorFactory = validatorFactory;
        this.validator = validatorFactory.create(attributesSchema);
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.logger = logger.child({ name: `${new.target.name}.${deviceInfo.deviceId}` });
        this.state = DeviceState.ready;
    }

    public get getDeviceId(): DeviceId {
        return this.deviceId;
    }

    public get getDeviceName(): string {
        return this.deviceName;
    }

    public get getProvider(): string {
        return this.provider;
    }

    public get isControllable(): boolean {
        return this.controllable;
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public get getRefreshInterval(): number | undefined {
        return undefined;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    public async refresh(): Promise<void>
    {
        if (this.state === DeviceState.closed || this.state === DeviceState.closing) {
            throw new Error('Cannot refresh device as it is closed or closing');
        }

        await this.doRefresh();

        this.updateLastRefresh();
    }

    public getDeviceData(): TDeviceData {
        return structuredClone(this.data);
    }

    public on<K extends DeviceEvent>(event: K, listener: (...args: DeviceEventMap<this, TNotifications>[K]) => void): void
    {
        this.eventEmitter.on(event, listener);
    }

    public async close(): Promise<void>
    {
        if (undefined !== this.closePromise) {
            return this.closePromise;
        }

        this.state = DeviceState.closing;
        this.closePromise = this.performClose();

        return this.closePromise;
    }

    /**
     * Apply a partial attribute update (template method).
     *
     * 1. Build a merged candidate via `buildCandidate` (overridable for transition-aware merges)
     * 2. Validate the candidate against the current schema (ajv, x-keywords active)
     * 3. If invalid → throw `DeviceDataValidationError` (zero device messages sent)
     * 4. If valid → delegate to `applyDeviceData` for ordered side-effects
     * 5. Return result envelope
     * @throws DeviceDataValidationError if the merged candidate fails schema validation.
     */
    public async updateDeviceData(update: DeviceDataUpdate<TDeviceData>): Promise<DeviceDataUpdateResult<TDeviceData>> {
        const candidate = this.buildCandidate(update);

        if (!this.validator.validate(candidate)) {
            const validationErrors = this.validator.getValidationErrors().map(
                (err): DeviceDataApplyError => ({
                    path: err.instancePath || '/',
                    message: err.message ?? 'validation failed',
                }),
            );

            throw new DeviceDataValidationError(
                `Attribute update failed validation: ${this.validator.getValidationErrors().map(e => e.message).join(', ')}`,
                validationErrors,
            );
        }

        const errors = await this.applyDeviceData(update);

        this.updateLastRefresh();

        return {
            deviceData: this.getDeviceData(),
            errors,
        };
    }

    /**
     * Build a merged candidate from the current state + incoming update for pre-validation.
     * Deep-merges `candidateBase(update)` with the update (objects merged, scalars/arrays replaced).
     */
    protected buildCandidate(update: DeviceDataUpdate<TDeviceData>): unknown {
        return Device.deepMerge(this.candidateBase(update), update);
    }

    /**
     * The base state the update is merged onto.
     * Default: clone of current attributes.
     * Override to reshape the base for state transitions (e.g. add/remove groups when a
     * discriminant flips in a union schema).
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected candidateBase(update: DeviceDataUpdate<TDeviceData>): TDeviceData {
        return structuredClone(this.data);
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    protected async doRefresh(): Promise<void> {
        // no-op
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    protected async doClose(): Promise<void>
    {
        // no-op
    }

    protected emit<K extends DeviceEvent>(eventName: K, ...args: DropFirst<DeviceEventMap<this, TNotifications>[K]>): boolean
    {
        return this.eventEmitter.emit(eventName, this, ...args);
    }

    /**
     * Update the attributes schema and recompile the validator.
     * Devices should call this instead of setting `attributesSchema` directly.
     */
    protected updateAttributesSchema(schema: TSchema): void {
        this.dataSchema = schema;
        this.validator = this.validatorFactory.create(schema);
    }

    protected updateLastRefresh(): void
    {
        this.lastRefresh = new Date();
        this.emit(DeviceEvent.deviceRefreshed);
    }

    /**
     * Apply the validated update to the device (ordered side-effects, protocol messages).
     * Called only after the merged candidate has passed schema validation.
     * Implementations should collect per-group errors rather than throwing.
     */
    protected abstract applyDeviceData(update: DeviceDataUpdate<TDeviceData>): Promise<DeviceDataApplyError[]>;

    private async performClose(): Promise<void>
    {
        try {
            await this.doClose();
        } finally {
            this.state = DeviceState.closed;
            this.emit(DeviceEvent.deviceDisconnected);
        }
    }

    /**
     * Generic recursive deep-merge: object keys are merged recursively,
     * scalars and arrays are replaced by the incoming value.
     */
    private static deepMerge(target: unknown, source: unknown): unknown {
        if (
            typeof target !== 'object' || target === null || Array.isArray(target)
            || typeof source !== 'object' || source === null || Array.isArray(source)
        ) {
            return source;
        }

        const result: Record<string, unknown> = { ...target };

        for (const [key, sourceVal] of Object.entries(source)) {
            if (sourceVal !== undefined) {
                result[key] = Device.deepMerge(result[key], sourceVal);
            }
        }

        return result;
    }
}
