function authHeader() {
  return `Basic ${Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString('base64')}`;
}

export async function wcRequest(method, endpoint, data) {
  const WC_URL = process.env.WC_URL;
  if (!WC_URL || !process.env.WC_CONSUMER_KEY || !process.env.WC_CONSUMER_SECRET) {
    throw new Error('WooCommerce is not configured (WC_URL/WC_CONSUMER_KEY/WC_CONSUMER_SECRET missing).');
  }
  const response = await fetch(`${WC_URL}/wp-json/wc/v3${endpoint}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || `WooCommerce request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function createCoupon({ code, amount, clientEmail, expiryDays = 30 }) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  return wcRequest('POST', '/coupons', {
    code,
    discount_type: 'fixed_cart',
    amount: amount.toString(),
    individual_use: true,
    usage_limit: 1,
    usage_limit_per_user: 1,
    date_expires: expiryDate.toISOString().split('T')[0],
    email_restrictions: [clientEmail],
    description: `CoachApp Points Reward for ${clientEmail}`,
  });
}
