import { CatalogService, RegistryService, type QueryProblem } from "@ridr/web";
import { useId, useState, type FormEvent } from "react";
import { QueryBuilder } from "@/components/query-builder/query-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMetrics } from "@/lib/api/catalog";
import { useAssets, vocabularyStaleTime } from "@/lib/api/registry";
import { sourceOf, templates, visualizations, type Visualization } from "@/features/dashboards/widgets";
import { useCan } from "@/lib/me";

// What the form edits of a Widget; the grid places it.
export type WidgetFields = { title: string; visualization: Visualization; text: string };

type WidgetFormDialogProps = {
  // The Widget being changed, or null to add one.
  editing: WidgetFields | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Where the last save said the Widget's Query is wrong.
  problem?: QueryProblem | null;
  onDone: (fields: WidgetFields) => void;
};

const blank: WidgetFields = {
  title: "",
  visualization: "line",
  text: "measurements\n| where metric == temperature\n| range last 1h",
};

// WidgetFormDialog adds a Widget, or changes one's title, Visualization
// and Query. Adding starts from a template, or blank. The change lands in
// the Dashboard being edited; nothing is saved until the Dashboard is.
export function WidgetFormDialog({ editing, open, onOpenChange, problem, onDone }: WidgetFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit widget" : "Add a widget"}</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts afresh. */}
        {open &&
          (editing ? (
            <WidgetForm start={editing} adding={false} problem={problem} onCancel={() => onOpenChange(false)} onDone={onDone} />
          ) : (
            <NewWidget onCancel={() => onOpenChange(false)} onDone={onDone} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

// NewWidget offers the templates first; picking one (or a blank Widget)
// opens the form filled in from it.
function NewWidget({ onCancel, onDone }: { onCancel: () => void; onDone: (fields: WidgetFields) => void }) {
  const [start, setStart] = useState<WidgetFields | null>(null);
  if (start) return <WidgetForm start={start} adding onCancel={onCancel} onDone={onDone} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">Start from one of these, then change anything.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => setStart({ ...template.fields })}
              className="hover:bg-muted/60 focus-visible:ring-ring/50 flex h-full w-full flex-col gap-1 rounded-lg border p-3 text-left outline-none focus-visible:ring-3"
            >
              <span className="text-sm font-medium">{template.label}</span>
              <span className="text-muted-foreground text-xs">{template.says}</span>
            </button>
          </li>
        ))}
      </ul>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" onClick={() => setStart(blank)}>
          Blank widget
        </Button>
      </DialogFooter>
    </div>
  );
}

type WidgetFormProps = {
  start: WidgetFields;
  adding: boolean;
  problem?: QueryProblem | null;
  onCancel: () => void;
  onDone: (fields: WidgetFields) => void;
};

function WidgetForm({ start, adding, problem, onCancel, onDone }: WidgetFormProps) {
  const [fields, setFields] = useState(start);
  const [submitted, setSubmitted] = useState(false);
  const titleProblemId = useId();
  const metrics = useMetrics({ enabled: useCan(CatalogService.method.listMetrics) });
  const assets = useAssets({ enabled: useCan(RegistryService.method.listAssets), staleTime: vocabularyStaleTime });
  const titleProblem = submitted && fields.title.trim() === "" ? "Give the widget a title." : null;
  const textProblem = submitted && fields.text.trim() === "" ? "Write the widget's Query." : null;
  // The save's problem marks the text it was about, until that changes.
  const shownProblem = problem && fields.text === start.text ? problem : null;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setSubmitted(true);
    if (fields.title.trim() === "" || fields.text.trim() === "") return;
    onDone({ ...fields, title: fields.title.trim(), text: fields.text.trim() });
  };

  return (
    <form aria-label="Widget" className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="space-y-1 text-sm font-medium">
          <span>Title</span>
          <Input
            value={fields.title}
            onChange={(event) => setFields({ ...fields, title: event.target.value })}
            aria-invalid={!!titleProblem}
            aria-describedby={titleProblem ? titleProblemId : undefined}
          />
          {titleProblem && (
            <span id={titleProblemId} role="alert" className="text-destructive block text-sm font-normal">
              {titleProblem}
            </span>
          )}
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Visualization</span>
          <select
            value={fields.visualization}
            onChange={(event) => setFields({ ...fields, visualization: event.target.value as Visualization })}
            className="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm font-normal"
          >
            {visualizations.map((one) => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground block text-xs font-normal">
            Draws {visualizations.find((one) => one.id === fields.visualization)?.says}.
          </span>
        </label>
      </div>
      <div className="space-y-2 text-sm">
        <span className="font-medium">Query</span>
        <QueryBuilder
          value={fields.text}
          onChange={(text) => setFields((current) => ({ ...current, text }))}
          sources={[sourceOf(fields.visualization)]}
          onSubmit={() => submit()}
          problem={shownProblem}
          vocabulary={{
            metrics: metrics.data?.metrics.map((metric) => metric.name),
            assets: assets.data?.assets.map((asset) => asset.name),
          }}
        />
        {textProblem && (
          <p role="alert" className="text-destructive text-sm">
            {textProblem}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          A range that ends now keeps the widget current: new Readings stream in, and a rollup reruns each bucket.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{adding ? "Add" : "Done"}</Button>
      </DialogFooter>
    </form>
  );
}
