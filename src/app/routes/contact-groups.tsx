import { lazy } from "react";
import { ContactGroupService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const ContactGroupsList = lazy(() => import("@/features/contact-groups/components/contact-groups-list").then((m) => ({ default: m.ContactGroupsList })));

export const contactGroupsPath = "/settings/contact-groups";

export const contactGroupsPermission = permissionOf(ContactGroupService.method.listContactGroups);

export function ContactGroupsRoute() {
  return (
    <RequirePermission permission={contactGroupsPermission} what="Contact groups">
      <ContactGroupsList />
    </RequirePermission>
  );
}
