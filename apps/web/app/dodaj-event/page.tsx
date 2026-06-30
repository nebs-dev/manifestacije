import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { OrganizerCta } from "@/components/public/organizer-cta";

export default function AddEventPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <OrganizerCta />
      </main>
      <SiteFooter />
    </>
  );
}
