"use strict";

/* =========================================================
   Quake Tracker - talks to the USGS Earthquake Catalog API
   ========================================================= */


const API_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

const REGIONS = {
  world:  null,
  arabia: { minlatitude: 10, maxlatitude: 32, minlongitude: 30,  maxlongitude: 60 },
  japan:  { minlatitude: 30, maxlatitude: 46, minlongitude: 128, maxlongitude: 146 },
  med:    { minlatitude: 30, maxlatitude: 45, minlongitude: -5,  maxlongitude: 40 }
};

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


function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "message " + type;
}

function validateLimit() {
  const value = Number(limitInput.value);
  const valid = Number.isInteger(value) && value >= 1 && value <= 50;
  limitHint.textContent = valid ? "" : "Enter a whole number from 1 to 50.";
  limitInput.classList.toggle("invalid", !valid);
  return valid;
}

function heatClass(mag) {
  if (mag >= 6) return "heat-4";
  if (mag >= 5) return "heat-3";
  if (mag >= 4) return "heat-2";
  return "heat-1";
}

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

  const box = REGIONS[regionSel.value];
  if (box) {
    Object.entries(box).forEach(([key, val]) => params.set(key, val));
  }
  return API_BASE + "?" + params.toString();
}

async function fetchQuakes() {
  
  if (!validateLimit()) {
    showMessage("Fix the number of results before searching.", "error");
    return;
  }

  showMessage("Loading earthquakes...", "info");

  try {
    const response = await fetch(buildUrl());
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

function createCard(feature) {
  const p = feature.properties;
  const depth = feature.geometry.coordinates[2];
  const lat = feature.geometry.coordinates[1];
  const lon = feature.geometry.coordinates[0];

  const card = document.createElement("article");
  card.className = "card " + heatClass(p.mag);
  card.dataset.coords = "Epicentre: " + lat.toFixed(2) + ", " + lon.toFixed(2);

  const mag = document.createElement("div");
  mag.className = "mag";
  mag.textContent = p.mag === null ? "n/a" : p.mag.toFixed(1);

  const place = document.createElement("h3");
  place.textContent = p.place || "Unknown location";

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

  const link = document.createElement("a");
  link.href = p.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Full USGS report";

  const remove = document.createElement("button");
  remove.className = "remove";
  remove.setAttribute("aria-label", "Remove this earthquake");
  remove.textContent = "\u2716";

  card.append(mag, place, list, link, remove);
  return card;
}

function createToolbar() {
  if (toolbarEl.firstChild) return;
  const btn = document.createElement("button");
  btn.id = "clear-btn";
  btn.type = "button";
  btn.textContent = "Clear all results";
  toolbarEl.appendChild(btn);
}
function removeToolbar() {
  toolbarEl.replaceChildren();
}

function clearCards() {
  cardsEl.replaceChildren();
  removeToolbar();
  coordsEl.textContent = "";
}

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


form.addEventListener("submit", function (e) {
  e.preventDefault(); 
  fetchQuakes();
});
limitInput.addEventListener("keyup", validateLimit);

[magSelect, periodSel, regionSel].forEach(sel => {
  sel.addEventListener("change", fetchQuakes);
});

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

cardsEl.addEventListener("mouseover", function (e) {
  const card = e.target.closest(".card");
  if (card) coordsEl.textContent = card.dataset.coords;
});
cardsEl.addEventListener("mouseout", function () {
  coordsEl.textContent = "";
});
fetchQuakes();