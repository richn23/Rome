"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  getDevBypassProfile,
  getDevBypassRole,
  getDevBypassUser,
  isDevAuthBypassEnabled,
} from "@/lib/devAuth";
import { UserProfile, UserRole, LevelCode } from "@/types";
import toast from "react-hot-toast";

interface SignupExtras {
  nativeLanguage?: string;
  learningLanguage?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    level?: LevelCode,
    extras?: SignupExtras
  ) => Promise<void>;
  loginWithGoogle: (role?: UserRole, level?: LevelCode) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the current user's Firestore profile into state. Used after
   *  direct doc mutations (e.g. promote-self-to-admin in /seed). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const devBypass = isDevAuthBypassEnabled();
  const authAvailable = auth !== null;

  const [user, setUser] = useState<User | null>(() =>
    devBypass ? getDevBypassUser() : null
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() =>
    devBypass ? getDevBypassProfile(getDevBypassRole()) : null
  );
  const [loading, setLoading] = useState(() => !devBypass && authAvailable);

  useEffect(() => {
    if (devBypass) return;
    if (!authAvailable) return;
    const authInstance = auth;
    if (!authInstance) return;
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [devBypass, authAvailable]);

  const login = async (email: string, password: string) => {
    if (devBypass) {
      toast("Dev auth bypass is on — Firebase sign-in is skipped.", { icon: "🔧" });
      return;
    }
    if (!authAvailable) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const authInstance = auth;
    if (!authInstance) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const cred = await signInWithEmailAndPassword(authInstance, email, password);
    const docRef = doc(db, "users", cred.user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setUserProfile(docSnap.data() as UserProfile);
    }
  };

  const signup = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    level?: LevelCode,
    extras?: SignupExtras
  ) => {
    if (devBypass) {
      toast("Dev auth bypass is on — Firebase sign-up is skipped.", { icon: "🔧" });
      return;
    }
    if (!authAvailable) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const authInstance = auth;
    if (!authInstance) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const cred = await createUserWithEmailAndPassword(authInstance, email, password);
    await updateProfile(cred.user, { displayName });

    const profile: UserProfile = {
      uid: cred.user.uid,
      role,
      displayName,
      email,
      photoURL: "",
      createdAt: serverTimestamp() as unknown as UserProfile["createdAt"],
      ...(role === "learner" && level ? { level } : {}),
      ...(extras?.nativeLanguage ? { nativeLanguage: extras.nativeLanguage } : {}),
      ...(extras?.learningLanguage ? { learningLanguage: extras.learningLanguage } : {}),
      ...(role === "speaker"
        ? { status: "offline" as const, hourlyRate: 15, rating: 0, totalSessions: 0 }
        : {}),
    };

    await setDoc(doc(db, "users", cred.user.uid), profile);
    setUserProfile(profile);
  };

  const loginWithGoogle = async (role: UserRole = "learner", level: LevelCode = "1a") => {
    if (devBypass) {
      toast("Dev auth bypass is on — Firebase sign-in is skipped.", { icon: "🔧" });
      return;
    }
    if (!authAvailable) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const authInstance = auth;
    if (!authInstance) {
      throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(authInstance, provider);

    // Check if this user already has a profile in Firestore
    const docRef = doc(db, "users", cred.user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setUserProfile(docSnap.data() as UserProfile);
      return;
    }

    // New Google user — create a default profile
    const profile: UserProfile = {
      uid: cred.user.uid,
      role,
      displayName: cred.user.displayName || "New User",
      email: cred.user.email || "",
      photoURL: cred.user.photoURL || "",
      createdAt: serverTimestamp() as unknown as UserProfile["createdAt"],
      ...(role === "learner" ? { level } : {}),
      ...(role === "speaker"
        ? { status: "offline" as const, hourlyRate: 15, rating: 0, totalSessions: 0 }
        : {}),
    };

    await setDoc(docRef, profile);
    setUserProfile(profile);
  };

  const logout = async () => {
    if (devBypass) {
      toast("Sign out is disabled while dev auth bypass is enabled.", { icon: "🔧" });
      return;
    }
    if (!authAvailable) {
      setUserProfile(null);
      return;
    }
    const authInstance = auth;
    if (!authInstance) {
      setUserProfile(null);
      return;
    }
    await signOut(authInstance);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (devBypass) return;
    const uid = user?.uid;
    if (!uid) return;
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      setUserProfile(snap.data() as UserProfile);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, signup, loginWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
