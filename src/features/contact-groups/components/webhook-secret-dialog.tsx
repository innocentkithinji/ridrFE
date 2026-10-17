import { SecretDialog } from "@/components/secret-dialog";

// A newly issued webhook signing secret and the URL it belongs to.
export type IssuedSecret = { address: string; secret: string };

// WebhookSecretDialog shows newly issued signing secrets once, through
// the app's one SecretDialog. They live only in the caller's state;
// "Done" drops them for good.
export function WebhookSecretDialog({ secrets, onDone }: { secrets: IssuedSecret[]; onDone: () => void }) {
  return (
    <SecretDialog
      title="Webhook signing secret"
      hashed={false}
      secrets={
        secrets.length > 0
          ? secrets.map((issued) => ({ label: `Signing secret for ${issued.address}`, value: issued.secret }))
          : null
      }
      onDone={onDone}
    >
      Receivers use it to verify notifications the Standard Webhooks way. A secret belongs to its
      URL, in every group that uses it.
    </SecretDialog>
  );
}
