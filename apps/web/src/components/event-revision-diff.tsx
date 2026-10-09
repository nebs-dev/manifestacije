import { REVISION_FIELD_LABELS, revisionValue, type EventRevision } from "@/lib/event-revisions"

export function EventRevisionDiff({ revision }: { revision: EventRevision }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[600px] table-fixed text-left text-sm">
        <caption className="sr-only">Usporedba izvorne verzije i predloženih izmjena. Vremena su prikazana u zoni Europe/Zagreb.</caption>
        <thead className="bg-muted"><tr><th className="w-36 p-3">Podatak</th><th className="p-3">Izvorna verzija</th><th className="p-3">Predložena verzija</th></tr></thead>
        <tbody>
          {revision.changes.map(change => (
            <tr key={change.field} className="border-t align-top">
              <th scope="row" className="p-3 font-medium">{REVISION_FIELD_LABELS[change.field] ?? "Podatak"}</th>
              <td className="whitespace-pre-wrap break-words bg-muted/30 p-3 [overflow-wrap:anywhere]">{revisionValue(change.field, change.original, revision.categories)}</td>
              <td className="whitespace-pre-wrap break-words bg-primary/5 p-3 font-medium [overflow-wrap:anywhere]">{revisionValue(change.field, change.proposed, revision.categories)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
