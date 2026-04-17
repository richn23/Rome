"use client";

import { useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isDevAuthBypassEnabled } from "@/lib/devAuth";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

export default function NotificationListener() {
  const { user, userProfile } = useAuth();

  // Speaker: notify on new pending bookings
  useEffect(() => {
    if (isDevAuthBypassEnabled()) return;
    if (!user || userProfile?.role !== "speaker") return;
    let first = true;
    const q = query(
      collection(db, "bookings"),
      where("speakerId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (first) {
        first = false;
        return; // Skip initial load
      }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          toast("New booking request!", { icon: "🔔" });
        }
      });
    });
    return unsub;
  }, [user, userProfile?.role]);

  // Learner: notify when any speaker goes online
  useEffect(() => {
    if (isDevAuthBypassEnabled()) return;
    if (!user || userProfile?.role !== "learner") return;
    let first = true;
    const q = query(
      collection(db, "users"),
      where("role", "==", "speaker"),
      where("status", "==", "online")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (first) {
        first = false;
        return;
      }
      snap.docChanges().forEach((change) => {
        if (change.type === "added" || (change.type === "modified" && change.doc.data().status === "online")) {
          const speaker = change.doc.data();
          toast(`${speaker.displayName} is now online!`, { icon: "🟢" });
        }
      });
    });
    return unsub;
  }, [user, userProfile?.role]);

  return null;
}
