"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

interface UserProfile {
  role: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  userProfile: UserProfile | null;
}

const PRIMARY_ADMIN_EMAIL = "mike@yinhng.com";

const normalizeEmail = (email?: string | null) => (email || "").trim().toLowerCase();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(nextUser);

      if (nextUser) {
        setLoading(true);

        void (async () => {
          try {
            const token = await nextUser.getIdToken();
            const isHttps =
              typeof window !== "undefined" && window.location.protocol === "https:";
            const secureAttr = isHttps ? "; Secure" : "";
            document.cookie = `__session=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secureAttr}`;
          } catch (error) {
            console.error("Failed to set session cookie:", error);
          }
        })();

        const isPrimaryAdmin = normalizeEmail(nextUser.email) === PRIMARY_ADMIN_EMAIL;
        const docRef = doc(db, "users", nextUser.uid);

        unsubscribeProfile = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              const profileData = snap.data() as UserProfile;
              profileData.plan = "pro";

              const effectiveRole = isPrimaryAdmin ? "admin" : profileData.role;
              setRole(effectiveRole);
              setUserProfile({ ...profileData, role: effectiveRole });
            } else if (isPrimaryAdmin) {
              setRole("admin");
              setUserProfile({
                uid: nextUser.uid,
                email: nextUser.email,
                displayName: nextUser.displayName || "Mike",
                role: "admin",
                plan: "pro",
              });
            } else {
              // Fallback profile so UI will not stay in infinite loading.
              setRole("employee");
              setUserProfile({
                uid: nextUser.uid,
                email: nextUser.email,
                displayName: nextUser.displayName || "",
                role: "employee",
                plan: "pro",
              });
            }

            setLoading(false);
          },
          (error) => {
            console.error("Failed to subscribe user profile:", error);
            if (isPrimaryAdmin) {
              setRole("admin");
              setUserProfile({
                uid: nextUser.uid,
                email: nextUser.email,
                displayName: nextUser.displayName || "Mike",
                role: "admin",
                plan: "pro",
              });
            } else {
              setRole("employee");
              setUserProfile({
                uid: nextUser.uid,
                email: nextUser.email,
                displayName: nextUser.displayName || "",
                role: "employee",
                plan: "pro",
              });
            }
            setLoading(false);
          },
        );

        return;
      }

      document.cookie = "__session=; path=/; max-age=0";
      setRole(null);
      setUserProfile(null);
      setLoading(false);
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, [auth]);

  return <AuthContext.Provider value={{ user, loading, role, userProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
