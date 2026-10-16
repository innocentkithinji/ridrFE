import { DeliveryStatus, type Delivery } from "@ridr/web";
import { QueryView } from "@/components/states";
import { useDeliveries } from "@/features/alerts/api/get-deliveries";
import { formatTime } from "@/lib/format";

const statuses: Record<DeliveryStatus, string> = {
  [DeliveryStatus.UNSPECIFIED]: "Unknown",
  [DeliveryStatus.PENDING]: "Pending",
  [DeliveryStatus.DELIVERED]: "Delivered",
  [DeliveryStatus.RETRYING]: "Retrying",
  [DeliveryStatus.FAILED]: "Failed",
};

// Deliveries shows whom an Alert notified, oldest first, and how each
// notification went.
export function Deliveries({ alertId }: { alertId: string }) {
  const deliveries = useDeliveries(alertId);
  return (
    <QueryView
      query={deliveries}
      what="Deliveries"
      empty="Nobody has been notified."
      isEmpty={(answer) => answer.deliveries.length === 0}
    >
      {(answer) => <DeliveriesTable deliveries={answer.deliveries} />}
    </QueryView>
  );
}

function DeliveriesTable({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label="Deliveries" className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Notification</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Attempts</th>
            <th className="px-3 py-2 font-medium">Last tried</th>
            <th className="px-3 py-2 font-medium">Last error</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id} className="border-t">
              <td className="px-3 py-2">{delivery.contact?.address ?? "—"}</td>
              <td className="px-3 py-2">
                {delivery.repeat === 0 ? "First" : `Repeat ${delivery.repeat}`}
              </td>
              <td className="px-3 py-2">{statuses[delivery.status]}</td>
              <td className="px-3 py-2 tabular-nums">{delivery.attempts}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatTime(delivery.lastAttemptAt)}</td>
              <td className="text-destructive px-3 py-2">{delivery.lastError}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
