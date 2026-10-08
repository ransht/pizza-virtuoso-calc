// Google Analytics 4, loaded only after the visitor agrees — the same
// property, consent wording and behaviour as pizzavirtuoso.co.il. Until
// consent is given nothing is loaded and events are dropped.

import { CONFIG } from "./config.js";

const STORAGE_KEY = "pizza-virtuoso-analytics-consent";
const measurementId = CONFIG.analyticsId;
const enabled = /^G-[A-Z0-9]+$/i.test(measurementId ?? "");

let loaded = false;

function loadAnalytics() {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

function readChoice() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeChoice(choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage blocked (e.g. private browsing): the choice holds for this visit only.
  }
}

export function track(name, payload = {}) {
  if (loaded) window.gtag("event", name, payload);
}

export function initAnalyticsConsent() {
  const panel = document.getElementById("analyticsConsent");
  const settings = document.getElementById("analyticsSettings");
  if (!enabled || !panel || !settings) return;

  const applyChoice = (choice) => {
    panel.hidden = true;
    settings.hidden = false;
    if (choice === "granted") loadAnalytics();
  };

  const saved = readChoice();
  if (saved === "granted" || saved === "denied") applyChoice(saved);
  else panel.hidden = false;

  document.getElementById("analyticsAccept").addEventListener("click", () => {
    writeChoice("granted");
    applyChoice("granted");
  });
  document.getElementById("analyticsReject").addEventListener("click", () => {
    writeChoice("denied");
    applyChoice("denied");
  });
  settings.addEventListener("click", () => {
    panel.hidden = false;
    panel.querySelector("button").focus();
  });
}
