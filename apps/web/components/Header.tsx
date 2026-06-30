import Link from "next/link";

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="font-bold text-slate-950">Manifestacije</Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/danas">Danas</Link>
          <Link href="/ovaj-vikend">Ovaj vikend</Link>
          <Link href="/regije">Regije</Link>
          <Link href="/mapa">Mapa</Link>
          <Link href="/dodaj-event">Dodaj event</Link>
          <Link href="/organizer/login">Organizer</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
