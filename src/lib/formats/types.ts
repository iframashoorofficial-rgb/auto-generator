/**
 * Format definitions.
 *
 * A format describes one publishable artefact: a TikTok carousel, a single
 * story frame, a thread, an ad set. The app knows nothing about carousels
 * specifically — it reads these definitions and renders whatever they declare.
 *
 * Adding a format means adding a file under `src/lib/formats/` and listing it
 * in `index.ts`. No other code changes.
 */

/** A single editable piece of text in a rendered frame. */
export interface SlotDef {
  key: string;
  /** Shown above the editing field. */
  label: string;
  /** What this line is for — also given to the model when it writes copy. */
  intent: string;
  /** Soft character budget. Large display type breaks down past this. */
  max: number;
}

/** One line of type inside a frame. */
export interface LineDef {
  slot: string;
  size: number;
  weight: number;
}

/** Where the type block sits inside the frame, in frame pixels. */
export interface TypeBox {
  top: number;
  left: number;
  right: number;
  gap: number;
}

/** One frame — a slide, a story panel, a single image. */
export interface FrameDef {
  /** Short human name for this beat, e.g. "The comparison". */
  role: string;
  /** What this beat has to accomplish. Given to the model verbatim. */
  purpose: string;
  alt: string;
  /** CSS gradient painted over the photo for legibility. */
  scrim: string;
  box: TypeBox;
  lines: LineDef[];
  /** Draw a downward arrow under the type. */
  arrow?: boolean;
  /** Draw the business name as a small wordmark. */
  wordmark?: boolean;
  /** Photo slot name — resolved against the chosen photo pack. */
  photo: string;
}

export interface FormatDef {
  id: string;
  name: string;
  /** One line, shown in the format picker. */
  description: string;
  /** The narrative shape, shown as a hint under the name. */
  beats: string;
  /** Output pixel dimensions. */
  width: number;
  height: number;
  frames: FrameDef[];
  slots: SlotDef[];
  /**
   * What the intake agent must learn before this format can be written well.
   * These are appended to the general business questions, so a format can ask
   * for whatever it uniquely needs without the intake being built around it.
   */
  intakeGoals: string[];
  /** Extra writing rules handed to the model for this format. */
  writingRules: string[];
}
