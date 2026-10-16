import { ContactGroupService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { ContactGroupsList } from "@/features/contact-groups/components/contact-groups-list";
import { permissionOf } from "@/lib/me";

export const contactGroupsPath = "/settings/contact-groups";

export const contactGroupsPermission = permissionOf(ContactGroupService.method.listContactGroups);

export function ContactGroupsRoute() {
  return (
    <RequirePermission permission={contactGroupsPermission} what="Contact groups">
      <ContactGroupsList />
    </RequirePermission>
  );
}
