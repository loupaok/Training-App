export function formatPrice(plan: { price?: number | null; currency?: string | null }): string {
  const price = plan.price ?? 0;
  try {
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: plan.currency || "EUR",
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price}€`;
  }
}
