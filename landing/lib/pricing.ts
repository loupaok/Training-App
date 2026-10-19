export type PricingPlanFeature = { text: string; included: boolean };

export type PricingPlan = {
  id: number;
  slug: string;
  name: string;
  badge: string;
  description: string;
  price: number;
  currency: string;
  period: string;
  themeColor: string;
  features: PricingPlanFeature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  pointsReward: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/pricing-plans`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const plans: PricingPlan[] = await res.json();
    return plans.filter((plan) => plan.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    console.error("Failed to fetch pricing plans from main app:", error);
    return [];
  }
}

export function formatPrice(plan: Pick<PricingPlan, "price" | "currency">): string {
  try {
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: plan.currency || "EUR",
      minimumFractionDigits: Number.isInteger(plan.price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(plan.price);
  } catch {
    return `${plan.price}€`;
  }
}
