import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const SERVICE_PLANS: Record<
  string,
  {
    name: string;
    description: string;
    unitAmount: number;
    currency: "usd";
  }
> = {
  plan299: {
    name: "Personal Agency Service",
    description: "Personal ITIN support and 1-on-1 onboarding guidance.",
    unitAmount: 29900,
    currency: "usd",
  },
  plan466: {
    name: "Full Agency Service",
    description: "ITIN, company registration, Stripe onboarding, and compliance consulting.",
    unitAmount: 46600,
    currency: "usd",
  },
  plan1599: {
    name: "Website Agency Service",
    description: "Includes Full Agency plus website setup and e-commerce onboarding support.",
    unitAmount: 159900,
    currency: "usd",
  },
  plan4999: {
    name: "Consulting Service",
    description: "30-minute business consultation with actionable next-step guidance.",
    unitAmount: 4999,
    currency: "usd",
  },
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = withRateLimit(request, RATE_LIMITS.checkout);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const planId = typeof body?.planId === "string" ? body.planId : "";
    const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail.trim() : "";
    const plan = SERVICE_PLANS[planId];

    if (!plan) {
      return NextResponse.json({ error: "Invalid service plan" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json({ error: "Invalid customer email" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9002";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.unitAmount,
          },
          quantity: 1,
        },
      ],
      invoice_creation: {
        enabled: true,
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
      customer_email: customerEmail,
      metadata: {
        planId,
        frequency: "one_time",
        checkoutSource: "public_homepage",
      },
      payment_intent_data: {
        metadata: {
          planId,
          checkoutSource: "public_homepage",
          customerEmail,
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error("Public service checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
