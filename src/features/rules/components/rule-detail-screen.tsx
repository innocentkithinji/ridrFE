import { durationMs, type Duration } from "@bufbuild/protobuf/wkt";
import { Code, type ConnectError } from "@connectrpc/connect";
import { AlertService, AlertState, RuleService, type Alert, type Rule } from "@ridr/web";
import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TrackMap } from "@/components/map/track-map";
import { ErrorState, Loading, NotFound, QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useContactGroups } from "@/lib/api/contact-groups";
import {
  useDeleteRule,
  useDisableRule,
  useEnableRule,
  useUpdateRule,
} from "@/features/rules/api/change-rule";
import { useRule } from "@/features/rules/api/get-rule";
import { useAlerts } from "@/lib/api/alerts";
import { BackToRules } from "@/features/rules/components/back-to-rules";
import {
  draftOf,
  kindOf,
  operatorLabels,
  ruleDraftKey,
  ruleOf,
  selectorText,
  triggerLabels,
} from "@/features/rules/components/rule-draft";
import { RuleForm } from "@/features/rules/components/rule-form";
import { RuleStateBadge } from "@/features/rules/components/rule-state";
import { ScopeNote } from "@/features/rules/components/scope-note";
import type { GeoPolygon } from "@/components/map/tracks";
import { formatTime } from "@/lib/format";
import { Can, useCan } from "@/lib/me";
import { hasStoredDraft } from "@/lib/unsaved-draft";
import { withUnit } from "@/lib/units";

const notFoundMessage = "This Rule doesn't exist, or isn't yours to see.";

// RuleDetailScreen is /rules/:ruleId: one Rule's settings, its edit
// form, enable/disable, delete, and its Alerts.
export function RuleDetailScreen({ ruleId }: { ruleId: string }) {
  const query = useRule(ruleId);
  let body: ReactNode;
  if (query.isPending) {
    body = <Loading what="the Rule" />;
  } else if (query.error) {
    body = isMissing(query.error) ? (
      <NotFound what="Rule" message={notFoundMessage} />
    ) : (
      <ErrorState error={query.error} />
    );
  } else if (!query.data.rule) {
    body = <NotFound what="Rule" message={notFoundMessage} />;
  } else {
    body = <RuleDetail rule={query.data.rule} />;
  }
  return (
    <section className="space-y-6">
      <BackToRules />
      {body}
    </section>
  );
}

// A malformed ID can't name a Rule either, so it reads as not found.
function isMissing(error: ConnectError): boolean {
  return error.code === Code.NotFound || error.code === Code.InvalidArgument;
}

function RuleDetail({ rule }: { rule: Rule }) {
  // A Rule left with an unsaved edit reopens in edit mode, restoring it.
  const [editing, setEditing] = useState(() => hasStoredDraft(ruleDraftKey(rule.id)));
  const update = useUpdateRule();
  const canEdit = useCan(RuleService.method.updateRule);

  if (editing) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {rule.name}</h1>
        <ScopeNote />
        <RuleForm
          draftKey={ruleDraftKey(rule.id)}
          initial={draftOf(rule)}
          submitLabel="Save"
          save={(draft) => update.mutateAsync({ rule: ruleOf(draft, rule.id) })}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </>
    );
  }
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
          <RuleStateBadge rule={rule} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
          )}
          {rule.disabled ? <EnableRule rule={rule} /> : <DisableRule rule={rule} />}
          <Can method={RuleService.method.deleteRule}>
            <DeleteRule rule={rule} />
          </Can>
        </div>
      </header>
      <Settings rule={rule} />
      <Can method={AlertService.method.listAlerts}>
        <RuleAlerts ruleId={rule.id} />
      </Can>
    </>
  );
}

function EnableRule({ rule }: { rule: Rule }) {
  const enable = useEnableRule();
  if (!useCan(RuleService.method.enableRule)) return null;
  return (
    <Button
      variant="outline"
      disabled={enable.isPending}
      onClick={() => enable.mutate({ ruleId: rule.id })}
    >
      Enable
    </Button>
  );
}

function DisableRule({ rule }: { rule: Rule }) {
  const disable = useDisableRule();
  if (!useCan(RuleService.method.disableRule)) return null;
  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Disable</Button>}
      title={`Disable ${rule.name}?`}
      confirm="Disable"
      onConfirm={() => disable.mutateAsync({ ruleId: rule.id })}
    >
      The Rule stops watching Readings until it is enabled again, and its open Alerts are resolved,
      so nobody is notified about them again.
    </ConfirmDialog>
  );
}

function DeleteRule({ rule }: { rule: Rule }) {
  const remove = useDeleteRule();
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Delete</Button>}
      title={`Delete ${rule.name}?`}
      confirm="Delete"
      onConfirm={() => remove.mutateAsync({ ruleId: rule.id })}
    >
      This can't be undone. The Rule's Alerts are kept as history, still listed under its name.
    </ConfirmDialog>
  );
}

function Settings({ rule }: { rule: Rule }) {
  const groups = useContactGroups();
  const names = new Map((groups.data?.contactGroups ?? []).map((group) => [group.id, group.name]));
  const notified = rule.contactGroupIds.map((id) => names.get(id) ?? id);
  const zone: GeoPolygon | null =
    rule.condition.case === "geofence"
      ? rule.condition.value.zone.map((point) => [point.longitude, point.latitude])
      : null;
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <Fact term="Kind">{kindOf(rule)}</Fact>
        <Fact term="Watches">{selectorText(rule.selector)}</Fact>
        <Fact term="Condition">{conditionText(rule)}</Fact>
        <Fact term="Holds for">{minutesText(rule.forDuration, "fires on the first breaking Reading")}</Fact>
        <Fact term="Freshness">{minutesText(rule.freshness, "5 minutes")}</Fact>
        <Fact term="Notifies">{notified.length ? notified.join(", ") : "Nobody"}</Fact>
        <Fact term="Repeats">{repeatsText(rule)}</Fact>
        <Fact term="Changed">{formatTime(rule.updatedAt)}</Fact>
      </dl>
      {zone && <TrackMap tracks={[]} label="Geofence" area={{ polygon: zone }} />}
    </div>
  );
}

function conditionText(rule: Rule): string {
  const condition = rule.condition;
  switch (condition.case) {
    case "threshold": {
      const { metric, operator, value, unit } = condition.value;
      const op = operatorLabels[operator as keyof typeof operatorLabels] ?? "?";
      return `${metric} ${op} ${withUnit(value, unit)}`;
    }
    case "noData": {
      const what = condition.value.metric ? `no ${condition.value.metric} Reading` : "no Reading";
      return `${what} for ${minutesText(condition.value.silentFor, "0 minutes")}`;
    }
    case "geofence": {
      const trigger = triggerLabels[condition.value.trigger as keyof typeof triggerLabels] ?? "?";
      return `an Asset ${trigger} (${condition.value.zone.length} corners)`;
    }
    default:
      return "Unknown";
  }
}

function minutesText(duration: Duration | undefined, whenZero: string): string {
  const minutes = duration ? durationMs(duration) / 60_000 : 0;
  if (minutes === 0) return whenZero;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function repeatsText(rule: Rule): string {
  if (rule.maxRepeats === 0) return "Never";
  const times = rule.maxRepeats === 1 ? "once" : `${rule.maxRepeats} times`;
  return `Every ${minutesText(rule.renotifyInterval, "0 minutes")}, at most ${times}, until acknowledged`;
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

const stateLabels: Record<AlertState, string> = {
  [AlertState.UNSPECIFIED]: "Unknown",
  [AlertState.FIRING]: "Firing",
  [AlertState.ACKNOWLEDGED]: "Acknowledged",
  [AlertState.RESOLVED]: "Resolved",
};

// RuleAlerts lists the Alerts the Rule raised, each linking to its
// detail. New ones appear through the poll.
function RuleAlerts({ ruleId }: { ruleId: string }) {
  const alerts = useAlerts({ ruleId });
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Alerts</h2>
      <QueryView
        query={alerts}
        what="Alerts"
        isEmpty={(answer) => answer.alerts.length === 0}
        empty="This Rule hasn't raised any Alerts."
      >
        {(answer) => <AlertsTable alerts={answer.alerts} />}
      </QueryView>
    </section>
  );
}

function AlertsTable({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label="Alerts of this Rule" className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Asset</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Fired</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id} className="border-t">
              <td className="px-3 py-2">{stateLabels[alert.state]}</td>
              <td className="px-3 py-2">
                <Link to={`/alerts/${alert.id}`} className="font-medium hover:underline">
                  {alert.asset}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{withUnit(alert.value, alert.unit)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatTime(alert.firedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
