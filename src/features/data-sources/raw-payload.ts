// Reading a Raw payload's bytes and topic for display.

const decoder = new TextDecoder();

export type DecodedBody = { text: string; json: boolean };

// decodeBody turns a Raw payload's body into text: JSON pretty-printed,
// anything else as it came.
export function decodeBody(body: Uint8Array): DecodedBody {
  const text = decoder.decode(body);
  try {
    return { text: JSON.stringify(JSON.parse(text), null, 2), json: true };
  } catch {
    return { text, json: false };
  }
}

// topicLevels splits an MQTT topic at "/": level N is what a Mapping
// field "$topic.N" reads. Empty for a payload without a topic.
export function topicLevels(topic: string): string[] {
  return topic === "" ? [] : topic.split("/");
}
