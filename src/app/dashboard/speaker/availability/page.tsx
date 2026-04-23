"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  orderBy,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import { AvailabilitySlot, RecurrenceRule, SlotDuration } from "@/types";
import toast from "react-hot-toast";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKS_AHEAD = 4;

/* Generate concrete slots for the next N weeks from a rule */
function generateSlotsFromRule(
  rule: Pick<RecurrenceRule, "speakerId" | "dayOfWeek" | "hour" | "minute" | "autoConfirm" | "durationMinutes">,
  recurrenceId: string,
  weeks: number
): Array<Omit<AvailabilitySlot, "slotId" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> }> {
  const out: Array<Omit<AvailabilitySlot, "slotId" | "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> }> = [];
  const now = new Date();
  for (let w = 0; w < weeks; w++) {
    const d = new Date(now);
    d.setDate(d.getDate() + w * 7);
    // Advance to matching day of week
    const diff = (rule.dayOfWeek - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    d.setHours(rule.hour, rule.minute, 0, 0);
    if (d > now) {
      out.push({
        speakerId: rule.speakerId,
        scheduledFor: Timestamp.fromDate(d),
        durationMinutes: rule.durationMinutes,
        autoConfirm: rule.autoConfirm,
        status: "available",
        bookingId: null,
        recurrenceId,
        createdAt: serverTimestamp(),
      });
    }
  }
  return out;
}

function formatDate(ts: Timestamp) {
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function AvailabilityContent() {
  const { userProfile } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [rules, setRules] = useState<RecurrenceRule[]>([]);

  /* One-off slot form */
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("09:00");
  const [slotDuration, setSlotDuration] = useState<SlotDuration>(30);
  const [slotAutoConfirm, setSlotAutoConfirm] = useState(true);

  /* Recurring rule form */
  const [ruleDay, setRuleDay] = useState(1);
  const [ruleTime, setRuleTime] = useState("09:00");
  const [ruleDuration, setRuleDuration] = useState<SlotDuration>(30);
  const [ruleAutoConfirm, setRuleAutoConfirm] = useState(true);

  /* Listen to my slots */
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "availability"),
      where("speakerId", "==", userProfile.uid),
      where("status", "in", ["available", "booked"]),
      orderBy("scheduledFor", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: AvailabilitySlot[] = [];
      snap.forEach((d) => arr.push({ slotId: d.id, ...d.data() } as AvailabilitySlot));
      setSlots(arr);
    });
    return unsub;
  }, [userProfile]);

  /* Listen to my recurrence rules */
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, "recurrence"),
      where("speakerId", "==", userProfile.uid),
      where("active", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: RecurrenceRule[] = [];
      snap.forEach((d) => arr.push({ recurrenceId: d.id, ...d.data() } as RecurrenceRule));
      setRules(arr);
    });
    return unsub;
  }, [userProfile]);

  /* Add one-off slot */
  const handleAddOneOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !slotDate || !slotTime) return;
    const [h, m] = slotTime.split(":").map(Number);
    const when = new Date(slotDate + "T00:00:00");
    when.setHours(h, m, 0, 0);
    if (when <= new Date()) {
      toast.error("Pick a future date/time");
      return;
    }
    await addDoc(collection(db, "availability"), {
      speakerId: userProfile.uid,
      scheduledFor: Timestamp.fromDate(when),
      durationMinutes: slotDuration,
      autoConfirm: slotAutoConfirm,
      status: "available",
      bookingId: null,
      recurrenceId: null,
      createdAt: serverTimestamp(),
    });
    toast.success("Slot added");
    setSlotDate("");
  };

  /* Add recurring rule + generate next 4 weeks of slots */
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const [h, m] = ruleTime.split(":").map(Number);
    if (m !== 0 && m !== 30) {
      toast.error("Time must be on the :00 or :30");
      return;
    }
    const ruleRef = await addDoc(collection(db, "recurrence"), {
      speakerId: userProfile.uid,
      dayOfWeek: ruleDay,
      hour: h,
      minute: m,
      durationMinutes: ruleDuration,
      autoConfirm: ruleAutoConfirm,
      active: true,
      createdAt: serverTimestamp(),
    });
    const generated = generateSlotsFromRule(
      { speakerId: userProfile.uid, dayOfWeek: ruleDay, hour: h, minute: m, durationMinutes: ruleDuration, autoConfirm: ruleAutoConfirm },
      ruleRef.id,
      WEEKS_AHEAD
    );
    const batch = writeBatch(db);
    generated.forEach((s) => {
      const ref = doc(collection(db, "availability"));
      batch.set(ref, s);
    });
    await batch.commit();
    toast.success(`Weekly slot added (${generated.length} upcoming)`);
  };

  /* Delete a single slot */
  const handleDeleteSlot = async (s: AvailabilitySlot) => {
    if (s.status === "booked") {
      toast.error("This slot is booked, cancel the booking first");
      return;
    }
    await updateDoc(doc(db, "availability", s.slotId), { status: "cancelled" });
  };

  /* Deactivate a recurrence rule (cancels future unbooked slots too) */
  const handleDeactivateRule = async (r: RecurrenceRule) => {
    await updateDoc(doc(db, "recurrence", r.recurrenceId), { active: false });
    const q = query(
      collection(db, "availability"),
      where("recurrenceId", "==", r.recurrenceId),
      where("status", "==", "available")
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.update(d.ref, { status: "cancelled" }));
    await batch.commit();
    toast.success("Recurring hours removed");
  };

  /* Group slots by date */
  const upcomingSlots = slots.filter((s) => s.scheduledFor.toDate() > new Date());
  const grouped = upcomingSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    const key = formatDate(s.scheduledFor);
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">Availability</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manage your hours</h1>
        </div>
        <Link href="/dashboard/speaker" className="text-sm font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800">
          Back to dashboard
        </Link>
      </div>

      {/* Recurring rules */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Weekly hours</h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          Set hours that repeat every week. We will generate slots for the next {WEEKS_AHEAD} weeks.
        </p>

        <form onSubmit={handleAddRule} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
          <select
            value={ruleDay}
            onChange={(e) => setRuleDay(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          >
            {DAY_NAMES.map((d, i) => (
              <option key={i} value={i} className="bg-white dark:bg-slate-900">{d}</option>
            ))}
          </select>
          <input
            type="time"
            step={1800}
            value={ruleTime}
            onChange={(e) => setRuleTime(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <select
            value={ruleDuration}
            onChange={(e) => setRuleDuration(Number(e.target.value) as SlotDuration)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            aria-label="Session length"
          >
            <option value={30} className="bg-white dark:bg-slate-900">30 min</option>
            <option value={45} className="bg-white dark:bg-slate-900">45 min</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={ruleAutoConfirm}
              onChange={(e) => setRuleAutoConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
            />
            Open session
          </label>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Add
          </button>
        </form>

        {rules.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No weekly hours yet</p>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div
                key={r.recurrenceId}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2"
              >
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  Every <strong>{DAY_NAMES[r.dayOfWeek]}</strong> at{" "}
                  <strong>{String(r.hour).padStart(2, "0")}:{String(r.minute).padStart(2, "0")}</strong>
                  <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                    {r.durationMinutes ?? 30} min
                  </span>
                  {r.autoConfirm ? (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Open</span>
                  ) : (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Approval</span>
                  )}
                </span>
                <button
                  onClick={() => handleDeactivateRule(r)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* One-off slots */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">One-off slot</h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Add a single slot for a specific date and time.</p>

        <form onSubmit={handleAddOneOff} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
          <input
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            required
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <input
            type="time"
            step={1800}
            value={slotTime}
            onChange={(e) => setSlotTime(e.target.value)}
            required
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
          />
          <select
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value) as SlotDuration)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
            aria-label="Session length"
          >
            <option value={30} className="bg-white dark:bg-slate-900">30 min</option>
            <option value={45} className="bg-white dark:bg-slate-900">45 min</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={slotAutoConfirm}
              onChange={(e) => setSlotAutoConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
            />
            Open session
          </label>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Add
          </button>
        </form>
      </section>

      {/* Upcoming slots list */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Your upcoming slots</h2>
        {Object.keys(grouped).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No upcoming slots
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([day, ds]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{day}</p>
                <div className="space-y-2">
                  {ds.map((s) => (
                    <div
                      key={s.slotId}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{formatTime(s.scheduledFor)}</span>
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                          {s.durationMinutes ?? 30} min
                        </span>
                        {s.autoConfirm ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Open</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Approval</span>
                        )}
                        {s.status === "booked" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Booked</span>
                        )}
                        {s.recurrenceId && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">recurring</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSlot(s)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <RouteGuard allowedRole="speaker">
      <AvailabilityContent />
    </RouteGuard>
  );
}
