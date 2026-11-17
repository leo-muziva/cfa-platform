"use client";

import { useEffect, useRef, type VideoHTMLAttributes } from "react";

const RETRY_EVENTS = ["touchstart", "scroll", "click"] as const;

/**
 * A muted, inline, looping-friendly background video that autoplays on phones.
 *
 * Why this exists: phones can refuse to autoplay even a muted inline video
 * (iOS Low Power Mode, Android data saver) and then show a big play button.
 * This re-asserts muted (iOS only allows muted autoplay), starts playback
 * once mounted and, if the browser still blocks it, tries again on the first
 * touch, scroll or click. The play button itself is hidden in globals.css.
 */
export function AutoplayVideo(props: VideoHTMLAttributes<HTMLVideoElement>) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");

    const tryPlay = () => video.play().then(() => true, () => false);
    const retry = () => {
      void tryPlay().then((ok) => {
        if (ok) removeRetry();
      });
    };
    const removeRetry = () =>
      RETRY_EVENTS.forEach((event) => window.removeEventListener(event, retry));

    void tryPlay().then((ok) => {
      if (!ok) {
        RETRY_EVENTS.forEach((event) =>
          window.addEventListener(event, retry, { passive: true }),
        );
      }
    });
    return removeRetry;
  }, []);

  return <video ref={ref} autoPlay muted playsInline preload="auto" {...props} />;
}
