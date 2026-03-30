import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

type AdminOrderRecord = {
  orderId: string;
  orderNumber?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  customerName?: string | null;
  planId?: string | null;
  planName?: string | null;
  frequency?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  stripeSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeReceiptUrl?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
  confirmationEmailSentAt?: string | null;
  receiptEmailSentAt?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
  updatedAt?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { response: roleError } = await requireRole(request, "admin");
    if (roleError) return roleError;

    if (!adminDb) {
      return NextResponse.json(
        { error: "Order service unavailable" },
        { status: 503 }
      );
    }

    const snapshot = await adminDb.collection("orders").get();
    const orders = snapshot.docs
      .map((doc) => {
        const data = doc.data() as AdminOrderRecord;
        return {
          ...data,
          orderId: data.orderId || doc.id,
        };
      })
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Fetch admin orders error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch admin orders" },
      { status: 500 }
    );
  }
}

