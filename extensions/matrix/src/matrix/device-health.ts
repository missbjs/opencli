export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleOpenCLIDevices: MatrixManagedDeviceInfo[];
  currentOpenCLIDevices: MatrixManagedDeviceInfo[];
};

const OPENCLI_DEVICE_NAME_PREFIX = "OpenCLI ";

export function isOpenCLIManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(OPENCLI_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const openClawDevices = devices.filter((device) =>
    isOpenCLIManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleOpenCLIDevices: openClawDevices.filter((device) => !device.current),
    currentOpenCLIDevices: openClawDevices.filter((device) => device.current),
  };
}
