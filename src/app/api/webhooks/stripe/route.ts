import { NextRequest, NextResponse } from "next/server";
import { stripe, PLAN_DETAILS } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import Stripe from "stripe";
import {
  buildOrderNumber,
  getPackageItems,
  getPackageNameByPlanId,
  sendOrderConfirmationEmail,
  sendOrderReceiptEmail,
} from "@/lib/order-confirmation-email";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}, 10 * 60 * 1000);

function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId);
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now());
}

const SERVICE_PLAN_CATALOG: Record<string, { name: string; amountUsd: number }> = {
  plan299: { name: "Personal Agency Service", amountUsd: 29900 },
  plan466: { name: "Full Agency Service", amountUsd: 46600 },
  plan1599: { name: "Website Agency Service", amountUsd: 159900 },
  "personal-agent": { name: "Personal Agency Service", amountUsd: 29900 },
  "full-agent": { name: "Full Agency Service", amountUsd: 46600 },
  "website-agent": { name: "Website Agency Service", amountUsd: 159900 },
};

function parseClientReferenceId(clientReferenceId?: string | null) {
  if (!clientReferenceId) {
    return { userId: null as string | null, planHint: null as string | null };
  }
  const [userId, planHint] = clientReferenceId.split("::");
  if (planHint) {
    return { userId: userId || null, planHint: planHint || null };
  }
  return { userId: clientReferenceId, planHint: null as string | null };
}

function inferPlanByAmount(amountTotal?: number | null, currency?: string | null) {
  if (typeof amountTotal !== "number") {
    return { planId: null as string | null, planName: null as string | null };
  }
  if ((currency || "usd").toLowerCase() !== "usd") {
    return { planId: null as string | null, planName: null as string | null };
  }
  const found = Object.entries(SERVICE_PLAN_CATALOG).find(([, v]) => v.amountUsd === amountTotal);
  if (!found) {
    return { planId: null as string | null, planName: null as string | null };
  }
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
      console.warn(`[webhook] Failed to resolve receipt URL for session ${session.id}`, error);
    }
  }

  const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
      stripeInvoicePdfUrl = invoice.invoice_pdf ?? null;
    } catch (error) {
      console.warn(`[webhook] Failed to resolve invoice URLs for session ${session.id}`, error);
    }
  }

  return { stripeReceiptUrl, stripeInvoiceUrl, stripeInvoicePdfUrl };
}

async function resolveSessionPlanDetails(session: Stripe.Checkout.Session) {
  const clientRef = parseClientReferenceId(session.client_reference_id);
  let planId = session.metadata?.planId ?? clientRef.planHint ?? null;
  let planName =
    getPackageNameByPlanId(planId) ??
    (planId ? PLAN_DETAILS[planId]?.name ?? planId : null);
  let frequency = session.metadata?.frequency ?? null;

  try {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product"],
    });
    const first = expanded.line_items?.data?.[0];
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
  } catch (error) {
    console.warn(`[webhook] Failed to expand session ${session.id} for line items`, error);
  }

  if (!planId || !planName) {
    const inferred = inferPlanByAmount(session.amount_total, session.currency);
    if (!planId && inferred.planId) planId = inferred.planId;
    if (!planName && inferred.planName) planName = inferred.planName;
  }

  if (planId && !planName) {
    planName = getPackageNameByPlanId(planId) ?? planName;
  }

  return { planId, planName, frequency };
}

async function resolveUserIdForSession(session: Stripe.Checkout.Session) {
  const metadataUserId = session.metadata?.userId;
  if (metadataUserId) return metadataUserId;

  const clientRef = parseClientReferenceId(session.client_reference_id);
  if (clientRef.userId) return clientRef.userId;

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!email || !adminDb) return null;

  try {
    const match = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!match.empty) {
      return match.docs[0].id;
    }
  } catch (error) {
    console.warn("[webhook] Failed to lookup user by email", error);
  }

  return null;
}

async function upsertOrderFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (!adminDb || !session.id) return;

  const userId = await resolveUserIdForSession(session);
  if (!userId) {
    console.warn(`[webhook] Unable to resolve user for session ${session.id}`);
    return;
  }

  const { planId, planName, frequency } = await resolveSessionPlanDetails(session);
  const createdAtMs = (session.created ?? Math.floor(Date.now() / 1000)) * 1000;
  const billingLinks = await getStripeBillingLinks(session);
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const orderNumber = buildOrderNumber(session.id, createdAtMs);

  await adminDb.collection("orders").doc(session.id).set(
    {
      orderId: session.id,
      orderNumber,
      userId,
      userEmail: session.customer_details?.email ?? session.customer_email ?? null,
      planId,
      planName,
      frequency,
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
}

async function sendOrderEmailIfNeeded(session: Stripe.Checkout.Session) {
  if (!adminDb || !session.id) return;
  if (session.payment_status !== "paid") return;

  const orderRef = adminDb.collection("orders").doc(session.id);
  const orderSnap = await orderRef.get();
  const orderData = orderSnap.data() as Record<string, any> | undefined;

  const resolved = await resolveSessionPlanDetails(session);
  const planId = (resolved.planId ?? orderData?.planId ?? null) as string | null;
  const planName =
    (orderData?.planName as string | undefined) ??
    resolved.planName ??
    getPackageNameByPlanId(planId) ??
    (planId ? PLAN_DETAILS[planId]?.name ?? planId : "Service Package");

  const createdAtMs =
    (orderData?.createdAtMs as number | undefined) ??
    ((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const billingLinks = await getStripeBillingLinks(session);
  const orderNumber =
    (orderData?.orderNumber as string | undefined) ?? buildOrderNumber(session.id, createdAtMs);
  const toEmail =
    (session.customer_details?.email as string | undefined) ??
    (session.customer_email as string | undefined) ??
    (orderData?.userEmail as string | undefined);
  if (!toEmail) return;

  const userId = await resolveUserIdForSession(session);
  let customerName =
    (session.customer_details?.name as string | undefined) ||
    (orderData?.customerName as string | undefined) ||
    "";

  if (!customerName && userId) {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data() as Record<string, any>;
      customerName =
        (userData.displayName as string | undefined) ||
        (userData.firstName as string | undefined) ||
        "";
    }
  }
  if (!customerName) customerName = toEmail.split("@")[0] || "Customer";

  const stripeReceiptUrl =
    billingLinks.stripeReceiptUrl ?? (orderData?.stripeReceiptUrl as string | undefined) ?? null;
  const stripeInvoiceUrl =
    billingLinks.stripeInvoiceUrl ?? (orderData?.stripeInvoiceUrl as string | undefined) ?? null;
  const stripeInvoicePdfUrl =
    billingLinks.stripeInvoicePdfUrl ?? (orderData?.stripeInvoicePdfUrl as string | undefined) ?? null;

  if (!orderData?.confirmationEmailSentAt) {
    const sendResult = await sendOrderConfirmationEmail({
      toEmail,
      customerName,
      orderNumber,
      orderDate: new Date(createdAtMs),
      planName,
      includedItems: getPackageItems(planId),
      amountTotal: session.amount_total,
      currency: session.currency,
      stripeReceiptUrl,
      stripeInvoiceUrl,
      stripeInvoicePdfUrl,
    });

    if (sendResult.success) {
      await orderRef.set(
        {
          orderNumber,
          customerName,
          confirmationEmailSentAt: new Date().toISOString(),
          confirmationEmailMessageId: sendResult.messageId ?? null,
          stripeReceiptUrl: stripeReceiptUrl ?? null,
          stripeInvoiceUrl: stripeInvoiceUrl ?? null,
          stripeInvoicePdfUrl: stripeInvoicePdfUrl ?? null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  }

  if (!orderData?.receiptEmailSentAt && (stripeReceiptUrl || stripeInvoiceUrl || stripeInvoicePdfUrl)) {
    const receiptSendResult = await sendOrderReceiptEmail({
      toEmail,
      customerName,
      orderNumber,
      orderDate: new Date(createdAtMs),
      planName,
      amountTotal: session.amount_total,
      currency: session.currency,
      stripeReceiptUrl,
      stripeInvoiceUrl,
      stripeInvoicePdfUrl,
    });

    if (receiptSendResult.success) {
      await orderRef.set(
        {
          receiptEmailSentAt: new Date().toISOString(),
          receiptEmailMessageId: receiptSendResult.messageId ?? null,
          stripeReceiptUrl: stripeReceiptUrl ?? null,
          stripeInvoiceUrl: stripeInvoiceUrl ?? null,
          stripeInvoicePdfUrl: stripeInvoicePdfUrl ?? null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    if (isEventProcessed(event.id)) {
      return NextResponse.json({ received: true, message: "Event already processed" });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = await resolveUserIdForSession(session);
        const resolved = await resolveSessionPlanDetails(session);
        const planId = resolved.planId;

        if (userId && planId && adminDb) {
          await adminDb.collection("users").doc(userId).set(
            {
              plan: planId,
              subscriptionId: session.subscription,
              customerId: session.customer,
              planUpdatedAt: new Date().toISOString(),
              lastWebhookEventId: event.id,
            },
            { merge: true }
          );
        }
        await upsertOrderFromCheckoutSession(session);
        await sendOrderEmailIfNeeded(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId && adminDb) {
          await adminDb.collection("users").doc(userId).set(
            {
              subscriptionStatus: subscription.status,
              subscriptionUpdatedAt: new Date().toISOString(),
              lastWebhookEventId: event.id,
            },
            { merge: true }
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId && adminDb) {
          await adminDb.collection("users").doc(userId).set(
            {
              plan: "free",
              subscriptionId: null,
              subscriptionStatus: "canceled",
              planUpdatedAt: new Date().toISOString(),
              lastWebhookEventId: event.id,
            },
            { merge: true }
          );
        }
        break;
      }

      default:
        break;
    }

    markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
