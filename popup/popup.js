(function () {
  const DB = globalThis.BetterXplayerDB;
  const list = document.getElementById("list");
  let loading = false;

  function getActiveTab() {
    const api = DB.extensionApi;
    if (!api?.tabs?.query) {
      return null;
    }
    if (api.tabs.query.length <= 1) {
      return api.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs?.[0] || null);
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

  function iconNode(pathData) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }

  function createPreview(video) {
    const preview = document.createElement("div");
    preview.className = "preview";

    if (video.poster) {
      const img = document.createElement("img");
      img.src = video.poster;
      img.alt = "";
      preview.appendChild(img);
      return preview;
    }

    const fallback = document.createElement("div");
    fallback.className = "preview-fallback";
    fallback.setAttribute("aria-hidden", "true");
    fallback.appendChild(iconNode("M8 6.5 17 12l-9 5.5v-11Z"));
    preview.appendChild(fallback);
    return preview;
  }

  function createActionLink(video) {
    if (!video.tweetUrl) {
      return null;
    }
    const link = document.createElement("a");
    link.className = "link";
    link.href = video.tweetUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.dataset.openUrl = video.tweetUrl;
    link.setAttribute("aria-label", "Open post");
    link.title = "Open post";
    link.appendChild(iconNode("M14 5h5v5h-1.5V7.56l-7.97 7.97-1.06-1.06 7.97-7.97H14V5ZM6 7h5v1.5H7.5v8h8V13H17v5H6V7Z"));
    return link;
  }

  function createDeleteButton(video) {
    const button = document.createElement("button");
    button.className = "button delete";
    button.type = "button";
    button.dataset.trashId = video.id;
    button.setAttribute("aria-label", "Delete video");
    button.title = "Delete video";
    button.appendChild(iconNode("M9 5h6l1 1h4v1.5H4V6h4l1-1Zm1 5h1.5v7H10v-7Zm4 0H12.5v7H14v-7ZM7.5 9H9v7H7.5V9Zm9 10h-9a2 2 0 0 1-2-2V8h13v9a2 2 0 0 1-2 2Z"));
    return button;
  }

  function createItem(video) {
    const article = document.createElement("article");
    article.className = "item";

    const row = document.createElement("div");
    row.className = "row";

    row.appendChild(createPreview(video));

    const right = document.createElement("div");
    right.className = "right";

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = video.title || "X video";
    right.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "meta";

    const author = document.createElement("span");
    author.textContent = video.author || "X";
    meta.appendChild(author);

    const dot = document.createElement("span");
    dot.textContent = " · ";
    meta.appendChild(dot);

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = DB.formatTime(video.lastPosition || 0);
    meta.appendChild(time);

    right.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const open = createActionLink(video);
    if (open) {
      actions.appendChild(open);
    }
    actions.appendChild(createDeleteButton(video));

    right.appendChild(actions);
    row.appendChild(right);
    article.appendChild(row);
    return article;
  }

  function render(videos) {
    list.replaceChildren();
    if (!videos.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nothing unfinished right now.";
      list.appendChild(empty);
      return;
    }
    for (const video of videos) {
      list.appendChild(createItem(video));
    }
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
    const target = event.target instanceof Element ? event.target : null;
    const trashButton = target?.closest("[data-trash-id]");
    if (trashButton) {
      await DB.trashVideo(trashButton.getAttribute("data-trash-id"));
      await renderFromStorage();
      return;
    }
    const openLink = target?.closest("[data-open-url]");
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
