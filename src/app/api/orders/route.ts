import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

type OrderRecord = {
  orderId: string;
  userId: string;
  userEmail?: string | null;
  planId?: string | null;
  planName?: string | null;
  frequency?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  createdAt?: string | null;
  createdAtMs?: number | null;
  updatedAt?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { response: authError, user } = await requireAuth(request);
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Order service unavailable" },
        { status: 503 }
      );
    }

    const snapshot = await adminDb
      .collection("orders")
      .where("userId", "==", user.uid)
      .get();

    const orders = snapshot.docs
      .map((doc) => doc.data() as OrderRecord)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Fetch orders error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

