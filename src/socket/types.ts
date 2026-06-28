import { Server } from 'socket.io';
import { DeviceData, DeviceNotification } from '../device/device.js';
import WebSocketEvent from '../device/webSocketEvent.js';
import SettingsEventType from '../settings/settingsEventType.js';
import AutomationEventType from '../automation/automationEventType.js';
import { SerializedHealthMetrics } from '../health/serializedTypes.js';
import { SerializedDevice } from '../device/serializedTypes.js';
import { SerializedSettings } from '../settings/serializedTypes.js';
import { DeviceId } from '../device/deviceId.js';

export type DeviceUpdateData = { deviceId: DeviceId, data: DeviceData }

export interface ClientToServerEvents {
    [WebSocketEvent.deviceUpdateReceived]: (data: DeviceUpdateData) => void;
}

export interface ServerToClientEvents {
    [WebSocketEvent.deviceConnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceDisconnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceRefreshed]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceNotification]: (device: SerializedDevice, notification: DeviceNotification) => void;
    [WebSocketEvent.healthMetrics]: (data: SerializedHealthMetrics) => void;
    [SettingsEventType.changed]: (data: SerializedSettings) => void;
    [AutomationEventType.consoleLog]: (data: string) => void;
}

export type WebsocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
