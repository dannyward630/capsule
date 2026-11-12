/**
 * Money and units.
 *
 * One implementation of dollars-to-base-units, used by the pricing path, the
 * proof path and the claims generator. It works on the decimal string, never on
 * a float, so no rounding error can reach a settlement amount.
 */

/** The base units of a dollar amount, for an asset with `decimals`. */
export function toBaseUnits(dollars: string, decimals: number): string {
  const text = dollars.trim().replace(/^\$/, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`"${dollars}" is not a positive decimal amount`);
  }
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `${text} has more than ${decimals} decimals, which this asset cannot hold`,
    );
  }
  return BigInt(whole + fraction.padEnd(decimals, "0")).toString();
}

/** The base units as a number. For display and arithmetic only. */
export function toBaseUnitsNumber(dollars: string, decimals: number): number {
  return Number(toBaseUnits(dollars, decimals));
}

/** A decimal string from base units. */
export function fromBaseUnits(units: string | bigint, decimals: number): string {
  const value = BigInt(units).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return value;
  const whole = value.slice(0, value.length - decimals);
  const fraction = value.slice(value.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Two decimal amounts, added exactly. */
export function addDollars(a: string, b: string): string {
  const [aw = "0", af = ""] = a.trim().replace(/^\$/, "").split(".");
  const [bw = "0", bf = ""] = b.trim().replace(/^\$/, "").split(".");
  const width = Math.max(af.length, bf.length);
  const units =
    BigInt(aw + af.padEnd(width, "0")) + BigInt(bw + bf.padEnd(width, "0"));
  const whole = units.toString().padStart(width + 1, "0");
  return fromBaseUnits(whole, width);
}
