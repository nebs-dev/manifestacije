import { AdminActionPanel, AuthedList } from "../../../../components/AuthForms";

export default function Page({ params }: { params: { id: string } }) {
  return <div className="grid gap-4"><AdminActionPanel eventId={params.id} /><AuthedList path={`/api/admin/events/${params.id}`} title={`Admin event ${params.id}`} /></div>;
}
