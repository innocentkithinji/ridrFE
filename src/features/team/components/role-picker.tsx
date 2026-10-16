import type { Role } from "@ridr/web";
import { permissionsTableUrl, roleLabel, roles } from "@/features/team/components/describe";

type RolePickerProps = {
  value: Role;
  onChange: (role: Role) => void;
  // The accessible name, such as "Role" or "Role of ana@example.com".
  label: string;
  // Hide the visible label, as in a table row.
  hideLabel?: boolean;
  disabled?: boolean;
};

// RolePicker chooses a Role, with a link to what each Role grants.
export function RolePicker({ value, onChange, label, hideLabel, disabled }: RolePickerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value) as Role)}
          className="border-input bg-background h-8 rounded-lg border px-2"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </label>
      <a
        href={permissionsTableUrl}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground text-xs underline"
      >
        What each Role can do
      </a>
    </span>
  );
}
