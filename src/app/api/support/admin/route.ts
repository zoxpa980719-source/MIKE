import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

const PRIMARY_ADMIN_EMAIL = "mike@yinhng.com";

type UserDoc = {
  uid?: string;
  role?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
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
        { error: "Support service unavailable" },
        { status: 503 }
      );
    }

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .limit(20)
      .get();

    if (snapshot.empty) {
      const fallback = await adminDb
        .collection("users")
        .where("email", "==", PRIMARY_ADMIN_EMAIL)
        .limit(1)
        .get();
      if (!fallback.empty) {
        const doc = fallback.docs[0];
        const data = doc.data() as UserDoc;
        return NextResponse.json({
          admin: {
            uid: data.uid || doc.id,
            displayName: data.displayName || "YINHNG Support",
            email: data.email || null,
            photoURL: data.photoURL || null,
            role: "admin" as const,
          },
        });
      }
      return NextResponse.json(
        { error: "No admin account found" },
        { status: 404 }
      );
    }

    const admins = snapshot.docs.map((doc) => {
      const data = doc.data() as UserDoc;
      return {
        uid: data.uid || doc.id,
        displayName: data.displayName || "YINHNG Support",
        email: data.email || null,
        photoURL: data.photoURL || null,
        role: "admin" as const,
      };
    });

    // Prefer an admin that is not the requester; fallback to first.
    const targetAdmin = admins.find((a) => a.uid !== user.uid) ?? admins[0];

    return NextResponse.json({ admin: targetAdmin });
  } catch (error: any) {
    console.error("Fetch support admin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch support admin" },
      { status: 500 }
    );
  }
}
