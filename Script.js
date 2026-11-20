/*Riyam Assad || 2210283 */
"use strict";

/* =========================================================
   Quake Tracker - talks to the USGS Earthquake Catalog API
   ========================================================= */

// ---------- 1. Constants ----------
// Base URL of the USGS query endpoint (no API key needed)
const API_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

// Bounding boxes that the "Region" dropdown turns into API parameters
const REGIONS = {
  world:  null,
  arabia: { minlatitude: 10, maxlatitude: 32, minlongitude: 30,  maxlongitude: 60 },
  japan:  { minlatitude: 30, maxlatitude: 46, minlongitude: 128, maxlongitude: 146 },
  med:    { minlatitude: 30, maxlatitude: 45, minlongitude: -5,  maxlongitude: 40 }
};

// ---------- 2. Grab page elements once ----------
const form       = document.getElementById("search-form");
const magSelect  = document.getElementById("mag");
const periodSel  = document.getElementById("period");
const regionSel  = document.getElementById("region");
const limitInput = document.getElementById("limit");
const limitHint  = document.getElementById("limit-hint");
const messageEl  = document.getElementById("message");
const cardsEl    = document.getElementById("cards");
const toolbarEl  = document.getElementById("toolbar");
const coordsEl   = document.getElementById("coords");

// ---------- 3. Small helpers ----------

// Show a message to the user. type: "info" | "ok" | "error"
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "message " + type;
}

// Check that the "number of results" field holds a whole number from 1 to 50
function validateLimit() {
  const value = Number(limitInput.value);
  const valid = Number.isInteger(value) && value >= 1 && value <= 50;
  limitHint.textContent = valid ? "" : "Enter a whole number from 1 to 50.";
  limitInput.classList.toggle("invalid", !valid);
  return valid;
}

// Pick a heat class (colour) from the magnitude
function heatClass(mag) {
  if (mag >= 6) return "heat-4";
  if (mag >= 5) return "heat-3";
  if (mag >= 4) return "heat-2";
  return "heat-1";
}

// Build the request URL from the form values
function buildUrl() {
  const days = Number(periodSel.value);
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    format: "geojson",
    minmagnitude: magSelect.value,
    limit: limitInput.value,
    orderby: "time",
    starttime: start.toISOString()
  });

  // Add the bounding box only when a region (not "world") is chosen
  const box = REGIONS[regionSel.value];
  if (box) {
    Object.entries(box).forEach(([key, val]) => params.set(key, val));
  }
  return API_BASE + "?" + params.toString();
}

// ---------- 4. AJAX request (fetch + async/await) ----------
async function fetchQuakes() {
  // Stop early if the form input is invalid
  if (!validateLimit()) {
    showMessage("Fix the number of results before searching.", "error");
    return;
  }

  showMessage("Loading earthquakes...", "info");

  try {
    const response = await fetch(buildUrl());
    // fetch only fails on network problems, so check HTTP status ourselves
    if (!response.ok) {
      throw new Error("Server answered with status " + response.status);
    }
    const data = await response.json();
    displayQuakes(data.features);
  } catch (err) {
    clearCards();
    showMessage("Could not load data from USGS. Check your connection and try again.", "error");
    console.error(err);
  }
}

// ---------- 5. DOM creation ----------

// Create one earthquake card from one API feature
function createCard(feature) {
  const p = feature.properties;
  const depth = feature.geometry.coordinates[2];
  const lat = feature.geometry.coordinates[1];
  const lon = feature.geometry.coordinates[0];

  const card = document.createElement("article");
  card.className = "card " + heatClass(p.mag);
  card.dataset.coords = "Epicentre: " + lat.toFixed(2) + ", " + lon.toFixed(2);
  card.dataset.url = p.url; // store the report link (used by the double-click event)

  // Info 1: magnitude
  const mag = document.createElement("div");
  mag.className = "mag";
  mag.textContent = p.mag === null ? "n/a" : p.mag.toFixed(1);
  mag.title = "Double-click to open the USGS report";

  // Info 2: place
  const place = document.createElement("h3");
  place.textContent = p.place || "Unknown location";

  // Info 3, 4, 5: time, depth, tsunami warning
  const list = document.createElement("dl");
  const rows = [
    ["Time", new Date(p.time).toLocaleString()],
    ["Depth", depth.toFixed(1) + " km"],
    ["Tsunami", p.tsunami === 1 ? "Warning issued" : "No warning"]
  ];
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  });

  // Link to the full USGS report
  const link = document.createElement("a");
  link.href = p.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Full USGS report";

  // Button that removes just this card
  const remove = document.createElement("button");
  remove.className = "remove";
  remove.setAttribute("aria-label", "Remove this earthquake");
  remove.textContent = "\u2716";

  card.append(mag, place, list, link, remove);
  return card;
}

// Create the "Clear all" button (only exists while there are results)
function createToolbar() {
  if (toolbarEl.firstChild) return;
  const btn = document.createElement("button");
  btn.id = "clear-btn";
  btn.type = "button";
  btn.textContent = "Clear all results";
  toolbarEl.appendChild(btn);
}

// Remove the toolbar button from the page
function removeToolbar() {
  toolbarEl.replaceChildren();
}

// Remove every card and the toolbar button
function clearCards() {
  cardsEl.replaceChildren();
  removeToolbar();
  coordsEl.textContent = "";
}

// Show the list of earthquakes returned by the API
function displayQuakes(features) {
  clearCards();

  if (features.length === 0) {
    showMessage("No earthquakes match these filters. Try a lower magnitude or a longer time window.", "error");
    return;
  }

  features.forEach(f => cardsEl.appendChild(createCard(f)));
  createToolbar();
  showMessage("Showing " + features.length + " earthquake(s).", "ok");
}

// ---------- 6. Events ----------

// EVENT 1 - submit/click: search button (or Enter key) calls the API
form.addEventListener("submit", function (e) {
  e.preventDefault(); // stop the page from reloading
  fetchQuakes();
});

// EVENT 2 - keyup: validate the number field while the user types
limitInput.addEventListener("keyup", validateLimit);

// EVENT 3 - change: re-run the search when a dropdown changes
[magSelect, periodSel, regionSel].forEach(sel => {
  sel.addEventListener("change", fetchQuakes);
});

// EVENT 4 - click: handles "Clear all" and each card's remove button
// (event delegation: one listener on a parent covers dynamically created elements)
document.addEventListener("click", function (e) {
  if (e.target.id === "clear-btn") {
    clearCards();
    showMessage("Results cleared. Press Find earthquakes to load new data.", "info");
  }
  if (e.target.classList.contains("remove")) {
    e.target.closest(".card").remove(); // remove the element from the DOM
    if (cardsEl.children.length === 0) {
      clearCards();
      showMessage("All cards removed. Press Find earthquakes to load new data.", "info");
    } else {
      showMessage("Showing " + cardsEl.children.length + " earthquake(s).", "ok");
    }
  }
});

// EVENT 5 - mouseover / mouseout: show a card's coordinates under the grid
cardsEl.addEventListener("mouseover", function (e) {
  const card = e.target.closest(".card");
  if (card) coordsEl.textContent = card.dataset.coords;
});
cardsEl.addEventListener("mouseout", function () {
  coordsEl.textContent = "";
});

// EVENT 6 - dblclick: double-click the magnitude to open the USGS report,
// or double-click anywhere else on the card to pin / unpin it
cardsEl.addEventListener("dblclick", function (e) {
  if (e.target.classList.contains("remove")) return; // ignore the remove button
  const card = e.target.closest(".card");
  if (!card) return;

  // Double-click on the big magnitude number: open the full report
  if (e.target.classList.contains("mag")) {
    window.open(card.dataset.url, "_blank", "noopener");
    return;
  }

  // Double-click elsewhere: toggle the pinned look
  card.classList.toggle("pinned");
  const place = card.querySelector("h3").textContent;
  if (card.classList.contains("pinned")) {
    showMessage("Pinned: " + place, "ok");
  } else {
    showMessage("Unpinned: " + place, "info");
  }
});

// ---------- 7. First load ----------
fetchQuakes();