import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { stripe, PLAN_DETAILS } from "@/lib/stripe";
import { buildOrderNumber, getPackageNameByPlanId } from "@/lib/order-confirmation-email";
import Stripe from "stripe";

const SERVICE_PLAN_CATALOG: Record<string, { name: string; amountUsd: number }> = {
  plan4999: { name: "Consulting Service", amountUsd: 4999 },
  plan299: { name: "Personal Agency Service", amountUsd: 29900 },
  plan466: { name: "Full Agency Service", amountUsd: 46600 },
  plan1599: { name: "Website Agency Service", amountUsd: 159900 },
  "consult-service": { name: "Consulting Service", amountUsd: 4999 },
  "personal-agent": { name: "Personal Agency Service", amountUsd: 29900 },
  "full-agent": { name: "Full Agency Service", amountUsd: 46600 },
  "website-agent": { name: "Website Agency Service", amountUsd: 159900 },
};

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function parseClientReferenceId(clientReferenceId?: string | null) {
  if (!clientReferenceId) return { userId: null as string | null, planHint: null as string | null };
  const [userId, planHint] = clientReferenceId.split("::");
  if (planHint) return { userId: userId || null, planHint: planHint || null };
  return { userId: clientReferenceId, planHint: null as string | null };
}

function inferPlanByAmount(amountTotal?: number | null, currency?: string | null) {
  if (typeof amountTotal !== "number") return { planId: null as string | null, planName: null as string | null };
  if ((currency || "usd").toLowerCase() !== "usd") return { planId: null as string | null, planName: null as string | null };
  const found = Object.entries(SERVICE_PLAN_CATALOG).find(([, value]) => value.amountUsd === amountTotal);
  if (!found) return { planId: null as string | null, planName: null as string | null };
  return { planId: found[0], planName: found[1].name };
}

async function getStripeBillingLinks(session: Stripe.Checkout.Session) {
  let stripeReceiptUrl: string | null = null;
  let stripeInvoiceUrl: string | null = null;
  let stripeInvoicePdfUrl: string | null = null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const latestCharge = paymentIntent.latest_charge;
      if (latestCharge && typeof latestCharge !== "string") {
        stripeReceiptUrl = latestCharge.receipt_url ?? null;
      }
    } catch (error) {
      console.warn(`[orders-sync] Failed to resolve receipt URL for session ${session.id}`, error);
    }
  }

  const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
      stripeInvoicePdfUrl = invoice.invoice_pdf ?? null;
    } catch (error) {
      console.warn(`[orders-sync] Failed to resolve invoice URLs for session ${session.id}`, error);
    }
  }

  return { stripeReceiptUrl, stripeInvoiceUrl, stripeInvoicePdfUrl };
}

export async function POST(request: NextRequest) {
  try {
    const { response: authError, user } = await requireAuth(request);
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Order service unavailable" }, { status: 503 });

    const normalizedEmail = normalizeEmail(user.email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "User email is required for sync" }, { status: 400 });
    }

    const db = adminDb;
    let backfilledOwnership = 0;
    let upsertedOrders = 0;

    const mergeOwnership = async (snapshot: FirebaseFirestore.QuerySnapshot) => {
      if (snapshot.empty) return;
      const batch = db.batch();
      snapshot.docs.forEach((orderDoc) => {
        const data = orderDoc.data() as Record<string, any>;
        if (data.userId === user.uid) return;
        batch.set(
          orderDoc.ref,
          {
            userId: user.uid,
            userEmailLower: normalizedEmail,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        backfilledOwnership += 1;
      });
      if (backfilledOwnership > 0) {
        await batch.commit();
      }
    };

    await mergeOwnership(await db.collection("orders").where("userEmailLower", "==", normalizedEmail).get());
    await mergeOwnership(await db.collection("orders").where("userEmail", "==", user.email || "").get());

    const listed = await stripe.checkout.sessions.list({ limit: 100 });
    const paidByEmail = listed.data.filter((session) => {
      if (session.payment_status !== "paid") return false;
      const sessionEmail = normalizeEmail(session.customer_details?.email ?? session.customer_email ?? null);
      return sessionEmail === normalizedEmail;
    });

    for (const rawSession of paidByEmail) {
      const session = await stripe.checkout.sessions.retrieve(rawSession.id, {
        expand: ["line_items.data.price.product"],
      });

      const clientRef = parseClientReferenceId(session.client_reference_id);
      let planId = session.metadata?.planId ?? clientRef.planHint ?? null;
      let planName =
        getPackageNameByPlanId(planId) ??
        (planId ? PLAN_DETAILS[planId]?.name ?? planId : null);
      let frequency = session.metadata?.frequency ?? null;

      const first = session.line_items?.data?.[0];
      const product = first?.price?.product;
      const productName =
        typeof product === "string"
          ? null
          : product && "name" in product
            ? (product.name as string)
            : null;
      if (!planName && productName) {
        planName = productName;
      }
      const interval = first?.price?.recurring?.interval;
      if (!frequency && interval) {
        frequency = interval === "year" ? "yearly" : interval === "month" ? "monthly" : interval;
      }

      if (!planId || !planName) {
        const inferred = inferPlanByAmount(session.amount_total, session.currency);
        if (!planId && inferred.planId) planId = inferred.planId;
        if (!planName && inferred.planName) planName = inferred.planName;
      }

      const createdAtMs = (session.created ?? Math.floor(Date.now() / 1000)) * 1000;
      const billingLinks = await getStripeBillingLinks(session);
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const checkoutEmail = session.customer_details?.email ?? session.customer_email ?? user.email ?? null;

      await db.collection("orders").doc(session.id).set(
        {
          orderId: session.id,
          orderNumber: buildOrderNumber(session.id, createdAtMs),
          userId: user.uid,
          userEmail: checkoutEmail,
          userEmailLower: normalizedEmail,
          planId: planId ?? null,
          planName: planName ?? planId ?? null,
          frequency: frequency ?? null,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          paymentStatus: session.payment_status ?? null,
          status: session.payment_status === "paid" ? "paid" : session.status ?? "pending",
          stripeSessionId: session.id,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          createdAt: new Date(createdAtMs).toISOString(),
          createdAtMs,
          stripeReceiptUrl: billingLinks.stripeReceiptUrl,
          stripeInvoiceUrl: billingLinks.stripeInvoiceUrl,
          stripeInvoicePdfUrl: billingLinks.stripeInvoicePdfUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      upsertedOrders += 1;
    }

    return NextResponse.json({
      success: true,
      syncedFromStripe: upsertedOrders,
      ownershipBackfilled: backfilledOwnership,
    });
  } catch (error: any) {
    console.error("Sync orders error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync orders" },
      { status: 500 }
    );
  }
}

