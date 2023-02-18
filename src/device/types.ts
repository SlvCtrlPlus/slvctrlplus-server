import Et312DeviceData from "./et312/et312DeviceData";
import StrikerMk2DeviceData from "./strikerMk2/strikerMk2DeviceData";
import AirValveDeviceData from "./airValve/airValveDeviceData";
import GenericDeviceAttribute from "./generic/genericDeviceAttribute";

export type DeviceData = Et312DeviceData | StrikerMk2DeviceData | AirValveDeviceData | JsonObject;

export type GenericDeviceAttributeList = { [key: string]: GenericDeviceAttribute };
