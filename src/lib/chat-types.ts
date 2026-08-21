/**
 * Shared chat shape.
 *
 * Lives apart from the component so the store can persist turns without
 * importing React, and so the API routes can type their request bodies.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Onboarding gathers the brand; afterwards the same thread becomes an ongoing
 * assistant that edits the profile on request. The mode is derived from the
 * brand, not stored, so it can never drift out of sync.
 */
export type ChatMode = "onboarding" | "assistant";
