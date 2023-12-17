import ConnectedDeviceRepository from "../../../src/repository/connectedDeviceRepository.js";
import { mock } from "jest-mock-extended";
import DeviceManager from "../../../src/device/deviceManager.js";

describe('connectedDeviceRepository', () => {
    it('returns all devices from device manager', async () => {
        const deviceManager = mock<DeviceManager>();
        deviceManager.getConnectedDevices.calledWith().mockReturnValue([]);

        const deviceRepository = new ConnectedDeviceRepository(deviceManager);

        expect(deviceRepository.getAll().length).toBe(0);
        expect(deviceManager.getConnectedDevices).toHaveBeenCalledTimes(1);
    });
});
