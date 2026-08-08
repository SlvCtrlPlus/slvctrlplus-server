import type { Server } from 'socket.io';
import type { DeviceData, AnyDeviceNotification } from '../device/device.js';
import type WebSocketEvent from '../device/webSocketEvent.js';
import type SettingsEventType from '../settings/settingsEventType.js';
import type AutomationEventType from '../automation/automationEventType.js';
import type { SerializedHealthMetrics } from '../health/serializedTypes.js';
import type { SerializedDevice } from '../device/serializedTypes.js';
import type { SerializedSettings } from '../settings/serializedTypes.js';
import type { DeviceId } from '../device/deviceId.js';

export type DeviceUpdateData = { deviceId: DeviceId, data: DeviceData };

export type ClientToServerEvents = {
    [WebSocketEvent.deviceUpdateReceived]: (data: DeviceUpdateData) => void;
};

export type ServerToClientEvents = {
    [WebSocketEvent.deviceConnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceDisconnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceRefreshed]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceNotification]: (device: SerializedDevice, notification: AnyDeviceNotification) => void;
    [WebSocketEvent.healthMetrics]: (data: SerializedHealthMetrics) => void;
    [SettingsEventType.changed]: (data: SerializedSettings) => void;
    [AutomationEventType.consoleLog]: (data: string) => void;
};

export type WebsocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
