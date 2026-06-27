import { Server } from 'socket.io';
import { DeviceData } from '../device/device.js';
import WebSocketEvent from '../device/webSocketEvent.js';
import SettingsEventType from '../settings/settingsEventType.js';
import AutomationEventType from '../automation/automationEventType.js';
import { SerializedHealthMetrics } from '../health/serializedTypes.js';
import { SerializedDevice } from '../device/serializedTypes.js';
import { SerializedSettings } from '../settings/serializedTypes.js';

export type DeviceUpdateData = { deviceId: string, data: DeviceData }

export interface ClientToServerEvents {
    [WebSocketEvent.deviceUpdateReceived]: (data: DeviceUpdateData) => void;
}

export interface ServerToClientEvents {
    [WebSocketEvent.deviceConnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceDisconnected]: (data: SerializedDevice) => void;
    [WebSocketEvent.deviceRefreshed]: (data: SerializedDevice) => void;
    [WebSocketEvent.healthMetrics]: (data: SerializedHealthMetrics) => void;
    [SettingsEventType.changed]: (data: SerializedSettings) => void;
    [AutomationEventType.consoleLog]: (data: string) => void;
}

export type WebsocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
