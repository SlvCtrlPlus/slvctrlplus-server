# SlvCtrl+ Server

A local device control hub that connects to hardware over serial and BLE, exposes devices via a REST and WebSocket API, and lets automation scripts react to device events.

## Language

### Actors

**Operator**:
The person who owns the hardware and runs the server.
_Avoid_: user, admin

**Client**:
Any consumer of the server API — typically a frontend UI.
_Avoid_: consumer, app, user

### Device Layer

**Device**:
A connected hardware or virtual unit managed by the server.
_Avoid_: hardware (virtual devices exist too)

**Transport**:
The physical or logical channel over which raw bytes are exchanged with a Device. Two concrete transports exist: serial port and BLE UART. BLE Transports support transparent auto-reconnect at the peripheral level; serial Transports do not (a lost serial port means the Device is gone).
_Avoid_: connection, channel

**Protocol**:
The message structure and encoding used to communicate with a Device over a Transport (e.g. slvctrlplus, zc95, estim2b, buttplug, airotic).
_Avoid_: driver, format

**Virtual Device**:
A software-only Device with no physical hardware counterpart that implements device-shaped logic (e.g. random number generator, text-to-speech).
_Avoid_: simulated device, fake device

**Device Attribute**:
A named, typed value representing one observable or controllable property of a Device, with a read/write modifier (`ro`, `rw`, `wo`).
_Avoid_: property, field, channel

### Device Lifecycle

**Device Manager**:
The central registry of connected Devices. It owns the device lifecycle and emits lifecycle events (detected, claimed, connected, disconnected).
_Avoid_: registry, hub, event bus

**Device Provider**:
A protocol-specific component that recognises detected hardware it understands, claims it, and creates the corresponding Device. A Device Provider handles exactly one transport type (serial or BLE); it ignores detections from the other transport.
_Avoid_: factory, driver

**Observer**:
A transport-specific component that continuously scans for hardware and announces newly detected devices to the Device Manager. Two concrete observers exist: Serial Port Observer (polls every 3 s) and BLE Observer (scans continuously for BLE UART peripherals).
_Avoid_: scanner, listener, watcher

### Automation

**Automation Script**:
A user-defined program definition that can be started and stopped explicitly via the API.
_Avoid_: script, job, task

**Script Runtime**:
The active execution context of a running Automation Script. While running, it reacts to Device lifecycle events and can read and write Device Attributes.
_Avoid_: instance, process, execution

## Relationships

- A **Device** has exactly one **Transport** and exactly one **Protocol**; the **Device** owns its **Transport**'s lifecycle
- A **Device** exposes one or more **Device Attributes**
- A **Device Provider** is responsible for exactly one **Protocol** and exactly one transport type
- An **Observer** is responsible for exactly one transport type and announces detected hardware to the **Device Manager**
- The **Device Manager** tracks all connected **Devices** and emits lifecycle events
- An **Automation Script** has at most one active **Script Runtime** at a time
- A **Script Runtime** subscribes to **Device Manager** lifecycle events

## API boundary

- REST is used by the **Client** to build initial state and perform control operations (update settings, start/stop **Script Runtimes**).
- WebSocket streams real-time **Device Attribute** updates and **Device** lifecycle events to the **Client**, and is used to write **Device Attributes**.

## Example dialogue

> **Dev:** "When a device is plugged in, who creates it?"
> **Domain expert:** "The **Device Manager** announces a detected device. Each **Device Provider** that understands the hardware can try to claim it — first one wins. The claiming **Device Provider** then creates the **Device** and registers it with the **Device Manager**."

> **Dev:** "Can an **Automation Script** start itself when a device connects?"
> **Domain expert:** "No — an **Automation Script** must be explicitly started by the **Operator** via the API. Once its **Script Runtime** is active, it can react to device connect and disconnect events."

## Flagged ambiguities

- "script" was used loosely to mean both the definition and the running instance — resolved: **Automation Script** (definition) vs **Script Runtime** (active execution).
- "connection" was used to mean both the physical channel and the protocol handshake — resolved: **Transport** (channel) vs the Device Provider's connect flow (handshake).
