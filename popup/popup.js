(function () {
  const DB = globalThis.BetterXplayerDB;
  const list = document.getElementById("list");
  let loading = false;

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function getActiveTab() {
    const api = DB.extensionApi;
    if (!api?.tabs?.query) {
      return null;
    }
    if (api.tabs.query.length <= 1) {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      return tabs?.[0] || null;
    }
    return new Promise((resolve) => {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });
  }

  async function requestCurrentVideoFlush() {
    const api = DB.extensionApi;
    const tab = await getActiveTab();
    if (!api?.tabs?.sendMessage || !tab?.id) {
      return;
    }
    if (api.tabs.sendMessage.length <= 2) {
      try {
        await api.tabs.sendMessage(tab.id, { type: "betterxplayer:get-current-video" });
      } catch {}
      return;
    }
    await new Promise((resolve) => {
      try {
        api.tabs.sendMessage(tab.id, { type: "betterxplayer:get-current-video" }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  async function openUrl(url) {
    const api = DB.extensionApi;
    if (!url || !api?.tabs?.create) {
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (api.tabs.create.length <= 1) {
      try {
        await api.tabs.create({ url });
        return;
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    }
    await new Promise((resolve) => {
      api.tabs.create({ url }, () => resolve());
    });
  }

  function render(videos) {
    if (!videos.length) {
      list.innerHTML = '<div class="empty">Nothing unfinished right now.</div>';
      return;
    }

    list.innerHTML = videos.map((video) => `
      <article class="item">
        <div class="row">
          <div class="preview">
            ${video.poster ? `<img src="${escapeHtml(video.poster)}" alt="">` : `
              <div class="preview-fallback" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 6.5 17 12l-9 5.5v-11Z"></path></svg>
              </div>
            `}
          </div>
          <div class="right">
            <p class="title">${escapeHtml(video.title)}</p>
            <p class="meta">
              <span>${escapeHtml(video.author || "X")}</span>
              <span> · </span>
              <span class="time">${escapeHtml(DB.formatTime(video.lastPosition || 0))}</span>
            </p>
            <div class="actions">
              ${video.tweetUrl ? `
                <a
                  class="link"
                  href="${escapeHtml(video.tweetUrl)}"
                  target="_blank"
                  rel="noreferrer"
                  data-open-url="${escapeHtml(video.tweetUrl)}"
                  aria-label="Open post"
                  title="Open post"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5h-1.5V7.56l-7.97 7.97-1.06-1.06 7.97-7.97H14V5ZM6 7h5v1.5H7.5v8h8V13H17v5H6V7Z"></path></svg>
                </a>
              ` : ""}
              <button
                class="button delete"
                type="button"
                data-trash-id="${escapeHtml(video.id)}"
                aria-label="Delete video"
                title="Delete video"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6l1 1h4v1.5H4V6h4l1-1Zm1 5h1.5v7H10v-7Zm4 0H12.5v7H14v-7ZM7.5 9H9v7H7.5V9Zm9 10h-9a2 2 0 0 1-2-2V8h13v9a2 2 0 0 1-2 2Z"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    `).join("");
  }

  async function renderFromStorage() {
    const library = await DB.loadLibrary();
    render(DB.listUnfinishedVideos(library));
  }

  async function load() {
    if (loading) {
      return;
    }
    loading = true;
    try {
      await requestCurrentVideoFlush();
      await renderFromStorage();
    } finally {
      loading = false;
    }
  }

  list.addEventListener("click", async (event) => {
    const trashButton = event.target.closest("[data-trash-id]");
    if (trashButton) {
      await DB.trashVideo(trashButton.getAttribute("data-trash-id"));
      await renderFromStorage();
      return;
    }
    const openLink = event.target.closest("[data-open-url]");
    if (openLink) {
      event.preventDefault();
      await openUrl(openLink.getAttribute("data-open-url"));
    }
  });

  if (DB.extensionApi?.storage?.onChanged) {
    DB.extensionApi.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[DB.STORAGE_KEY]) {
        renderFromStorage();
      }
    });
  }

  load();
})();
