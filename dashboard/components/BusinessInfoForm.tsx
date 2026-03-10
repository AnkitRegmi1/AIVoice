"use client";

import { useState, useEffect } from "react";
import type { BusinessInfoRow } from "@/lib/db";

const empty: BusinessInfoRow | null = {
  tenant_id: 1,
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <p className="text-slate-400 text-sm">
        This is what callers hear when they ask about your business. Sarah uses it to answer questions about hours, services, and location.
      </p>

      <div>
        <label htmlFor="business_hours" className="block text-sm font-medium text-slate-300 mb-1">
          Business hours
        </label>
        <textarea
          id="business_hours"
          rows={2}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.business_hours ?? ""}
          onChange={(e) => update("business_hours", e.target.value || null)}
          placeholder="e.g. Monday to Friday 9 AM to 6 PM, Saturday 10 AM to 4 PM. Closed Sunday."
        />
      </div>

      <div>
        <label htmlFor="services" className="block text-sm font-medium text-slate-300 mb-1">
          Services
        </label>
        <textarea
          id="services"
          rows={2}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.services ?? ""}
          onChange={(e) => update("services", e.target.value || null)}
          placeholder="e.g. Swedish massage, deep tissue, sports massage, relaxation massage, gift cards."
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1">
          Address / location
        </label>
        <input
          type="text"
          id="address"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.address ?? ""}
          onChange={(e) => update("address", e.target.value || null)}
          placeholder="e.g. 123 Main Street"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
          Phone (optional)
        </label>
        <input
          type="text"
          id="phone"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.phone ?? ""}
          onChange={(e) => update("phone", e.target.value || null)}
          placeholder="e.g. (555) 123-4567"
        />
      </div>

      <div>
        <label htmlFor="extra_notes" className="block text-sm font-medium text-slate-300 mb-1">
          Booking / other info
        </label>
        <textarea
          id="extra_notes"
          rows={2}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.extra_notes ?? ""}
          onChange={(e) => update("extra_notes", e.target.value || null)}
          placeholder="e.g. Callers can book now over the phone or call back later."
        />
      </div>

      <div>
        <label htmlFor="custom_instructions" className="block text-sm font-medium text-slate-300 mb-1">
          Knowledge Base — custom instructions (optional)
        </label>
        <textarea
          id="custom_instructions"
          rows={4}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={data?.custom_instructions ?? ""}
          onChange={(e) => update("custom_instructions", e.target.value || null)}
          placeholder="e.g. Always mention we have free parking. Keep answers under 2 sentences. If they ask about pricing, say rates vary by service and suggest they call or visit."
        />
        <p className="text-slate-500 text-xs mt-1">Sarah will follow these rules in addition to the business info above. One instruction per line or short paragraph.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message === "saved" && <span className="text-green-400 text-sm">Saved. Callers will hear this on the next call.</span>}
        {message === "error" && <span className="text-red-400 text-sm">Could not save. Try again.</span>}
      </div>
    </form>
  );
}
