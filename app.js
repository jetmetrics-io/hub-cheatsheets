(function () {
  // Files (data.json, PDFs, thumbnails) are always loaded from GitHub Pages,
  // regardless of where this script itself runs (standalone or embedded natively in Tilda).
  var ASSET_BASE = "https://jetmetrics-static.storage.yandexcloud.net/hub-cheatsheets/";

  var state = {
    items: [],
    tagLabels: {},
    activeTags: new Set(),
    query: "",
  };

  // Brand rule: one colored accent word in the display title. Done here (not in
  // the Tilda-pasted skeleton) so this stays a CSS/JS-only change.
  var titleEl = document.querySelector(".jm-cs-title");
  if (titleEl) {
    titleEl.innerHTML = 'Библиотека читшитов по <span class="jm-accent">аналитике</span>';
  }

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
    zoom: document.getElementById("jm-cs-zoom"),
    zoomScroll: document.getElementById("jm-cs-zoom-scroll"),
    zoomImg: document.getElementById("jm-cs-zoom-img"),
    zoomClose: document.getElementById("jm-cs-zoom-close"),
  };

  // Читшит считается новым NEW_DAYS дней от даты публикации (published_at, YYYY-MM-DD).
  // Бейдж гаснет сам — снимать руками ничего не нужно.
  // 30 дней под ритм выкладки: пачка выходит примерно раз в месяц, так «Новое»
  // держится до следующей пачки и в библиотеке всегда есть свежий блок.
  var NEW_DAYS = 30;

  function daysSincePublished(item) {
    if (!item.published_at) return null;
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.published_at);
    if (!p) return null;
    var then = Date.UTC(+p[1], +p[2] - 1, +p[3]);
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - then) / 86400000);
  }

  function isNew(item) {
    var d = daysSincePublished(item);
    return d !== null && d >= 0 && d < NEW_DAYS;
  }

  // Вся сетка — по убыванию публичного номера: чем больше номер, тем выше карточка,
  // поэтому свежая пачка всегда наверху. Номер берётся из заголовка «№N — …»,
  // записи без номера уходят в конец.
  function publicNum(item) {
    var m = /^№(\d+)/.exec(item.title || "");
    return m ? +m[1] : -1;
  }

  function sortByNumberDesc(items) {
    return items.slice().sort(function (a, b) { return publicNum(b) - publicNum(a); });
  }

  fetch(ASSET_BASE + "data.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.items = sortByNumberDesc(data.items);
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
        // Single-select, like the compilations pages: a click shows only this
        // category; clicking the active one again (or "Все") clears back to all.
        if (state.activeTags.has(tagId)) {
          state.activeTags.clear();
        } else {
          state.activeTags = new Set([tagId]);
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

  var TITLE_NUM_RE = /^№(\d+)\s*—\s*(.*)$/;

  function renderTitle(container, title) {
    var m = TITLE_NUM_RE.exec(title);
    container.innerHTML = "";
    if (!m) {
      container.textContent = title;
      return;
    }
    var num = document.createElement("span");
    num.className = "jm-cs-num";
    num.textContent = m[1];
    container.appendChild(num);
    container.appendChild(document.createTextNode(" " + m[2]));
  }

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

    if (filtered.length === 0) {
      els.empty.innerHTML =
        '<span class="jm-cs-empty-icon">' +
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.75"/>' +
        '<line x1="13.6" y1="13.6" x2="18" y2="18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
        '</svg></span>' +
        "<h3>Ничего не нашлось</h3>" +
        "<p>Попробуйте другой запрос или сбросьте фильтры.</p>" +
        '<button type="button" class="jm-btn jm-btn--secondary" id="jm-cs-empty-reset">Сбросить фильтры</button>';
      var emptyResetBtn = document.getElementById("jm-cs-empty-reset");
      if (emptyResetBtn) {
        emptyResetBtn.addEventListener("click", function () {
          els.resetFilters.click();
        });
      }
    }

    filtered.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "jm-cs-card";
      card.addEventListener("click", function () { openLightbox(item); });

      var thumbWrap = document.createElement("div");
      thumbWrap.className = "jm-cs-card-thumb-wrap";
      var img = document.createElement("img");
      img.src = ASSET_BASE + item.thumb;
      img.loading = "lazy";
      img.alt = item.title;
      thumbWrap.appendChild(img);
      card.appendChild(thumbWrap);

      var body = document.createElement("div");
      body.className = "jm-cs-card-body";

      var title = document.createElement("div");
      title.className = "jm-cs-card-title";
      renderTitle(title, item.title);
      if (isNew(item)) {
        // Бейдж перед номером: при сканировании столбца заголовков «Новое»
        // попадается первым. На превью его класть нельзя — у читшитов заголовок
        // идёт сверху во всю ширину, плашка перекрывала бы текст самой картинки.
        var badge = document.createElement("span");
        badge.className = "jm-cs-card-new";
        badge.textContent = "Новое";
        title.insertBefore(badge, title.firstChild);
      }
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
    els.lightboxImg.src = ASSET_BASE + item.thumb;
    els.lightboxImg.alt = item.title;
    renderTitle(els.lightboxTitle, item.title);
    els.lightboxTags.innerHTML = "";
    item.tags.forEach(function (t) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "jm-cs-lightbox-tag";
      chip.textContent = state.tagLabels[t] || t;
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        closeLightbox();
        filterByTag(t);
      });
      els.lightboxTags.appendChild(chip);
    });
    els.lightboxDownload.href = ASSET_BASE + item.pdf;
    // Force open-in-new-tab even if the already-embedded Tilda skeleton still has
    // a leftover download attribute from before this element was made dynamic.
    els.lightboxDownload.removeAttribute("download");
    els.lightboxDownload.target = "_blank";
    els.lightboxDownload.rel = "noopener";
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
    if (els.zoom && !els.zoom.hidden) {
      els.zoom.hidden = true;
      els.zoom.classList.remove("is-full");
    }
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

  // Fullscreen zoom: click the lightbox image -> open it full-screen (fit to
  // height). Click the full-screen image -> toggle 100% real-pixel zoom.
  els.lightboxImg.addEventListener("click", function () {
    if (!state.currentItem) return;
    openZoom(state.currentItem);
  });

  function openZoom(item) {
    els.zoomImg.src = ASSET_BASE + item.thumb;
    els.zoomImg.alt = item.title;
    els.zoom.classList.remove("is-full");
    els.zoom.hidden = false;
    els.zoomScroll.scrollTop = 0;
    els.zoomScroll.scrollLeft = 0;
  }

  function closeZoom() {
    els.zoom.hidden = true;
    els.zoom.classList.remove("is-full");
  }

  els.zoomImg.addEventListener("click", function () {
    var goingFull = !els.zoom.classList.contains("is-full");
    els.zoom.classList.toggle("is-full");
    if (goingFull) {
      // Center the 100% view roughly on where the page starts.
      els.zoomScroll.scrollTop = 0;
      els.zoomScroll.scrollLeft = (els.zoomImg.clientWidth - els.zoomScroll.clientWidth) / 2;
    }
  });

  els.zoomClose.addEventListener("click", closeZoom);
  // Click the dark margin (not the image) closes too.
  els.zoomScroll.addEventListener("click", function (e) {
    if (e.target === els.zoomScroll) closeZoom();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!els.zoom.hidden) { closeZoom(); return; }
    if (!els.lightbox.hidden) closeLightbox();
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

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(textarea);
      if (ok) resolve(); else reject(new Error("copy failed"));
    });
  }

  els.lightboxShare.addEventListener("click", function () {
    if (!state.currentItem) return;
    var url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("cs", state.currentItem.id);
    copyToClipboard(url.toString()).then(function () {
      els.lightboxShare.innerHTML = ICON_CHECK;
      els.lightboxShare.classList.add("copied");
      els.lightboxShare.title = "Скопировано!";
      clearTimeout(shareResetTimer);
      shareResetTimer = setTimeout(resetShareIcon, 1800);
    }).catch(function () {
      els.lightboxShare.title = "Не удалось скопировать";
    });
  });
})();
