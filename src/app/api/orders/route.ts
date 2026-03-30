import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

type OrderRecord = {
  orderId: string;
  userId?: string | null;
  userEmail?: string | null;
  userEmailLower?: string | null;
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

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

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
    const db = adminDb;

    const normalizedEmail = normalizeEmail(user.email);
    const orderMap = new Map<string, { id: string; data: OrderRecord }>();

    const ownOrders = await db
      .collection("orders")
      .where("userId", "==", user.uid)
      .get();
    ownOrders.docs.forEach((doc) => {
      orderMap.set(doc.id, { id: doc.id, data: doc.data() as OrderRecord });
    });

    if (normalizedEmail) {
      const byEmailLower = await db
        .collection("orders")
        .where("userEmailLower", "==", normalizedEmail)
        .get();
      byEmailLower.docs.forEach((doc) => {
        orderMap.set(doc.id, { id: doc.id, data: doc.data() as OrderRecord });
      });

      const byEmailExact = await db
        .collection("orders")
        .where("userEmail", "==", user.email || "")
        .get();
      byEmailExact.docs.forEach((doc) => {
        orderMap.set(doc.id, { id: doc.id, data: doc.data() as OrderRecord });
      });

      // Fallback: scan recent orders for case-insensitive email match.
      if (orderMap.size === 0) {
        const recent = await db
          .collection("orders")
          .orderBy("createdAtMs", "desc")
          .limit(300)
          .get();
        recent.docs.forEach((doc) => {
          const data = doc.data() as OrderRecord;
          const email = normalizeEmail(data.userEmail);
          if (email && email === normalizedEmail) {
            orderMap.set(doc.id, { id: doc.id, data });
          }
        });
      }
    }

    const orders = Array.from(orderMap.values())
      .map(({ id, data }) => ({
        ...data,
        orderId: data.orderId || id,
      }))
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

    // Backfill ownership for legacy public-checkout orders.
    const pendingBackfill = orders.filter(
      (order) =>
        !order.userId &&
        normalizedEmail &&
        normalizeEmail(order.userEmail) === normalizedEmail
    );
    if (pendingBackfill.length > 0) {
      const batch = db.batch();
      pendingBackfill.forEach((order) => {
        const docId = order.orderId;
        batch.set(
          db.collection("orders").doc(docId),
          {
            userId: user.uid,
            userEmailLower: normalizedEmail,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
      await batch.commit();
    }

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Fetch orders error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
