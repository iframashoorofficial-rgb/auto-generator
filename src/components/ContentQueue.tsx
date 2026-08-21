"use client";

import {
  QUEUE_STATUSES,
  removeItem,
  setStatus,
  sortQueue,
  type QueueItem,
  type QueueStatus,
} from "@/lib/queue";

/**
 * The content queue.
 *
 * A holding pen for ideas, not a scheduler. Ideas arrive from the assistant
 * ("give me next week's carousels") and move by hand through four states.
 */
export function ContentQueue({
  queue,
  onQueue,
  onUseIdea,
  onAskForIdeas,
  busy,
}: {
  queue: QueueItem[];
  onQueue: (update: (q: QueueItem[]) => QueueItem[]) => void;
  onUseIdea: (item: QueueItem) => void;
  onAskForIdeas: () => void;
  busy?: boolean;
}) {
  const sorted = sortQueue(queue);

  return (
    <div className="panel">
      <div className="brandHead">
        <h2>Content queue</h2>
        <button className="mini" onClick={onAskForIdeas} disabled={busy}>
          {busy ? "Thinking…" : "Ask for this week's ideas"}
        </button>
      </div>

      {!sorted.length ? (
        <p className="hint">
          Empty. Ask the Brand Assistant for ideas, or generate a carousel and save it here.
        </p>
      ) : (
        <ul className="queue">
          {sorted.map((item) => (
            <li key={item.id} className={`qItem q-${item.status}`}>
              <div className="qMain">
                <span className="qTitle">{item.title}</span>
                {item.angle && <span className="qAngle">{item.angle}</span>}
              </div>
              <div className="qRow">
                <select
                  aria-label={`Status for ${item.title}`}
                  value={item.status}
                  onChange={(e) =>
                    onQueue((q) => setStatus(q, item.id, e.target.value as QueueStatus))
                  }
                >
                  {QUEUE_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button className="mini" onClick={() => onUseIdea(item)}>
                  Write it
                </button>
                <button
                  className="mini"
                  onClick={() => onQueue((q) => removeItem(q, item.id))}
                  aria-label={`Remove ${item.title}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
