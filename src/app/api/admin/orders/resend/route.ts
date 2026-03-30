import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  getPackageItems,
  getPackageNameByPlanId,
  sendOrderConfirmationEmail,
  sendOrderReceiptEmail,
} from "@/lib/order-confirmation-email";

type ResendType = "confirmation" | "receipt";

type StoredOrder = {
  orderId?: string;
  orderNumber?: string;
  userEmail?: string | null;
  customerName?: string | null;
  planId?: string | null;
  planName?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { response: roleError } = await requireRole(request, "admin");
    if (roleError) return roleError;

    if (!adminDb) {
      return NextResponse.json({ error: "Order service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const type = body?.type as ResendType;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }
    if (type !== "confirmation" && type !== "receipt") {
      return NextResponse.json({ error: "Invalid resend type" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderSnap.data() as StoredOrder;
    const toEmail = order.userEmail || null;
    if (!toEmail) {
      return NextResponse.json({ error: "Order has no customer email" }, { status: 400 });
    }

    const orderNumber = order.orderNumber || order.orderId || orderId;
    const planName = order.planName || getPackageNameByPlanId(order.planId) || "Service Package";
    const customerName = order.customerName || toEmail.split("@")[0] || "Customer";
    const orderDate = new Date(order.createdAtMs || Date.parse(order.createdAt || "") || Date.now());

    if (type === "confirmation") {
      const result = await sendOrderConfirmationEmail({
        toEmail,
        customerName,
        orderNumber,
        orderDate,
        planName,
        includedItems: getPackageItems(order.planId),
        amountTotal: order.amountTotal,
        currency: order.currency,
        stripeReceiptUrl: order.stripeReceiptUrl,
        stripeInvoiceUrl: order.stripeInvoiceUrl,
        stripeInvoicePdfUrl: order.stripeInvoicePdfUrl,
      });

      if (!result.success) {
        return NextResponse.json({ error: "Failed to send confirmation email" }, { status: 500 });
      }

      await orderRef.set(
        {
          confirmationEmailSentAt: new Date().toISOString(),
          confirmationEmailMessageId: result.messageId ?? null,
          confirmationEmailManualResendAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        type,
        orderId,
        orderNumber,
        toEmail,
        messageId: result.messageId ?? null,
      });
    }

    if (!order.stripeReceiptUrl && !order.stripeInvoiceUrl && !order.stripeInvoicePdfUrl) {
      return NextResponse.json(
        { error: "Order has no Stripe billing links yet" },
        { status: 400 }
      );
    }

    const result = await sendOrderReceiptEmail({
      toEmail,
      customerName,
      orderNumber,
      orderDate,
      planName,
      amountTotal: order.amountTotal,
      currency: order.currency,
      stripeReceiptUrl: order.stripeReceiptUrl,
      stripeInvoiceUrl: order.stripeInvoiceUrl,
      stripeInvoicePdfUrl: order.stripeInvoicePdfUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to send receipt email" }, { status: 500 });
    }

    await orderRef.set(
      {
        receiptEmailSentAt: new Date().toISOString(),
        receiptEmailMessageId: result.messageId ?? null,
        receiptEmailManualResendAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      type,
      orderId,
      orderNumber,
      toEmail,
      messageId: result.messageId ?? null,
    });
  } catch (error: any) {
    console.error("Admin resend order email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resend order email" },
      { status: 500 }
    );
  }
}

