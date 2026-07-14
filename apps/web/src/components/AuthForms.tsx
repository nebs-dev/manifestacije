"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { API_URL } from "@/lib/api";

type Msg = { ok?: string; error?: string };

function PasswordInput({ name, placeholder, defaultValue, required }: { name: string; placeholder?: string; defaultValue?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="w-full pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ mode }: { mode: "organizer" | "admin" }) {
  const [msg, setMsg] = useState<Msg>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ error: data.message || "Login failed" });
    localStorage.setItem("token", data.token);
    setMsg({ ok: "Token saved. Otvorite dashboard." });
  }
  return (
    <form onSubmit={submit} className="grid max-w-md gap-3 rounded border bg-white p-4">
      <h1 className="text-2xl font-bold">{mode === "admin" ? "Admin login" : "Organizer login"}</h1>
      <input name="email" type="email" placeholder="email" defaultValue={mode === "admin" ? "admin@manifestacije.test" : ""} required />
      <PasswordInput name="password" placeholder="password" defaultValue={mode === "admin" ? "admin1234" : ""} required />
      <button>Login</button>
      <Message msg={msg} />
    </form>
  );
}

export function RegisterForm() {
  const [msg, setMsg] = useState<Msg>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), name: form.get("name"), organizerName: form.get("organizerName") })
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ error: data.message || "Register failed" });
    localStorage.setItem("token", data.token);
    setMsg({ ok: "Registered. Token saved." });
  }
  return (
    <form onSubmit={submit} className="grid max-w-md gap-3 rounded border bg-white p-4">
      <h1 className="text-2xl font-bold">Organizer register</h1>
      <input name="name" placeholder="Ime" required />
      <input name="organizerName" placeholder="Naziv organizatora" required />
      <input name="email" type="email" placeholder="email" required />
      <PasswordInput name="password" placeholder="password min 8" required />
      <button>Register</button>
      <Message msg={msg} />
    </form>
  );
}

export function OrganizerEventForm({ source = false }: { source?: boolean }) {
  const [msg, setMsg] = useState<Msg>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = source
      ? { sourceUrl: form.get("sourceUrl"), rawText: form.get("rawText") }
      : {
          title: form.get("title"),
          description: form.get("description"),
          cityId: Number(form.get("cityId")),
          categoryId: Number(form.get("categoryId")),
          startsAt: form.get("startsAt"),
          venueName: form.get("venueName"),
          isFree: form.get("isFree") === "on"
        };
    const res = await authedFetch(source ? "/api/organizer/events/submit-url" : "/api/organizer/events", { method: "POST", body: JSON.stringify(body) });
    setMsg(res.ok ? { ok: "Submitted for admin review." } : { error: await res.text() });
  }
  if (source) {
    return (
      <form onSubmit={submit} className="grid gap-3 rounded border bg-white p-4">
        <h1 className="text-2xl font-bold">Submit URL/raw text</h1>
        <input name="sourceUrl" placeholder="https://..." />
        <textarea name="rawText" rows={8} placeholder="Raw email/text/event description" />
        <button>Parse and submit</button>
        <Message msg={msg} />
      </form>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded border bg-white p-4">
      <h1 className="text-2xl font-bold">New event</h1>
      <input name="title" placeholder="Naslov" required />
      <textarea name="description" placeholder="Opis" required />
      <input name="startsAt" type="datetime-local" required />
      <input name="cityId" type="number" placeholder="cityId (seed Osijek=1)" defaultValue="1" required />
      <input name="categoryId" type="number" placeholder="categoryId (Glazba=1)" defaultValue="1" required />
      <input name="venueName" placeholder="Lokacija" />
      <label className="flex gap-2"><input name="isFree" type="checkbox" /> Besplatno</label>
      <button>Submit</button>
      <Message msg={msg} />
    </form>
  );
}

export function AuthedList({ path, title }: { path: string; title: string }) {
  const [data, setData] = useState<unknown>(null);
  const [msg, setMsg] = useState<Msg>({});
  useEffect(() => {
    authedFetch(path).then(async (res) => {
      if (!res.ok) return setMsg({ error: await res.text() });
      setData(await res.json());
    });
  }, [path]);
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Message msg={msg} />
      <pre className="overflow-auto rounded border bg-white p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export function AdminActionPanel({ eventId }: { eventId?: string }) {
  const [msg, setMsg] = useState<Msg>({});
  async function action(path: string) {
    const res = await authedFetch(path, { method: "POST" });
    setMsg(res.ok ? { ok: "Action done." } : { error: await res.text() });
  }
  if (!eventId) return null;
  return (
    <div className="flex flex-wrap gap-2 rounded border bg-white p-4">
      <button onClick={() => action(`/api/admin/events/${eventId}/approve`)}>Approve</button>
      <button onClick={() => action(`/api/admin/events/${eventId}/publish`)}>Publish</button>
      <button onClick={() => action(`/api/admin/events/${eventId}/reject`)}>Reject</button>
      <button onClick={() => action(`/api/admin/events/${eventId}/archive`)}>Archive</button>
      <Message msg={msg} />
    </div>
  );
}

export function UrlParsePanel({ onParsed }: { onParsed?: (sourceId: number) => void }) {
  const [msg, setMsg] = useState<Msg>({});
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sourceUrl = (form.get("sourceUrl") as string || "").trim();
    if (!sourceUrl) return setMsg({ error: "Please enter a URL" });
    setLoading(true);
    setMsg({});
    const res = await authedFetch("/api/admin/event-sources/parse-url", {
      method: "POST",
      body: JSON.stringify({ sourceUrl }),
    });
    setLoading(false);
    if (!res.ok) return setMsg({ error: await res.text() });
    const data = await res.json();
    const count = (data.parsedJson?.candidates?.length ?? 0);
    setMsg({ ok: `Stored source #${data.id} — ${count} candidate${count !== 1 ? "s" : ""} parsed. Open source to review.` });
    onParsed?.(data.id);
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded border bg-white p-4">
      <h2 className="text-xl font-semibold">Parse URL</h2>
      <p className="text-sm text-gray-500">Paste a URL to an event page or multi-event listing. The page will be fetched and parsed server-side.</p>
      <input name="sourceUrl" type="url" placeholder="https://..." required className="rounded border px-3 py-2" />
      <button disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {loading ? "Fetching & parsing…" : "Parse URL"}
      </button>
      <Message msg={msg} />
    </form>
  );
}

export function SourceCreatePanel() {
  const [msg, setMsg] = useState<Msg>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await authedFetch("/api/admin/event-sources/manual-email", {
      method: "POST",
      body: JSON.stringify({ rawEmailSubject: form.get("subject"), rawEmailFrom: form.get("from"), rawText: form.get("rawText"), sourceUrl: form.get("sourceUrl") })
    });
    setMsg(res.ok ? { ok: "Source parsed and stored." } : { error: await res.text() });
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded border bg-white p-4">
      <h2 className="text-xl font-semibold">Manual email/source</h2>
      <input name="subject" placeholder="Subject" />
      <input name="from" placeholder="From" />
      <input name="sourceUrl" placeholder="Source URL" />
      <textarea name="rawText" rows={8} placeholder="Raw source evidence" />
      <button>Create source</button>
      <Message msg={msg} />
    </form>
  );
}

export async function authedFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}`, ...(init?.headers || {}) }
  });
}

function Message({ msg }: { msg: Msg }) {
  if (!msg.ok && !msg.error) return null;
  return <p className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{msg.ok || msg.error}</p>;
}
