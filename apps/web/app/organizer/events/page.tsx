import Link from "next/link";
import { AuthedList } from "@/components/AuthForms";

export default function Page() {
  return <div className="grid gap-4"><div className="flex gap-3"><Link href="/organizer/events/new">New event</Link><Link href="/organizer/submit-link">Submit source</Link></div><AuthedList path="/api/organizer/events" title="Organizer events" /></div>;
}
