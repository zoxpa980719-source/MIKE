"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { sendWelcomeEmailDirect } from "@/lib/email-utils";
import { AnimatedCharacters } from "@/components/ui/animated-characters";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { toPublicProfile } from "@/lib/public-profile";
import { Checkbox } from "@/components/ui/checkbox";
import { getAdminEmails } from "../login/actions";

const signupSchema = z.object({
  fullName: z.string().min(2, { message: "Please enter your full name." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

type SignupFormValues = z.infer<typeof signupSchema>;
const PRIMARY_ADMIN_EMAIL = "mike@yinhng.com";

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

async function bootstrapProfileOnServer(user: User, userData: Record<string, any>) {
  const token = await user.getIdToken(true);
  const response = await fetch("/api/auth/bootstrap-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const fallbackError = await response.text().catch(() => "");
    throw new Error(fallbackError || `Bootstrap failed with ${response.status}`);
  }
}

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const password = form.watch("password");

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: values.fullName,
      });

      let adminEmails: string[] = [];
      try {
        adminEmails = await getAdminEmails();
      } catch (adminEmailError) {
        console.error("Failed to load admin email list during signup:", adminEmailError);
      }
      const isAdmin = values.email ? adminEmails.includes(values.email.toLowerCase()) : false;
      const role = isAdmin ? "admin" : "employee";

      const nameParts = values.fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const userData = {
        uid: user.uid,
        displayName: values.fullName,
        email: values.email,
        role: role,
        firstName: firstName,
        lastName: lastName,
      };

      try {
        await bootstrapProfileOnServer(user, userData);
      } catch {
        try {
          // Local fallback when server credentials are not configured.
          await setDoc(doc(db, "users", user.uid), userData, { merge: true });
          await setDoc(
            doc(db, "publicProfiles", user.uid),
            toPublicProfile(userData),
            {
              merge: true,
            },
          );
        } catch (profileSyncError) {
          console.error("Failed to sync profile during signup:", profileSyncError);
        }
      }

      // Send welcome email
      try {
        await sendWelcomeEmailDirect(
          values.email,
          values.fullName,
        );
      } catch (welcomeEmailError) {
        console.error("Failed to send signup welcome email:", welcomeEmailError);
      }

      toast({
        title: "Account Created",
        description:
          "Your account has been successfully created. You are now logged in.",
      });

      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const authenticatedUser = auth.currentUser;
      if (
        authenticatedUser &&
        normalizeEmail(authenticatedUser.email) === normalizeEmail(values.email)
      ) {
        console.warn(
          "Signup succeeded but a follow-up sync step failed; continuing with signed-in session.",
          err,
        );
        router.push(
          normalizeEmail(authenticatedUser.email) === PRIMARY_ADMIN_EMAIL
            ? "/admin"
            : "/dashboard",
        );
        return;
      }

      const code = err?.code as string | undefined;
      const message =
        code === "auth/email-already-in-use"
          ? "This email is already registered. Please sign in instead."
          : code === "auth/invalid-email"
            ? "Invalid email format. Please check and try again."
            : code === "auth/weak-password"
              ? "Password is too weak. Please use at least 6 characters."
              : err?.message || "Something went wrong. Please try again.";
      setError(message);
      toast({
        title: "Signup Failed",
        description: message,
        variant: "destructive",
      });
      if (code === "auth/email-already-in-use") {
        router.push(`/login?email=${encodeURIComponent(values.email)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2">
      {/* Left Content Section with Animated Characters */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-white/90 dark:via-white/80 dark:to-white/70 p-12 text-white dark:text-gray-900">
        <div className="relative z-20">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <span className="text-2xl font-extrabold tracking-[0.25em] uppercase text-foreground drop-shadow-sm">
              YINHNG
            </span>
          </Link>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <AnimatedCharacters
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={password.length}
          />
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-gray-600 dark:text-gray-700">
          <a
            href="/privacy-policy"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            className="hover:text-gray-900 dark:hover:text-black transition-colors"
          >
            Terms of Service
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-gray-400/20 dark:bg-gray-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-gray-300/20 dark:bg-gray-200/20 rounded-full blur-3xl" />
      </div>

      {/* Right Signup Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <span className="text-2xl font-extrabold tracking-[0.25em] uppercase text-foreground drop-shadow-sm">
              YINHNG
            </span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Create an account
            </h1>
            <p className="text-muted-foreground text-sm">
              Join Yinhng to find your next opportunity
            </p>
          </div>

          {/* Signup Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name or Company Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe or Acme Inc."
                autoComplete="off"
                {...form.register("fullName")}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                className="h-12 bg-background border-border/60 focus:border-primary"
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="off"
                {...form.register("email")}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                className="h-12 bg-background border-border/60 focus:border-primary"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...form.register("password")}
                  className="h-12 pr-10 bg-background border-border/60 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="privacy-terms" required />
              <Label
                htmlFor="privacy-terms"
                className="text-sm font-normal cursor-pointer"
              >
                I agree to the
                <Link
                  href="/privacy-policy"
                  className="text-primary underline mx-1"
                >
                  Privacy Policy
                </Link>
                and
                <Link href="/terms" className="text-primary underline mx-1">
                  Terms of Service
                </Link>
              </Label>
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg">
                {error}
              </div>
            )}

            <InteractiveHoverButton
              type="submit"
              text={isLoading ? "Creating account..." : "Create Account"}
              className="w-full h-12 text-base font-medium"
              disabled={isLoading}
            />
          </form>

          {/* Sign In Link */}
          <div className="text-center text-sm text-muted-foreground mt-8">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground font-medium hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
