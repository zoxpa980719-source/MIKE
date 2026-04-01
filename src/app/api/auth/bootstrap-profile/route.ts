import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { toPublicProfile } from "@/lib/public-profile";

const PRIMARY_ADMIN_EMAIL = "mike@yinhng.com";
const ALLOWED_ROLES = new Set(["employee", "employer", "admin"]);

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAuth(request);
  if (response || !user) {
    return response as NextResponse;
  }

  if (!adminDb) {
    return NextResponse.json(
      { error: "Profile service unavailable" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tokenEmail = normalizeEmail(user.email);
  const emailFromBody = normalizeEmail(
    typeof body.email === "string" ? body.email : "",
  );
  const effectiveEmail = emailFromBody || tokenEmail;

  if (tokenEmail && effectiveEmail && tokenEmail !== effectiveEmail) {
    return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
  }

  const requestedRole =
    typeof body.role === "string" && ALLOWED_ROLES.has(body.role)
      ? body.role
      : "employee";
  const effectiveRole = tokenEmail === PRIMARY_ADMIN_EMAIL ? "admin" : requestedRole;

  const userData = {
    uid: user.uid,
    displayName: typeof body.displayName === "string" ? body.displayName : "",
    email: effectiveEmail,
    role: effectiveRole,
    photoURL: typeof body.photoURL === "string" ? body.photoURL : "",
    firstName: typeof body.firstName === "string" ? body.firstName : "",
    lastName: typeof body.lastName === "string" ? body.lastName : "",
    companyName: typeof body.companyName === "string" ? body.companyName : "",
    updatedAt: new Date().toISOString(),
  };

  await adminDb.collection("users").doc(user.uid).set(userData, { merge: true });
  await adminDb
    .collection("publicProfiles")
    .doc(user.uid)
    .set(toPublicProfile(userData), { merge: true });

  return NextResponse.json({ success: true });
}

