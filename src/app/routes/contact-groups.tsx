import { ContactGroupService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { ContactGroupsList } from "@/features/contact-groups/components/contact-groups-list";
import { permissionOf } from "@/lib/me";

export const contactGroupsPath = "/settings/contact-groups";

export function ContactGroupsRoute() {
  return (
    <RequirePermission
      permission={permissionOf(ContactGroupService.method.listContactGroups)}
      what="Contact groups"
    >
      <ContactGroupsList />
    </RequirePermission>
  );
}
