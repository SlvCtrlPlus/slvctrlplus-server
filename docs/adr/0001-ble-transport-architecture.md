# ADR 0001 — BLE Transport Architecture

**Status**: Accepted  
**Date**: 2026-05-09

## Context

Adding BLE support introduced several design decisions that affect how BLE and serial transports coexist in the device layer.

## Decisions

### 1. Device owns its Transport lifecycle

**Decision**: A `BleDevice` holds a reference to its `BleUartDeviceTransport` and closes it in `doClose()`, mirroring how `PeripheralDevice` closes its serial transport. The provider does not manage transport cleanup via event listeners.

**Alternatives considered**: Have the `BleDeviceProvider` listen for `DeviceEvent.deviceDisconnected` and close the transport there. This was the initial implementation but creates an implicit contract: if the device is ever closed without the provider's listener being registered, the transport leaks.

**Why**: Ownership of the transport belongs to the device, not to the provider. The type system can enforce this; event listeners cannot.

---

### 2. `DeviceInfo` uses a discriminant union, not structural duck typing

**Decision**: `DeviceInfo` is a tagged union `{ type: 'ble'; ... } | { type: 'serial'; ... }`. Providers filter on `deviceInfo.type`, not on presence of fields like `'peripheral' in deviceInfo`.

**Alternatives considered**: Keep the structural extension pattern (`BleDeviceInfo extends DeviceInfo`). This works but TypeScript cannot enforce that a provider has narrowed the type before accessing transport-specific fields, so a provider that forgets to filter silently receives wrong-transport detections.

**Why**: The discriminant makes wrong-transport handling a compile error, not a runtime bug. Every provider is forced to handle the union explicitly.

---

### 3. `BleDeviceProvider` abstract base class

**Decision**: Introduce `BleDeviceProvider` as an abstract base class analogous to `SerialDeviceProvider`. It handles: the `deviceDetected` listener, the `type === 'ble'` guard, the acquire → transport → `addDevice` → claim flow, and peripheral disconnect-on-failure cleanup. Concrete BLE protocol providers implement a single abstract method (e.g. `connectBleDevice`).

**Alternatives considered**: Leave `AiroticDeviceProvider` standalone. Acceptable for a single BLE protocol, but since more BLE protocols are planned, the acquire/transport/claim plumbing would be duplicated in each one.

**Why**: The pattern is already proven by `SerialDeviceProvider`. Extracting it now costs little and prevents duplication as BLE protocols accumulate.

---

### 4. BLE reconnect hides from the Operator; state is reconciled on reconnect, not buffered in order

**Decision**: A BLE Device must appear continuously connected during a peripheral-level reconnect. No `deviceDisconnected` / `deviceConnected` lifecycle events are emitted during a reconnect attempt — only when reconnect finally fails. After a successful reconnect, `BleDevice` calls an abstract `syncState()` method that the concrete device implements. `syncState()` re-sends the current value of every `rw` Device Attribute to the hardware. `wo` attributes (one-shot triggers such as `reboot`) are never replayed.

**Alternatives considered**: Buffer raw bytes in `BleUartDeviceTransport` and replay them in order after reconnect. Rejected because replaying a sequence of commands into a freshly-reconnected device that may not be in the assumed prior state is fragile, and `MessageResponseHandler` would receive stale or mismatched responses.

**Why**: For attribute-style control, intermediate states are not meaningful — only the final desired state matters. Reconciling by replaying the current attribute values is safe, idempotent, and correct even if multiple writes happened during the disconnect window.
