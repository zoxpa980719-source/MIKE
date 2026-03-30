import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const { response: roleError } = await requireRole(request, "admin");
    if (roleError) return roleError;

    if (!adminDb) {
      return NextResponse.json(
        { error: "Admin service unavailable" },
        { status: 503 }
      );
    }

    const usersSnap = await adminDb.collection("users").get();
    return NextResponse.json({
      totalUsers: usersSnap.size,
    });
  } catch (error: any) {
    console.error("Fetch admin overview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch admin overview" },
      { status: 500 }
    );
  }
}

