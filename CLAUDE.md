# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (watch mode with auto-restart)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run tests/unit/controller/getDevicesController.spec.ts

# Test coverage
npm run coverage

# Lint
npm run lint

# Type check
npm run typecheck
```

The server runs on `http://localhost:1337` by default (configurable via `PORT` env var).

## Architecture

**SlvCtrl+ Server** is a device control server that manages connected hardware devices (serial, BLE, virtual) and exposes a REST + WebSocket API for controlling them and running automation scripts.

### Dependency Injection

The app uses [Pimple](https://github.com/timesplinter/pimple) for DI. All services are registered in `src/serviceMap.ts` (the type map) and in service providers under `src/serviceProvider/`. The container is assembled and started in `src/index.ts`.

### Device Layer (`src/device/`)

Devices are the core abstraction. Each device has:
- A **transport** (how data is sent/received): `serial/` or `ble/`
- A **protocol** (how messages are structured): `slvctrlplus/`, `buttplug/`, `zc95/`, `estim2b/`, `airotic/`, `virtual/`

**Device lifecycle**:
1. A transport observer (`SerialPortObserver`, `BleObserver`) detects hardware
2. Protocol-specific device factories (`IDeviceProvider`) create the right device instance
3. `DeviceManager` tracks all connected devices and emits events (`DeviceManagerEvent`)
4. Events trigger WebSocket broadcasts and automation scripts

The `Device` base class (`src/device/device.ts`) defines the common interface. Each protocol subdirectory contains its own device class, attribute definitions, and connection logic.

### API Layer (`src/controller/`)

Express v5 REST controllers handle device operations (`GET /devices`, `PATCH /device/:id`), automation (`POST /automation/script/:id/run`), and settings. Socket.IO (`src/socket/`) streams real-time events to clients.

### Automation Engine (`src/automation/`)

Scripts run in a sandboxed `vm2` environment (`scriptRuntime.ts`). They can be triggered by device events (connect/disconnect/refresh) or called via API. Console output is streamed via WebSocket.

### Serialization (`src/serialization/`)

Uses `class-transformer` with `@Expose`/`@Exclude` decorators. Polymorphic device types use a discriminator field for correct deserialization. Validators use `ajv` JSON Schema.

## Environment Variables

Copy `.env.example` to `.env`:
- `PORT` – server port (default: `1337`)
- `LOG_LEVEL` – pino log level (default: `debug`)
- `ALLOWED_ORIGINS` – comma-separated CORS origins
- `APP_VERSION` – version string (default: `dev`)

## Testing

Tests live in `tests/unit/` and use Vitest with `vitest-mock-extended` for mocking. The setup file is `tests/vitest.setup.ts`. CI runs tests on Node 20, 22, and 24 across Linux/macOS/Windows.
