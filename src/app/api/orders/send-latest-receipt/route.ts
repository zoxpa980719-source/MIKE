import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  getPackageNameByPlanId,
  sendOrderReceiptEmail,
} from "@/lib/order-confirmation-email";

type StoredOrder = {
  orderId?: string;
  orderNumber?: string;
  userId?: string;
  userEmail?: string | null;
  customerName?: string | null;
  planId?: string | null;
  planName?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  createdAtMs?: number | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { response: authError, user } = await requireAuth(request);
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!adminDb) {
      return NextResponse.json({ error: "Order service unavailable" }, { status: 503 });
    }

    const snapshot = await adminDb.collection("orders").where("userId", "==", user.uid).get();
    const docs = snapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() as StoredOrder }))
      .sort((a, b) => (b.data.createdAtMs ?? 0) - (a.data.createdAtMs ?? 0));

    const latest = docs[0];
    if (!latest) {
      return NextResponse.json({ error: "No orders found" }, { status: 404 });
    }

    const order = latest.data;
    const toEmail = order.userEmail || user.email || null;
    if (!toEmail) {
      return NextResponse.json({ error: "No customer email found" }, { status: 400 });
    }

    const stripeReceiptUrl = order.stripeReceiptUrl ?? null;
    const stripeInvoiceUrl = order.stripeInvoiceUrl ?? null;
    const stripeInvoicePdfUrl = order.stripeInvoicePdfUrl ?? null;
    if (!stripeReceiptUrl && !stripeInvoiceUrl && !stripeInvoicePdfUrl) {
      return NextResponse.json(
        { error: "Latest order has no Stripe billing links yet" },
        { status: 400 }
      );
    }

    const orderNumber = order.orderNumber || order.orderId || latest.id;
    const planName =
      order.planName ||
      getPackageNameByPlanId(order.planId) ||
      "Service Package";
    const customerName =
      order.customerName ||
      toEmail.split("@")[0] ||
      "Customer";
    const orderDate = new Date(order.createdAtMs || Date.now());

    const sendResult = await sendOrderReceiptEmail({
      toEmail,
      customerName,
      orderNumber,
      orderDate,
      planName,
      amountTotal: order.amountTotal,
      currency: order.currency,
      stripeReceiptUrl,
      stripeInvoiceUrl,
      stripeInvoicePdfUrl,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { error: "Failed to send receipt email" },
        { status: 500 }
      );
    }

    await adminDb.collection("orders").doc(latest.id).set(
      {
        receiptEmailSentAt: new Date().toISOString(),
        receiptEmailMessageId: sendResult.messageId ?? null,
        receiptEmailManualResendAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      orderNumber,
      toEmail,
      messageId: sendResult.messageId ?? null,
    });
  } catch (error: any) {
    console.error("Send latest receipt email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send latest receipt email" },
      { status: 500 }
    );
  }
}

