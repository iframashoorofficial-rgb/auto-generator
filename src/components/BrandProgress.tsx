"use client";

import { BRAND_FIELDS, brandProgress, type BrandProfile } from "@/lib/brand";

/**
 * Onboarding progress.
 *
 * Segments, not a smooth bar: each pip is one thing we know about the brand,
 * so filling one is a visible, earned step rather than a number creeping up.
 * Hovering a pip says what it is, which doubles as a hint about what is left.
 */
export function BrandProgress({
  brand,
  compact = false,
}: {
  brand: BrandProfile;
  compact?: boolean;
}) {
  const pct = brandProgress(brand);
  const done = BRAND_FIELDS.filter((f) => f.filled(brand)).length;
  const next = BRAND_FIELDS.find((f) => !f.filled(brand));

  return (
    <div className={`bp${compact ? " bpCompact" : ""}`}>
      <div className="bpTop">
        <span className="bpFace" aria-hidden="true">
          {pct === 100 ? "🎉" : pct >= 66 ? "😄" : pct >= 33 ? "🙂" : "👋"}
        </span>
        <span className="bpLabel">
          {pct === 100 ? "Brand profile complete" : "Getting to know you"}
        </span>
        <span className="bpPct">{pct}%</span>
      </div>

      <div
        className="bpTrack"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Onboarding ${pct}% complete, ${done} of ${BRAND_FIELDS.length} details known`}
      >
        {BRAND_FIELDS.map((f) => {
          const filled = f.filled(brand);
          return (
            <span
              key={f.key}
              className={`bpPip${filled ? " on" : ""}`}
              title={`${f.label}${filled ? " ✓" : " — still needed"}`}
            />
          );
        })}
      </div>

      {!compact && (
        <p className="bpNote">
          {pct === 100 ? (
            <>Saved. Everything here is reused by every carousel from now on.</>
          ) : (
            <>
              {done} of {BRAND_FIELDS.length} details known
              {next ? <> · next up: {next.label.toLowerCase()}</> : null}
            </>
          )}
        </p>
      )}
    </div>
  );
}
