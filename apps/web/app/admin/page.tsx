import Link from "next/link";
import { LoginForm } from "../../components/AuthForms";

export default function AdminPage() {
  return (
    <div className="grid gap-4">
      <LoginForm mode="admin" />
      <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
        <Link href="/admin/events/pending">Pending events</Link>
        <Link href="/admin/organizers">Organizers</Link>
        <Link href="/admin/sources">Sources</Link>
        <Link href="/admin/duplicates">Duplicates</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/regions">Regions</Link>
      </div>
    </div>
  );
}
