import type { Mapping } from "@ridr/web";
import { Fragment, type ReactNode } from "react";
import { unitLabel } from "@/lib/units";

// MappingSummary shows a saved Mapping to users who can't change it: each
// part beside the payload field it reads.
export function MappingSummary({ mapping }: { mapping: Mapping }) {
  const rows: [string, ReactNode][] = [
    [
      mapping.deviceIdFields.length > 0 ? "Device ID fields" : "Device ID field",
      mapping.deviceIdFields.length > 0 ? (
        <Fragment key="id">
          {mapping.deviceIdFields.map((f, i) => (
            <span key={i}>
              {i > 0 && " + "}
              <Path path={f} />
            </span>
          ))}{" "}
          joined with /
        </Fragment>
      ) : (
        <Path key="id" path={mapping.deviceIdField} />
      ),
    ],
    ["Device time field", <Path key="time" path={mapping.deviceTimeField} />],
    ...mapping.metrics.map((m, i): [string, ReactNode] => [
      `Metric ${i + 1}`,
      <>
        <Path path={m.field} /> → {m.metric} in {m.unit ? unitLabel(m.unit) : "no Unit"}
        {m.unknownValues.length > 0 && `, unknown when ${m.unknownValues.join(", ")}`}
      </>,
    ]),
    ...(mapping.location
      ? ([
          [
            "Location",
            <>
              <Path path={mapping.location.latitudeField} />,{" "}
              <Path path={mapping.location.longitudeField} />
            </>,
          ],
        ] as [string, ReactNode][])
      : []),
    ...mapping.events.map((e, i): [string, ReactNode] => [
      `Event ${i + 1}`,
      <>
        <Path path={e.field} /> → {e.name}
      </>,
    ]),
    ...mapping.tags.map((t, i): [string, ReactNode] => [
      `Tag ${i + 1}`,
      <>
        <Path path={t.field} /> → {t.key}
      </>,
    ]),
    ...mapping.attributes.map((a, i): [string, ReactNode] => [
      `Attribute ${i + 1}`,
      <>
        <Path path={a.field} /> → {a.key}
      </>,
    ]),
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Path({ path }: { path: string }) {
  return <code className="font-mono">{path}</code>;
}
