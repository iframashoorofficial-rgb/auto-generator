/**
 * Content queue.
 *
 * Deliberately small: a list of ideas with a status each. No scheduling, no
 * calendar, no publishing integrations — just somewhere for the week's ideas
 * to live so they are not lost between sessions.
 */

export type QueueStatus = "idea" | "draft" | "ready" | "published";

export const QUEUE_STATUSES: { id: QueueStatus; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "draft", label: "Draft" },
  { id: "ready", label: "Ready" },
  { id: "published", label: "Published" },
];

export interface QueueItem {
  id: string;
  /** The carousel idea in one line. */
  title: string;
  /** Why it works for this brand — the assistant's reasoning. */
  angle: string;
  /** Which format it suits, if the assistant had an opinion. */
  formatId: string;
  status: QueueStatus;
  createdAt: number;
}

/** Ids without a uuid dependency; collisions do not matter at this scale. */
export function queueId(seed: string, index: number): string {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  return `${slug || "idea"}-${index}-${Math.floor(Math.random() * 1e6)}`;
}

export function setStatus(
  queue: QueueItem[],
  id: string,
  status: QueueStatus,
): QueueItem[] {
  return queue.map((q) => (q.id === id ? { ...q, status } : q));
}

export function removeItem(queue: QueueItem[], id: string): QueueItem[] {
  return queue.filter((q) => q.id !== id);
}

/** Newest first, but published items sink to the bottom. */
export function sortQueue(queue: QueueItem[]): QueueItem[] {
  const rank: Record<QueueStatus, number> = {
    ready: 0,
    draft: 1,
    idea: 2,
    published: 3,
  };
  return [...queue].sort(
    (a, b) => rank[a.status] - rank[b.status] || b.createdAt - a.createdAt,
  );
}
