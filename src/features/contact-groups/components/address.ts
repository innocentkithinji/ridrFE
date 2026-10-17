import { Channel } from "@ridr/web";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164: a plus, a country code and the number, 8 to 15 digits in all.
const phonePattern = /^\+[1-9]\d{7,14}$/;

// addressProblem says what is wrong with address for channel, or returns
// undefined when it will do. The server checks too, but accepts some
// addresses no message could reach, so the form checks first.
export function addressProblem(channel: Channel, address: string): string | undefined {
  const value = address.trim();
  if (value === "") {
    return "Enter an address.";
  }
  switch (channel) {
    case Channel.EMAIL:
      return emailPattern.test(value) ? undefined : "Enter an email address, like ops@example.com.";
    case Channel.WEBHOOK:
      return isHttpsUrl(value) ? undefined : "Enter an https URL, like https://example.com/hook.";
    case Channel.SMS:
    case Channel.WHATSAPP:
      return phonePattern.test(value)
        ? undefined
        : "Enter a phone number with its country code, like +254712345678.";
    default:
      return "Choose a Channel.";
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

// addressPlaceholder hints at the address a channel takes.
export function addressPlaceholder(channel: Channel): string {
  switch (channel) {
    case Channel.EMAIL:
      return "ops@example.com";
    case Channel.WEBHOOK:
      return "https://example.com/hook";
    default:
      return "+254712345678";
  }
}
