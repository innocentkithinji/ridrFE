// How the app writes values with their Unit. A Unit is a UCUM code, as
// Ridr returns it; "" means unitless.

const valueFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

// unitLabel shows a UCUM code the way people write it.
export function unitLabel(unit: string): string {
  return { Cel: "°C", "[degF]": "°F", "[kn_i]": "kn", "[mi_i]/h": "mph", "km/h": "km/h" }[unit] ?? unit;
}

// withUnit writes a value and its Unit, as in "4.5 °C".
export function withUnit(value: number, unit: string): string {
  const shown = valueFormat.format(value);
  return unit ? `${shown} ${unitLabel(unit)}` : shown;
}
