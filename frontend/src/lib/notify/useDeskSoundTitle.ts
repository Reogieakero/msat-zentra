"use client";

import * as React from "react";
import { subscribeDeskSoundPlaying } from "./deskSounds";

/** Tab badge shown while a desk alert clip is audible. */
const SOUND_ICON = "🔊";
const SOUND_ICON_PREFIX = /^🔊\s*/;

/**
 * Reflect desk alert playback in the browser tab title: the speaker icon is
 * prefixed while a clip rings and removed as soon as it stops. The tab keeps
 * its normal page title otherwise — no unread counter.
 *
 * Mount once per desk shell (guidance, adviser/teacher).
 */
export function useDeskSoundTitle() {
  React.useEffect(() => {
    let showing = false;

    const apply = (playing: boolean) => {
      if (playing === showing) return;
      showing = playing;
      const base = document.title.replace(SOUND_ICON_PREFIX, "");
      document.title = playing ? `${SOUND_ICON} ${base}` : base;
    };

    const unsubscribe = subscribeDeskSoundPlaying(apply);
    return () => {
      unsubscribe();
      if (showing) document.title = document.title.replace(SOUND_ICON_PREFIX, "");
    };
  }, []);
}
