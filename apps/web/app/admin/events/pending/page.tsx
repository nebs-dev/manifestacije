import { AuthedList } from "../../../../components/AuthForms";

export default function Page() {
  return <AuthedList path="/api/admin/events/pending" title="Pending events" />;
}
