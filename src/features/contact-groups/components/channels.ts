import { Channel } from "@ridr/web";

// The Channels a Contact can use, in the order the form offers them.
export const channels = [Channel.EMAIL, Channel.WEBHOOK, Channel.SMS, Channel.WHATSAPP];

const labels: Record<Channel, string> = {
  [Channel.UNSPECIFIED]: "Unknown",
  [Channel.EMAIL]: "Email",
  [Channel.WEBHOOK]: "Webhook",
  [Channel.SMS]: "SMS",
  [Channel.WHATSAPP]: "WhatsApp",
};

// channelLabel names a Channel for the screen.
export function channelLabel(channel: Channel): string {
  return labels[channel];
}
