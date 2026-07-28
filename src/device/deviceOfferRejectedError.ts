/**
 * Marks a device offer rejection as a manager-level decision (queue unavailable, device
 * disabled, claimed by another provider, revoked, reset) as opposed to the offer itself failing
 * (thrown error or `undefined` returned). `DeviceProvider` uses this to decide whether
 * `onConnectFailed()` should run - it shouldn't for manager-level decisions, only for the
 * provider's own failed attempt.
 */
export default class DeviceOfferRejectedError extends Error {}
