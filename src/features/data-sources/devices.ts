// Device IDs typed as a list, one per line or separated by commas or
// spaces. An empty list means every Device.
export function parseDeviceIds(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))];
}
