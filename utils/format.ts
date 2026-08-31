export function formatCurrency(value: number | null | undefined, currency: string = "BDT") {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (currency === "BDT" || !currency) {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(numericValue));
    return numericValue < 0 ? `-৳${formatted}` : `৳${formatted}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(numericValue);
}
