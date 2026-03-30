import { NextRequest, NextResponse } from "next/server";
import { stripe, PLAN_DETAILS } from "@/lib/stripe";
import { verifyAuthToken } from "@/lib/api-auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  buildOrderNumber,
  getPackageItems,
  getPackageNameByPlanId,
  sendOrderConfirmationEmail,
  sendOrderReceiptEmail,
} from "@/lib/order-confirmation-email";

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

function parseClientReferenceId(clientReferenceId?: string | null) {
  if (!clientReferenceId) return { userId: null as string | null, planHint: null as string | null };
  const [userId, planHint] = clientReferenceId.split("::");
  if (planHint) return { userId: userId || null, planHint: planHint || null };
  return { userId: clientReferenceId, planHint: null as string | null };
}

function inferPlanByAmount(amountTotal?: number | null, currency?: string | null) {
  if (typeof amountTotal !== "number") return { planId: null as string | null, planName: null as string | null };
  if ((currency || "usd").toLowerCase() !== "usd") return { planId: null as string | null, planName: null as string | null };
  const found = Object.entries(SERVICE_PLAN_CATALOG).find(([, v]) => v.amountUsd === amountTotal);
  if (!found) return { planId: null as string | null, planName: null as string | null };
  return { planId: found[0], planName: found[1].name };
}

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

async function resolveUserIdByEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  if (adminAuth) {
    try {
      const authUser = await adminAuth.getUserByEmail(normalized);
      if (authUser?.uid) return authUser.uid;
    } catch {
      // continue Firestore fallback
    }
  }

  if (!adminDb) return null;
  try {
    const exact = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!exact.empty) return exact.docs[0].id;
    const normalizedMatch = await adminDb
      .collection("users")
      .where("email", "==", normalized)
      .limit(1)
      .get();
    if (!normalizedMatch.empty) return normalizedMatch.docs[0].id;
  } catch (error) {
    console.warn("[checkout-verify] Failed to resolve user by email", error);
  }

  return null;
}

async function getStripeBillingLinks(session: any) {
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
      console.warn(`[checkout-verify] Failed to resolve receipt URL for session ${session.id}`, error);
    }
  }

  const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
      stripeInvoicePdfUrl = invoice.invoice_pdf ?? null;
    } catch (error) {
      console.warn(`[checkout-verify] Failed to resolve invoice URLs for session ${session.id}`, error);
    }
  }

  return { stripeReceiptUrl, stripeInvoiceUrl, stripeInvoicePdfUrl };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuthToken(request);
    const authUser = authResult.authenticated ? authResult.user : undefined;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id parameter" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const clientRef = parseClientReferenceId(session.client_reference_id);
    const sessionUserId = session.metadata?.userId ?? clientRef.userId ?? null;
    const isPublicCheckout = session.metadata?.checkoutSource === "public_homepage";

    if (sessionUserId) {
      if (!authUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (sessionUserId !== authUser.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isPublicCheckout) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const firstLineItem = session.line_items?.data?.[0];
    const interval = firstLineItem?.price?.recurring?.interval;
    const product = firstLineItem?.price?.product;
    const productName =
      typeof product === "string"
        ? null
        : product && "name" in product
          ? (product.name as string)
          : null;

    let planId = session.metadata?.planId ?? clientRef.planHint ?? null;
    let planName =
      getPackageNameByPlanId(planId) ??
      (planId ? PLAN_DETAILS[planId]?.name ?? planId : null) ??
      productName;
    let frequency =
      session.metadata?.frequency ??
      (interval === "year" ? "yearly" : interval === "month" ? "monthly" : interval ?? null);

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
    const orderNumber = buildOrderNumber(session.id, createdAtMs);
    const effectiveUserEmail =
      session.customer_details?.email ?? session.customer_email ?? authUser?.email ?? null;
    const resolvedUserByEmail = await resolveUserIdByEmail(effectiveUserEmail);
    const effectiveUserId = sessionUserId ?? authUser?.uid ?? resolvedUserByEmail ?? null;
    const effectiveUserEmailLower = normalizeEmail(effectiveUserEmail);

    if (effectiveUserId && planId && adminDb) {
      await adminDb.collection("users").doc(effectiveUserId).set(
        {
          emailLower: effectiveUserEmailLower || null,
          plan: planId,
          subscriptionId,
          customerId,
          planUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    if (adminDb) {
      await adminDb.collection("orders").doc(session.id).set(
        {
          orderId: session.id,
          orderNumber,
          userId: effectiveUserId,
          userEmail: effectiveUserEmail,
          userEmailLower: effectiveUserEmailLower || null,
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

      const orderRef = adminDb.collection("orders").doc(session.id);
      const orderSnap = await orderRef.get();
      const orderData = orderSnap.data() as Record<string, any> | undefined;
      const toEmail =
        (session.customer_details?.email as string | undefined) ??
        (session.customer_email as string | undefined) ??
        authUser?.email;

      if (toEmail) {
        const customerName =
          (session.customer_details?.name as string | undefined) ||
          (orderData?.customerName as string | undefined) ||
          toEmail.split("@")[0] ||
          "Customer";

        const stripeReceiptUrl = billingLinks.stripeReceiptUrl ?? null;
        const stripeInvoiceUrl = billingLinks.stripeInvoiceUrl ?? null;
        const stripeInvoicePdfUrl = billingLinks.stripeInvoicePdfUrl ?? null;

        if (!orderData?.confirmationEmailSentAt) {
          const sendResult = await sendOrderConfirmationEmail({
            toEmail,
            customerName,
            orderNumber,
            orderDate: new Date(createdAtMs),
            planName: planName || "Service Package",
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
            planName: planName || "Service Package",
            amountTotal: session.amount_total,
            currency: session.currency,
            stripeReceiptUrl,
            stripeInvoiceUrl,
            stripeInvoicePdfUrl,
          });

          if (receiptSendResult.success) {
            await orderRef.set(
              {
                customerName,
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
    }

    return NextResponse.json({
      success: true,
      planId,
      planName,
      userId: effectiveUserId,
      frequency,
      subscriptionId,
      customerId,
      amountTotal: session.amount_total,
      currency: session.currency,
      orderNumber,
    });
  } catch (error: any) {
    console.error("Session verification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify session" },
      { status: 500 }
    );
  }
}
