(() => {
  const DB = globalThis.BetterXplayerDB;
  const HOLD_DELAY_MS = 180;
  const SAVE_INTERVAL_MS = 800;
  const SEEK_TOLERANCE_SECONDS = 0.4;

  const trackedVideos = new WeakSet();
  const states = new WeakMap();
  let activeHold = null;
  let suppressUntil = 0;
  let suppressedVideo = null;
  let overlay = null;
  let blocker = null;
  let blockerHideTimer = 0;

  function getTweetContext(video) {
    const article = video.closest("article");
    const permalink =
      article?.querySelector('a[href*="/status/"]') ||
      article?.querySelector("time")?.closest('a[href*="/status/"]') ||
      video.closest('[data-testid="primaryColumn"]')?.querySelector('a[href*="/status/"]');
    const href = permalink?.getAttribute("href") || "";
    const absoluteUrl = permalink?.href || (location.pathname.includes("/status/") ? location.href : "");
    const statusId =
      href.match(/\/status\/(\d+)/)?.[1] ||
      absoluteUrl.match(/\/status\/(\d+)/)?.[1] ||
      location.pathname.match(/\/status\/(\d+)/)?.[1] ||
      "";
    const scope = article || video.closest('[data-testid="videoComponent"]') || document;
    const all = [...scope.querySelectorAll("video")];
    const index = Math.max(0, all.indexOf(video));

    return {
      article,
      permalink,
      tweetUrl: absoluteUrl,
      statusId,
      index
    };
  }

  function ensureOverlay() {
    if (overlay) {
      return overlay;
    }

    const style = document.createElement("style");
    style.textContent = `
      .bxp-speed {
        position: fixed;
        z-index: 2147483646;
        min-width: 54px;
        height: 26px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.58);
        color: #fff;
        font: 700 13px/1 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(6px);
        pointer-events: none;
        opacity: 0;
        transform: translate3d(0, -6px, 0);
        transition: opacity 120ms ease, transform 120ms ease;
      }
      .bxp-speed.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
      .bxp-speed svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
      .bxp-blocker {
        position: fixed;
        z-index: 2147483645;
        background: transparent;
        pointer-events: auto;
        touch-action: none;
      }
    `;
    document.documentElement.appendChild(style);

    overlay = document.createElement("div");
    overlay.className = "bxp-speed";
    overlay.innerHTML = '<span>2x</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6.5 13.8 12 7 17.5v-11Zm6 0 6.8 5.5-6.8 5.5v-11Z"></path></svg>';
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function ensureBlocker() {
    if (blocker) {
      return blocker;
    }
    blocker = document.createElement("div");
    blocker.className = "bxp-blocker";
    blocker.hidden = true;
    const stop = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    blocker.addEventListener("pointerup", stop, true);
    blocker.addEventListener("mouseup", stop, true);
    blocker.addEventListener("click", stop, true);
    document.documentElement.appendChild(blocker);
    return blocker;
  }

  function getState(video) {
    if (!states.has(video)) {
      states.set(video, {
        restored: false,
        lastSavedAt: 0,
        savePromise: null,
        pendingSnapshot: null,
        needsResave: false,
        watchedSeconds: 0,
        lastTimeSample: 0,
        committed: false
      });
    }
    return states.get(video);
  }

  function getVideoId(video) {
    const { statusId, index } = getTweetContext(video);
    return statusId ? `tweet:${statusId}:video:${index}` : "";
  }

  function getSnapshot(video) {
    const state = getState(video);
    const { article, tweetUrl } = getTweetContext(video);
    return {
      id: getVideoId(video),
      title:
        article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ||
        document.title.replace(/\s*\/\s*X\s*$/i, "").trim() ||
        "X video",
      author: article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || "",
      tweetUrl,
      poster: video.poster || "",
      duration: Number(video.duration) || 0,
      lastPosition: Number(video.currentTime) || 0,
      watchedSeconds: state.watchedSeconds,
      committedAt: state.committed ? Date.now() : 0
    };
  }

  function isTrackable(video) {
    return DB.isTrackableDuration(Number(video.duration) || 0) && !!getVideoId(video);
  }

  async function persist(video, force = false) {
    if (!isTrackable(video)) {
      return null;
    }
    const state = getState(video);
    if (!force && Date.now() - state.lastSavedAt < SAVE_INTERVAL_MS) {
      return null;
    }
    state.pendingSnapshot = getSnapshot(video);
    if (state.savePromise) {
      state.needsResave = true;
      return state.savePromise;
    }

    const flush = async () => {
      state.needsResave = false;
      state.lastSavedAt = Date.now();
      const record = await DB.upsertVideoProgress(state.pendingSnapshot).catch(() => null);
      if (state.needsResave) {
        return flush();
      }
      return record;
    };

    state.savePromise = flush().finally(() => {
      state.savePromise = null;
    });
    return state.savePromise;
  }

  async function restore(video) {
    const state = getState(video);
    if (state.restored || !isTrackable(video)) {
      return;
    }
    const library = await DB.loadLibrary();
    const record = library.videos[getVideoId(video)];
    state.committed = Boolean(record?.committedAt || Number(record?.watchedSeconds) >= 30);
    const target = DB.getResumeTime(record);
    state.restored = true;
    if (!target) {
      return;
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      state.restored = false;
      return;
    }
    const safeTarget = Math.min(target, Math.max(0, video.duration - 2));
    if (Math.abs(video.currentTime - safeTarget) > SEEK_TOLERANCE_SECONDS) {
      video.currentTime = safeTarget;
    }
  }

  function show2x(video) {
    const node = ensureOverlay();
    const block = ensureBlocker();
    if (blockerHideTimer) {
      clearTimeout(blockerHideTimer);
      blockerHideTimer = 0;
    }
    const rect = video.getBoundingClientRect();
    node.style.left = `${Math.round(rect.left + rect.width / 2 - 27)}px`;
    node.style.top = `${Math.round(rect.top + 10)}px`;
    node.classList.add("is-visible");
    block.style.left = `${Math.round(rect.left)}px`;
    block.style.top = `${Math.round(rect.top)}px`;
    block.style.width = `${Math.round(rect.width)}px`;
    block.style.height = `${Math.round(rect.height)}px`;
    block.hidden = false;
  }

  function hide2x(delayBlocker = 0) {
    overlay?.classList.remove("is-visible");
    if (blocker) {
      if (blockerHideTimer) {
        clearTimeout(blockerHideTimer);
        blockerHideTimer = 0;
      }
      if (delayBlocker > 0) {
        blockerHideTimer = window.setTimeout(() => {
          blocker.hidden = true;
          blockerHideTimer = 0;
        }, delayBlocker);
      } else {
        blocker.hidden = true;
      }
    }
  }

  function getVideoFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLVideoElement) {
        return node;
      }
    }
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      for (const element of elements) {
        if (element instanceof HTMLVideoElement) {
          return element;
        }
        if (element instanceof Element) {
          const nested = element.querySelector("video");
          if (nested instanceof HTMLVideoElement) {
            return nested;
          }
        }
      }
    }
    return null;
  }

  function beginHold(event) {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button, a, input, textarea, [role='button']")) {
      return;
    }
    const video = getVideoFromEvent(event);
    if (!video || video.paused) {
      return;
    }
    clearHold();
    activeHold = {
      pointerId: event.pointerId,
      video,
      previousRate: video.playbackRate || 1,
      applied: false,
      timerId: window.setTimeout(() => {
        if (!activeHold || activeHold.video !== video) {
          return;
        }
        activeHold.applied = true;
        video.playbackRate = 2;
        show2x(video);
      }, HOLD_DELAY_MS)
    };
  }

  function clearHold() {
    if (!activeHold) {
      hide2x();
      return;
    }
    clearTimeout(activeHold.timerId);
    if (activeHold.applied && activeHold.video.isConnected) {
      activeHold.video.playbackRate = activeHold.previousRate;
      suppressUntil = Date.now() + 220;
      suppressedVideo = activeHold.video;
    }
    activeHold = null;
    hide2x(suppressedVideo ? 220 : 0);
  }

  function endHold(event) {
    if (!activeHold || event.pointerId !== activeHold.pointerId) {
      return;
    }
    const applied = activeHold.applied;
    clearHold();
    if (applied) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function suppressClick(event) {
    if (!suppressedVideo || Date.now() > suppressUntil) {
      suppressedVideo = null;
      suppressUntil = 0;
      return;
    }
    if (getVideoFromEvent(event) !== suppressedVideo) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressedVideo = null;
    suppressUntil = 0;
  }

  function track(video) {
    if (trackedVideos.has(video)) {
      return;
    }
    trackedVideos.add(video);

    const resetRestore = () => {
      getState(video).restored = false;
    };

    video.addEventListener("loadedmetadata", () => {
      resetRestore();
      restore(video);
      persist(video, true);
    });
    video.addEventListener("loadeddata", () => {
      resetRestore();
      restore(video);
      persist(video, true);
    });
    video.addEventListener("durationchange", () => {
      resetRestore();
      restore(video);
      persist(video, true);
    });
    video.addEventListener("play", () => {
      const state = getState(video);
      state.lastTimeSample = Number(video.currentTime) || 0;
      restore(video);
      persist(video, true);
    });
    video.addEventListener("playing", () => {
      persist(video, true);
    });
    video.addEventListener("timeupdate", () => {
      const state = getState(video);
      const now = Number(video.currentTime) || 0;
      const delta = now - state.lastTimeSample;
      if (delta > 0 && delta < 2.5) {
        state.watchedSeconds += delta;
        if (!state.committed && state.watchedSeconds >= 30) {
          state.committed = true;
        }
      }
      state.lastTimeSample = now;
      persist(video, false);
    });
    video.addEventListener("pause", async () => {
      const state = getState(video);
      if (!state.committed && state.watchedSeconds >= 30) {
        state.committed = true;
      }
      await persist(video, true);
    });
    video.addEventListener("waiting", () => {
      persist(video, true);
    });
    video.addEventListener("stalled", () => {
      persist(video, true);
    });
    video.addEventListener("seeked", () => {
      getState(video).lastTimeSample = Number(video.currentTime) || 0;
      persist(video, true);
    });
    video.addEventListener("ended", () => {
      persist(video, true);
    });
  }

  function scan(root = document) {
    const videos = root.querySelectorAll ? root.querySelectorAll("video") : [];
    for (const video of videos) {
      track(video);
    }
  }

  async function handleGetCurrentVideo() {
    const video = [...document.querySelectorAll("video")]
      .filter((node) => node.getBoundingClientRect().width > 60)
      .sort((a, b) => {
        const aPlaying = a.paused ? 0 : 1;
        const bPlaying = b.paused ? 0 : 1;
        if (bPlaying !== aPlaying) {
          return bPlaying - aPlaying;
        }
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })
      .find((node) => isTrackable(node));

    if (!video) {
      return { ok: false, reason: "Open a video over 1 minute on X." };
    }

    await persist(video, true);
    return { ok: true };
  }

  function boot() {
    scan();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) {
            continue;
          }
          if (node.matches("video")) {
            track(node);
          } else {
            scan(node);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (window.PointerEvent) {
      document.addEventListener("pointerdown", beginHold, true);
      document.addEventListener("pointerup", endHold, true);
      document.addEventListener("pointercancel", clearHold, true);
    } else {
      document.addEventListener("mousedown", beginHold, true);
      document.addEventListener("mouseup", clearHold, true);
    }
    document.addEventListener("mouseup", suppressClick, true);
    document.addEventListener("click", suppressClick, true);
    document.addEventListener("scroll", () => {
      if (activeHold?.applied) {
        show2x(activeHold.video);
      }
    }, true);
    window.addEventListener("resize", () => {
      if (activeHold?.applied) {
        show2x(activeHold.video);
      }
    });

    const flushAll = () => {
      clearHold();
      for (const video of document.querySelectorAll("video")) {
        const state = getState(video);
        if (!state.committed && state.watchedSeconds >= 30) {
          state.committed = true;
        }
        persist(video, true);
      }
    };

    window.addEventListener("pagehide", flushAll);
    window.addEventListener("beforeunload", flushAll);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        flushAll();
      }
    });

    const api = DB.extensionApi;
    if (api?.runtime?.onMessage) {
      api.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type === "betterxplayer:get-current-video") {
          handleGetCurrentVideo().then(sendResponse);
          return true;
        }
        return undefined;
      });
    }
  }

  boot();
})();
