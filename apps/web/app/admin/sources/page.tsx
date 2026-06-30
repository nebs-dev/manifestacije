import { AuthedList, SourceCreatePanel } from "../../../components/AuthForms";

export default function Page() {
  return <div className="grid gap-4"><SourceCreatePanel /><AuthedList path="/api/admin/event-sources" title="Event sources" /></div>;
}
