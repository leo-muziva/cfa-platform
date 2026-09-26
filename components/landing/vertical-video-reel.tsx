"use client";

import { useState } from "react";

const CLIPS = [
  "/media/video/cfa_life_vert_1.mp4",
  "/media/video/cfa_life_vert_2.mp4",
  "/media/video/cfa_life_vert_3.mp4",
  "/media/video/cfa_life_vert_4.mp4",
] as const;

// key={clipIndex} remounts <video> per clip so autoPlay reliably fires on
// the new src — simpler than imperative ref.load()/play() calls. onEnded
// (not loop) advances through the 4 clips, wrapping back to the first.
export function VerticalVideoReel({ className = "" }: { className?: string }) {
  const [clipIndex, setClipIndex] = useState(0);
  return (
    <div
      className={`relative aspect-[9/16] overflow-hidden rounded-2xl shadow-[0_16px_45px_rgba(37,20,92,0.08)] ${className}`}
    >
      <video
        key={clipIndex}
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        onEnded={() => setClipIndex((i) => (i + 1) % CLIPS.length)}
        src={CLIPS[clipIndex]}
      />
    </div>
  );
}
