(function () {
  var state = {
    items: [],
    tagLabels: {},
    activeTags: new Set(),
    query: "",
  };

  var els = {
    tags: document.getElementById("jm-cs-tags"),
    grid: document.getElementById("jm-cs-grid"),
    count: document.getElementById("jm-cs-count"),
    empty: document.getElementById("jm-cs-empty"),
    search: document.getElementById("jm-cs-search-input"),
    lightbox: document.getElementById("jm-cs-lightbox"),
    lightboxBackdrop: document.getElementById("jm-cs-lightbox-backdrop"),
    lightboxClose: document.getElementById("jm-cs-lightbox-close"),
    lightboxImg: document.getElementById("jm-cs-lightbox-img"),
    lightboxTitle: document.getElementById("jm-cs-lightbox-title"),
    lightboxTags: document.getElementById("jm-cs-lightbox-tags"),
    lightboxDownload: document.getElementById("jm-cs-lightbox-download"),
    lightboxShare: document.getElementById("jm-cs-lightbox-share"),
    lightboxTg: document.getElementById("jm-cs-lightbox-tg"),
    resetFilters: document.getElementById("jm-cs-reset-filters"),
  };

  fetch("data.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.items = data.items;
      state.tagLabels = data.tags;
      renderTagPills();
      render();
      openFromUrl();
    })
    .catch(function (err) {
      els.grid.innerHTML = "<p style='color:#b00'>Не удалось загрузить data.json: " + err + "</p>";
    });

  function openFromUrl() {
    var id = new URLSearchParams(window.location.search).get("cs");
    if (!id) return;
    var item = state.items.find(function (i) { return i.id === id; });
    if (item) openLightbox(item, { pushState: false });
  }

  function renderTagPills() {
    var allPill = document.createElement("button");
    allPill.className = "jm-cs-tag-pill all active";
    allPill.textContent = "Все";
    allPill.addEventListener("click", function () {
      state.activeTags.clear();
      updatePillStates();
      render();
    });
    els.tags.appendChild(allPill);

    // count usage per tag to order by frequency
    var counts = {};
    state.items.forEach(function (item) {
      item.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });

    var tagIds = Object.keys(state.tagLabels).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0);
    });

    tagIds.forEach(function (tagId) {
      if (!counts[tagId]) return;
      var pill = document.createElement("button");
      pill.className = "jm-cs-tag-pill";
      pill.dataset.tag = tagId;
      pill.textContent = state.tagLabels[tagId];
      pill.addEventListener("click", function () {
        if (state.activeTags.has(tagId)) {
          state.activeTags.delete(tagId);
        } else {
          state.activeTags.add(tagId);
        }
        updatePillStates();
        render();
      });
      els.tags.appendChild(pill);
    });
  }

  function updatePillStates() {
    var pills = els.tags.querySelectorAll(".jm-cs-tag-pill");
    pills.forEach(function (pill) {
      if (pill.classList.contains("all")) {
        pill.classList.toggle("active", state.activeTags.size === 0);
      } else {
        pill.classList.toggle("active", state.activeTags.has(pill.dataset.tag));
      }
    });
  }

  els.search.addEventListener("input", function (e) {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  function matches(item) {
    if (state.activeTags.size > 0) {
      var hasTag = item.tags.some(function (t) { return state.activeTags.has(t); });
      if (!hasTag) return false;
    }
    if (state.query && item.title.toLowerCase().indexOf(state.query) === -1) {
      return false;
    }
    return true;
  }

  function filterByTag(tagId) {
    state.activeTags = new Set([tagId]);
    updatePillStates();
    render();
    els.tags.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  els.resetFilters.addEventListener("click", function () {
    state.activeTags.clear();
    state.query = "";
    els.search.value = "";
    updatePillStates();
    render();
  });

  function render() {
    var filtered = state.items.filter(matches);
    els.grid.innerHTML = "";
    els.count.textContent = filtered.length + " из " + state.items.length + " читшитов";
    els.empty.hidden = filtered.length > 0;
    els.resetFilters.hidden = state.activeTags.size === 0 && !state.query;

    filtered.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "jm-cs-card";
      card.addEventListener("click", function () { openLightbox(item); });

      var thumbWrap = document.createElement("div");
      thumbWrap.className = "jm-cs-card-thumb-wrap";
      var img = document.createElement("img");
      img.src = item.thumb;
      img.loading = "lazy";
      img.alt = item.title;
      thumbWrap.appendChild(img);
      card.appendChild(thumbWrap);

      var body = document.createElement("div");
      body.className = "jm-cs-card-body";

      var title = document.createElement("div");
      title.className = "jm-cs-card-title";
      title.textContent = item.title;
      body.appendChild(title);

      var tagsWrap = document.createElement("div");
      tagsWrap.className = "jm-cs-card-tags";
      item.tags.forEach(function (t) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "jm-cs-card-tag";
        chip.textContent = state.tagLabels[t] || t;
        chip.addEventListener("click", function (e) {
          e.stopPropagation();
          filterByTag(t);
        });
        tagsWrap.appendChild(chip);
      });
      body.appendChild(tagsWrap);

      card.appendChild(body);
      els.grid.appendChild(card);
    });
  }

  function openLightbox(item, opts) {
    opts = opts || {};
    state.currentItem = item;
    els.lightboxImg.src = item.thumb;
    els.lightboxImg.alt = item.title;
    els.lightboxTitle.textContent = item.title;
    els.lightboxTags.innerHTML = "";
    item.tags.forEach(function (t) {
      var chip = document.createElement("span");
      chip.className = "jm-cs-lightbox-tag";
      chip.textContent = state.tagLabels[t] || t;
      els.lightboxTags.appendChild(chip);
    });
    els.lightboxDownload.href = item.pdf;
    els.lightboxDownload.setAttribute("download", item.title + ".pdf");
    if (item.tg_post) {
      els.lightboxTg.href = item.tg_post;
      els.lightboxTg.hidden = false;
    } else {
      els.lightboxTg.hidden = true;
    }
    resetShareIcon();
    els.lightbox.hidden = false;
    document.body.style.overflow = "hidden";

    if (opts.pushState !== false) {
      var url = new URL(window.location.href);
      url.searchParams.set("cs", item.id);
      history.pushState({ csId: item.id }, "", url);
    }
  }

  function closeLightbox(opts) {
    opts = opts || {};
    els.lightbox.hidden = true;
    document.body.style.overflow = "";
    state.currentItem = null;

    if (opts.popState !== false) {
      var url = new URL(window.location.href);
      if (url.searchParams.has("cs")) {
        url.searchParams.delete("cs");
        history.pushState({}, "", url);
      }
    }
  }

  els.lightboxBackdrop.addEventListener("click", function () { closeLightbox(); });
  els.lightboxClose.addEventListener("click", function () { closeLightbox(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.lightbox.hidden) closeLightbox();
  });

  window.addEventListener("popstate", function () {
    var id = new URLSearchParams(window.location.search).get("cs");
    if (id) {
      var item = state.items.find(function (i) { return i.id === id; });
      if (item) openLightbox(item, { pushState: false });
    } else {
      closeLightbox({ popState: false });
    }
  });

  var ICON_LINK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6.5 9.5L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M7.8 4.8L8.8 3.8C9.9 2.7 11.6 2.7 12.7 3.8C13.8 4.9 13.8 6.6 12.7 7.7L11.7 8.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M8.2 11.2L7.2 12.2C6.1 13.3 4.4 13.3 3.3 12.2C2.2 11.1 2.2 9.4 3.3 8.3L4.3 7.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';
  var ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var shareResetTimer = null;

  function resetShareIcon() {
    clearTimeout(shareResetTimer);
    els.lightboxShare.innerHTML = ICON_LINK;
    els.lightboxShare.classList.remove("copied");
    els.lightboxShare.title = "Скопировать ссылку";
  }

  els.lightboxShare.addEventListener("click", function () {
    if (!state.currentItem) return;
    var url = new URL(window.location.href);
    url.searchParams.set("cs", state.currentItem.id);
    navigator.clipboard.writeText(url.toString()).then(function () {
      els.lightboxShare.innerHTML = ICON_CHECK;
      els.lightboxShare.classList.add("copied");
      els.lightboxShare.title = "Скопировано!";
      clearTimeout(shareResetTimer);
      shareResetTimer = setTimeout(resetShareIcon, 1800);
    });
  });
})();
