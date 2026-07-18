/**
 * food-inside — app.js
 * SPA logic: load data, search, detail view, dynamic theming.
 * Stack: jQuery 3.7 + Bootstrap 5.3 (no framework beyond that)
 */

"use strict";

/* ── Constants ───────────────────────────────────────────────── */
const DATA_SOURCES = [
  { file: "data/fruits.json",     category: "Fruit"     },
  { file: "data/vegetables.json", category: "Vegetable" },
  { file: "data/grains.json",     category: "Grain"     },
  { file: "data/nuts.json",       category: "Nut"       },
];

const CATEGORY_EMOJI = {
  Fruit:     "🍎",
  Vegetable: "🥦",
  Grain:     "🌾",
  Nut:       "🥜",
};

const BENEFIT_ICONS = {
  eyes:      "👁️",
  bones:     "🦴",
  skin:      "✨",
  heart:     "❤️",
  brain:     "🧠",
  digestion: "🌀",
  immunity:  "🛡️",
  blood:     "🩸",
};

const EAT_ICONS = {
  raw:    "🥗",
  boiled: "♨️",
  steamed:"💨",
  juice:  "🥤",
  cooked: "🍳",
};

/**
 * Maps a colour name (from basic_information.color) to a theme key.
 * Falls back to "green" for unknowns.
 */
const COLOR_THEME_MAP = {
  red:    "red",    crimson: "red",
  green:  "green",  lime: "green",
  yellow: "yellow", golden: "yellow", gold: "yellow",
  orange: "orange",
  purple: "purple", violet: "purple", lavender: "purple",
  brown:  "brown",  tan: "brown", beige: "brown",
  white:  "white",  cream: "white", ivory: "white",
  blue:   "blue",   indigo: "blue",
  pink:   "pink",   rose: "pink",
  black:  "black",  dark: "black",
};

/* ── State ───────────────────────────────────────────────────── */
let allItems       = [];
let activeCategory = "all";
let searchTimer    = null;
let lastQuery      = "";

/* ── Bootstrap ───────────────────────────────────────────────── */
$(function () {
  loadAllData();
  bindEvents();
});

/* ── Data loading ────────────────────────────────────────────── */
function loadAllData() {
  const requests = DATA_SOURCES.map(({ file, category }) =>
    $.getJSON(file).then(data => {
      const items = Array.isArray(data) ? data : [];
      items.forEach(item => { item._category = category; });
      return items;
    })
  );

  $.when(...requests)
    .done((...results) => {
      // $.when flattens single results, wraps multiple — normalise
      results.forEach(result => {
        const items = Array.isArray(result[0]) ? result[0] : result;
        if (Array.isArray(items)) allItems = allItems.concat(items);
      });
      $("#loading-indicator").addClass("d-none");
      renderResults(allItems);
    })
    .fail(() => {
      $("#loading-indicator").html(
        '<p class="text-danger">Failed to load food data. Ensure JSON files are present and the page is served via a local server.</p>'
      );
    });
}

/* ── Event bindings ──────────────────────────────────────────── */
function bindEvents() {
  // Search with debounce
  $("#search-input").on("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(), 250);
  });

  // Category filter pills
  $(document).on("click", ".fi-pill", function () {
    $(".fi-pill").removeClass("fi-pill-active");
    $(this).addClass("fi-pill-active");
    activeCategory = $(this).data("cat");
    doSearch();
  });

  // Result card click → detail
  $(document).on("click", ".fi-result-card", function () {
    const idx = $(this).data("idx");
    showDetail(allItems[idx]);
  });

  // Back button
  $("#back-btn").on("click", showSearch);

  // Brand logo → back to search
  $("#brand-home").on("click", function (e) {
    e.preventDefault();
    showSearch();
  });
}

/* ── Search ──────────────────────────────────────────────────── */
function doSearch() {
  const query = $("#search-input").val().trim().toLowerCase();
  lastQuery = query;

  let filtered = activeCategory === "all"
    ? allItems
    : allItems.filter(item => item._category === activeCategory);

  if (query) {
    filtered = filtered.filter(item => itemMatchesQuery(item, query));
  }

  renderResults(filtered);
}

/**
 * Flatten all leaf string/number values of an item into one string,
 * then test whether the query appears in it.
 */
function itemMatchesQuery(item, query) {
  const text = flattenToString(item).toLowerCase();
  return text.includes(query);
}

function flattenToString(obj) {
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  if (Array.isArray(obj)) return obj.map(flattenToString).join(" ");
  if (obj && typeof obj === "object") return Object.values(obj).map(flattenToString).join(" ");
  return "";
}

/* ── Render results grid ─────────────────────────────────────── */
function renderResults(items) {
  const $grid = $("#results-grid").empty();
  const $meta = $("#results-meta");

  if (items.length === 0) {
    $meta.text("");
    $("#empty-state").removeClass("d-none");
    return;
  }

  $("#empty-state").addClass("d-none");
  $meta.text(`${items.length} result${items.length !== 1 ? "s" : ""} found`);

  items.forEach((item, idx) => {
    // Resolve global index so detail can be opened
    const globalIdx = allItems.indexOf(item);
    const info   = item.basic_information || {};
    const imgSrc = resolveImage(info.image);
    const cat    = item._category || "";
    const emoji  = CATEGORY_EMOJI[cat] || "🌱";

    const $col = $(`<div class="col"></div>`);
    const $card = $(`
      <div class="fi-result-card" data-idx="${globalIdx}" tabindex="0" role="button"
           aria-label="View details for ${escHtml(info.name || "item")}">
        <div class="fi-result-img-wrap">
          ${imgSrc
            ? `<img class="fi-result-img" src="${escHtml(imgSrc)}" alt="${escHtml(info.name || "")}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
               <div class="fi-result-img-placeholder" style="display:none">${emoji}</div>`
            : `<div class="fi-result-img-placeholder">${emoji}</div>`
          }
        </div>
        <div class="fi-result-info">
          <div class="fi-card-name">${escHtml(info.name || "Unknown")}</div>
          <div class="fi-card-cat">${cat}</div>
        </div>
      </div>
    `);

    // Keyboard: Enter / Space to open
    $card.on("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showDetail(allItems[globalIdx]);
      }
    });

    $col.append($card);
    $grid.append($col);
  });
}

/* ── Detail view ─────────────────────────────────────────────── */
function showDetail(item) {
  const info = item.basic_information || {};

  // Apply colour theme
  applyTheme(info.color);

  // Hero
  const imgSrc = resolveImage(info.image);
  $("#detail-img")
    .attr("src", imgSrc || "")
    .attr("alt", info.name || "")
    .toggle(!!imgSrc);

  $("#detail-category-badge").text(item._category || "");
  $("#detail-name").text(info.name || "");
  $("#detail-scientific").text(info.scientific_name || "").toggle(!!info.scientific_name);
  $("#detail-color span").text(info.color || "");
  $("#detail-season span").text(info.season || "");

  // Sections
  renderNutritionTable("#detail-nutrition", item.nutrition_per_100g || {});
  renderNutritionTable("#detail-vitamins",  item.vitamins || {});
  renderNutritionTable("#detail-minerals",  item.minerals || {});
  renderBenefits(item.benefits || {});
  renderEatWays(item.best_ways_to_eat || {});
  renderFacts(item.interesting_facts || []);

  // Toggle views
  $("#search-view").addClass("d-none");
  $("#detail-view").removeClass("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSearch() {
  $("#detail-view").addClass("d-none");
  $("#search-view").removeClass("d-none");
  applyTheme(null);
}

/* ── Section renderers ───────────────────────────────────────── */

/** Generic key-value table (nutrition / vitamins / minerals) */
function renderNutritionTable(selector, data) {
  const rows = Object.entries(data).map(([key, val]) => {
    const label = formatKey(key);
    return `<tr><td>${escHtml(label)}</td><td>${escHtml(String(val))}</td></tr>`;
  }).join("");

  $(selector).html(
    `<table class="fi-data-table"><tbody>${rows}</tbody></table>`
  );
}

function renderBenefits(data) {
  const html = Object.entries(data).map(([organ, text]) => {
    const icon  = BENEFIT_ICONS[organ.toLowerCase()] || "💊";
    return `
      <div class="fi-benefit-item">
        <span class="fi-benefit-icon">${icon}</span>
        <span class="fi-benefit-label">${escHtml(organ)}</span>
        <span class="fi-benefit-text">${escHtml(text)}</span>
      </div>`;
  }).join("");
  $("#detail-benefits").html(html || "<p class='text-muted'>No data available.</p>");
}

function renderEatWays(data) {
  const html = Object.entries(data).map(([method, text]) => {
    const icon = EAT_ICONS[method.toLowerCase()] || "🍽️";
    return `
      <div class="fi-eat-item">
        <span class="fi-eat-icon">${icon}</span>
        <span class="fi-eat-label">${escHtml(method)}</span>
        <span>${escHtml(text)}</span>
      </div>`;
  }).join("");
  $("#detail-eat").html(html || "<p class='text-muted'>No data available.</p>");
}

function renderFacts(facts) {
  const html = facts.map((fact, i) => `
    <div class="fi-fact">
      <span class="fi-fact-num">${i + 1}</span>
      <span>${escHtml(fact)}</span>
    </div>`
  ).join("");
  $("#detail-facts").html(html || "<p class='text-muted'>No facts available.</p>");
}

/* ── Theming ─────────────────────────────────────────────────── */
function applyTheme(colorField) {
  if (!colorField) {
    $("html").removeAttr("data-theme");
    return;
  }
  // Take first colour token, e.g. "Red, Green, Yellow" → "red"
  const first = colorField.split(/,/)[0].trim().toLowerCase();
  const theme = COLOR_THEME_MAP[first] || "green";
  $("html").attr("data-theme", theme);
}

/* ── Helpers ─────────────────────────────────────────────────── */

/** Convert JSON key like "vitamin_b1_mg" → "Vitamin B1 (mg)" */
function formatKey(key) {
  // Extract unit suffix (mg, g, kcal, mcg)
  const unitMatch = key.match(/_(mg|g|kcal|mcg|ml)$/);
  const unit = unitMatch ? unitMatch[1] : null;
  const base = unit ? key.slice(0, key.lastIndexOf("_")) : key;
  const label = base.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return unit ? `${label} (${unit})` : label;
}

/** Return image src: if starts with http → use as-is; else prefix img/ */
function resolveImage(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `img/${image}`;
}

/** Minimal HTML escaping — avoids XSS from JSON data */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
