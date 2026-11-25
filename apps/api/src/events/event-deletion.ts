import { Prisma } from "@prisma/client";

/**
 * Write the record of a deletion, in the same transaction as the delete.
 *
 * Deleting an event stays a real delete (see `EventDeletion` in the schema
 * for why a soft delete was not chosen). What survives is this record: how
 * many events were deleted, when, by whom, and which event it was — the
 * questions the entry statistics ask. It cannot restore the event.
 *
 * The event is read inside the caller's transaction, so the record describes
 * the row as it was at the moment it was deleted, not as it was fetched
 * earlier by some other query.
 */
export async function recordEventDeletion(
  tx: Prisma.TransactionClient,
  eventId: number,
  deletedByUserId?: number,
): Promise<void> {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, startsAt: true, cityName: true, status: true, createdAt: true, createdByUserId: true },
  });
  // Nothing to record if the row is already gone: the delete below will fail
  // on its own terms rather than being masked by an error from here.
  if (!event) return;
  await tx.eventDeletion.create({
    data: {
      eventId: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      cityName: event.cityName,
      status: event.status,
      eventCreatedAt: event.createdAt,
      createdByUserId: event.createdByUserId,
      // An unattributed deletion is recorded as unattributed. Guessing an
      // author here would be worse than an honest gap.
      deletedByUserId: deletedByUserId ?? null,
    },
  });
}
