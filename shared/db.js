(function () {
  const STORAGE_KEY = "betterXplayer.library";
  const MAX_VIDEOS = 150;
  const VIDEO_TTL_MS = 120 * 24 * 60 * 60 * 1000;
  const MIN_TRACK_DURATION_SECONDS = 60;
  const MIN_RESUME_SECONDS = 2;
  const MIN_COMMIT_WATCH_SECONDS = 30;
  const FINISHED_THRESHOLD = 0.99;
  let cachedLibrary = null;
  let loadPromise = null;
  let writeChain = Promise.resolve();

  function getExtensionApi() {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      return browser;
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome;
    }
    return null;
  }

  const extensionApi = getExtensionApi();

  function storageGet(key) {
    if (!extensionApi) {
      return Promise.resolve({});
    }
    if (extensionApi.storage.local.get.length <= 1) {
      return extensionApi.storage.local.get(key);
    }
    return new Promise((resolve, reject) => {
      extensionApi.storage.local.get(key, (result) => {
        const error = extensionApi.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result);
      });
    });
  }

  function storageSet(value) {
    if (!extensionApi) {
      return Promise.resolve();
    }
    if (extensionApi.storage.local.set.length <= 1) {
      return extensionApi.storage.local.set(value);
    }
    return new Promise((resolve, reject) => {
      extensionApi.storage.local.set(value, () => {
        const error = extensionApi.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function sanitizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cloneLibrary(library) {
    return {
      videos: Object.fromEntries(
        Object.entries(library?.videos || {}).map(([id, record]) => [id, { ...record }])
      )
    };
  }

  function isTrackableDuration(duration) {
    return Number.isFinite(duration) && duration >= MIN_TRACK_DURATION_SECONDS;
  }

  function normalizeRecord(id, record) {
    const now = Date.now();
    return {
      id,
      title: sanitizeText(record?.title) || "X video",
      author: sanitizeText(record?.author),
      tweetUrl: sanitizeText(record?.tweetUrl),
      poster: sanitizeText(record?.poster),
      duration: Math.max(0, Number(record?.duration) || 0),
      lastPosition: Math.max(0, Number(record?.lastPosition) || 0),
      watchedSeconds: Math.max(0, Number(record?.watchedSeconds) || 0),
      committedAt: Number(record?.committedAt) || 0,
      lastSeenAt: Number(record?.lastSeenAt) || now,
      updatedAt: Number(record?.updatedAt) || now,
      trashedAt: Number(record?.trashedAt) || 0
    };
  }

  function isFinished(record) {
    if (record.trashedAt) {
      return true;
    }
    if (!isTrackableDuration(record.duration)) {
      return true;
    }
    return record.lastPosition / record.duration >= FINISHED_THRESHOLD;
  }

  function isCommitted(record) {
    return Number(record?.committedAt) > 0 || Number(record?.watchedSeconds) >= MIN_COMMIT_WATCH_SECONDS;
  }

  function pruneLibrary(library) {
    const now = Date.now();
    const normalized = { videos: {} };
    const entries = Object.entries(library?.videos || {})
      .map(([id, record]) => [id, normalizeRecord(id, record)])
      .filter(([, record]) => now - record.lastSeenAt <= VIDEO_TTL_MS)
      .sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0))
      .slice(0, MAX_VIDEOS);

    for (const [id, record] of entries) {
      normalized.videos[id] = record;
    }
    return normalized;
  }

  async function loadLibrary() {
    if (cachedLibrary) {
      return cloneLibrary(cachedLibrary);
    }
    if (!loadPromise) {
      loadPromise = storageGet(STORAGE_KEY)
        .then((result) => {
          cachedLibrary = pruneLibrary(result?.[STORAGE_KEY] || { videos: {} });
          return cachedLibrary;
        })
        .finally(() => {
          loadPromise = null;
        });
    }
    const library = await loadPromise;
    return cloneLibrary(library);
  }

  async function saveLibrary(library) {
    const normalized = pruneLibrary(library);
    await storageSet({ [STORAGE_KEY]: normalized });
    cachedLibrary = normalized;
    return cloneLibrary(normalized);
  }

  async function mutateLibrary(mutator) {
    writeChain = writeChain.then(async () => {
      const library = await loadLibrary();
      await mutator(library);
      return saveLibrary(library);
    });
    return writeChain;
  }

  async function upsertVideoProgress(snapshot) {
    if (!isTrackableDuration(Number(snapshot?.duration) || 0)) {
      return null;
    }
    const id = sanitizeText(snapshot?.id);
    if (!id) {
      return null;
    }
    const saved = await mutateLibrary((library) => {
      const record = normalizeRecord(id, library.videos[id] || snapshot);
      record.title = sanitizeText(snapshot?.title) || record.title;
      record.author = sanitizeText(snapshot?.author) || record.author;
      record.tweetUrl = sanitizeText(snapshot?.tweetUrl) || record.tweetUrl;
      record.poster = sanitizeText(snapshot?.poster) || record.poster;
      record.duration = Math.max(0, Number(snapshot?.duration) || record.duration || 0);
      record.lastPosition = Math.max(0, Number(snapshot?.lastPosition) || 0);
      record.watchedSeconds = Math.max(0, Number(snapshot?.watchedSeconds) || record.watchedSeconds || 0);
      record.trashedAt = 0;
      if (Number(snapshot?.committedAt) > 0 || record.watchedSeconds >= MIN_COMMIT_WATCH_SECONDS) {
        record.committedAt = Number(snapshot?.committedAt) || record.committedAt || Date.now();
      }
      record.lastSeenAt = Date.now();
      record.updatedAt = Date.now();
      library.videos[id] = record;
    });
    return saved.videos[id] || null;
  }

  async function trashVideo(id) {
    return mutateLibrary((library) => {
      if (!library.videos[id]) {
        return;
      }
      library.videos[id].trashedAt = Date.now();
      library.videos[id].updatedAt = Date.now();
    });
  }

  async function removeVideo(id) {
    return mutateLibrary((library) => {
      delete library.videos[id];
    });
  }

  function getResumeTime(record) {
    if (!record || isFinished(record) || !isCommitted(record)) {
      return 0;
    }
    const position = Math.max(0, Number(record.lastPosition) || 0);
    return position >= MIN_RESUME_SECONDS ? position : 0;
  }

  function listUnfinishedVideos(library) {
    return Object.values(library?.videos || {})
      .map((record) => normalizeRecord(record.id, record))
      .filter((record) => !isFinished(record))
      .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  if (extensionApi?.storage?.onChanged) {
    extensionApi.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) {
        return;
      }
      cachedLibrary = pruneLibrary(changes[STORAGE_KEY].newValue || { videos: {} });
    });
  }

  globalThis.BetterXplayerDB = {
    STORAGE_KEY,
    MIN_COMMIT_WATCH_SECONDS,
    extensionApi,
    isTrackableDuration,
    loadLibrary,
    saveLibrary,
    upsertVideoProgress,
    trashVideo,
    removeVideo,
    getResumeTime,
    listUnfinishedVideos,
    formatTime
  };
})();
