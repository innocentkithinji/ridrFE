import type { Assignment } from "@ridr/web";
import { shownTime } from "@/features/assets/components/time";

// AssignmentHistory lists every Assignment an Asset has had, oldest
// first. An open one, with no end, is current.
export function AssignmentHistory({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) {
    return <p className="text-muted-foreground text-sm">No Device has reported for this Asset.</p>;
  }
  return (
    <table aria-label="Assignment history" className="w-full text-left text-sm tabular-nums">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-1 font-normal">Device</th>
          <th className="py-1 font-normal">Starts</th>
          <th className="py-1 font-normal">Ends</th>
        </tr>
      </thead>
      <tbody>
        {assignments.map((assignment, index) => (
          <tr key={`${assignment.deviceId}-${index}`} className="border-t">
            <td className="py-1.5 font-mono">{assignment.deviceId}</td>
            <td className="py-1.5">{shownTime(assignment.startsAt)}</td>
            <td className="py-1.5">
              {assignment.endsAt ? (
                shownTime(assignment.endsAt)
              ) : (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Current</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
