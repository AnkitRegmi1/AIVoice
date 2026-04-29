"use client";

import { useEffect, useState } from "react";
import type { BusinessInfoRow } from "@/lib/db";

const empty: BusinessInfoRow | null = {
  tenant_id: 1,
  business_name: null,
  business_hours: null,
  services: null,
  address: null,
  phone: null,
  extra_notes: null,
  custom_instructions: null,
  updated_at: new Date(),
};

export function BusinessInfoForm({ initial }: { initial: BusinessInfoRow | null }) {
  const [data, setData] = useState<BusinessInfoRow | null>(initial ?? empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    if (initial) setData(initial);
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/business-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.business_name || "",
          businessHours: data.business_hours || "",
          services: data.services || "",
          address: data.address || "",
          phone: data.phone || "",
          extraNotes: data.extra_notes || "",
          customInstructions: data.custom_instructions || "",
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setData(updated);
      setMessage("saved");
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
  }

  const update = (field: keyof BusinessInfoRow, value: string | null) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  return (
    <section className="app-panel p-6 sm:p-8">
      <div className="mb-6 space-y-3">
        <p className="app-label">Business profile</p>
        <h3 className="app-card-title text-slate-900">Business info</h3>
        <p className="text-sm leading-7 text-slate-600">
          This is the core information Sarah uses to answer business questions on the next call.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="business_name" className="app-field-label">
            Business name
          </label>
          <input
            type="text"
            id="business_name"
            className="app-input"
            value={data?.business_name ?? ""}
            onChange={(e) => update("business_name", e.target.value || null)}
            placeholder="Tranquil Touch Massage Spa"
          />
          <p className="mt-1.5 text-xs leading-6 text-slate-500">
            Sarah uses this when greeting callers and confirming appointments.
          </p>
        </div>

        <div>
          <label htmlFor="business_hours" className="app-field-label">
            Business hours
          </label>
          <textarea
            id="business_hours"
            rows={3}
            className="app-textarea"
            value={data?.business_hours ?? ""}
            onChange={(e) => update("business_hours", e.target.value || null)}
            placeholder="Monday to Friday 9 AM to 6 PM. Saturday 10 AM to 4 PM. Closed Sunday."
          />
        </div>

        <div>
          <label htmlFor="services" className="app-field-label">
            Services
          </label>
          <textarea
            id="services"
            rows={3}
            className="app-textarea"
            value={data?.services ?? ""}
            onChange={(e) => update("services", e.target.value || null)}
            placeholder="Swedish massage, deep tissue, sports massage, relaxation massage, gift cards."
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="address" className="app-field-label">
              Address or location
            </label>
            <input
              type="text"
              id="address"
              className="app-input"
              value={data?.address ?? ""}
              onChange={(e) => update("address", e.target.value || null)}
              placeholder="123 Main Street"
            />
          </div>

          <div>
            <label htmlFor="phone" className="app-field-label">
              Phone
            </label>
            <input
              type="text"
              id="phone"
              className="app-input"
              value={data?.phone ?? ""}
              onChange={(e) => update("phone", e.target.value || null)}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div>
          <label htmlFor="extra_notes" className="app-field-label">
            Booking notes
          </label>
          <textarea
            id="extra_notes"
            rows={3}
            className="app-textarea"
            value={data?.extra_notes ?? ""}
            onChange={(e) => update("extra_notes", e.target.value || null)}
            placeholder="Callers can book now over the phone or call back later."
          />
        </div>

        <div>
          <label htmlFor="custom_instructions" className="app-field-label">
            Knowledge base rules
          </label>
          <textarea
            id="custom_instructions"
            rows={5}
            className="app-textarea"
            value={data?.custom_instructions ?? ""}
            onChange={(e) => update("custom_instructions", e.target.value || null)}
            placeholder="Always mention free parking. Keep answers under two sentences. If asked about pricing, say rates vary by service."
          />
          <p className="mt-2 text-xs leading-6 text-slate-500">
            These rules are added on top of the core business info during live calls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="app-button-primary disabled:opacity-60">
            {saving ? "Saving" : "Save updates"}
          </button>
          {message === "saved" ? (
            <span className="text-sm font-medium text-emerald-700">
              Saved. The next caller will hear the updated info.
            </span>
          ) : null}
          {message === "error" ? (
            <span className="text-sm font-medium text-rose-600">Could not save. Try again.</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
