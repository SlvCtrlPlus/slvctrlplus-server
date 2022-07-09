import Device from "../../device/device.js";

export default interface RuleManagerInterface
{
    applyRules(device: Device): void;
}
