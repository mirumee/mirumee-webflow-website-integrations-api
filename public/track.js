(function () {
  // Sends a GA4 event through gtag (loaded by Webflow's Google integration),
  // falling back to dataLayer if gtag is not defined yet.
  function track(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  window.mirumeeTrack = track;

  // Campaign attribution for the current visit, kept in a session cookie so it
  // survives navigation from the landing page to /contact. A new entry to the
  // site without campaign params clears it.
  const ATTR_COOKIE = "mrm_attr";
  const ATTR_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
  ];

  function isMirumeeHost(host) {
    return host === "mirumee.com" || /\.mirumee\.com$/.test(host);
  }

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value) {
    let cookie =
      name + "=" + encodeURIComponent(value) + "; path=/; SameSite=Lax";
    if (isMirumeeHost(location.hostname)) cookie += "; domain=.mirumee.com";
    document.cookie = cookie;
  }

  function deleteCookie(name) {
    let cookie = name + "=; path=/; max-age=0";
    if (isMirumeeHost(location.hostname)) cookie += "; domain=.mirumee.com";
    document.cookie = cookie;
  }

  function captureAttribution() {
    const search = new URLSearchParams(location.search);
    const attr = {};
    ATTR_PARAMS.forEach(function (key) {
      const value = search.get(key);
      if (value) attr[key] = value;
    });

    if (Object.keys(attr).length > 0) {
      attr.landing_page = location.origin + location.pathname;
      if (document.referrer) attr.referrer = document.referrer;
      setCookie(ATTR_COOKIE, JSON.stringify(attr));
      return;
    }

    let referrerHost = "";
    try {
      referrerHost = document.referrer
        ? new URL(document.referrer).hostname
        : "";
    } catch {
      // ignore malformed value
    }
    const isInternal =
      referrerHost &&
      (referrerHost === location.hostname || isMirumeeHost(referrerHost));
    if (!isInternal) deleteCookie(ATTR_COOKIE);
  }

  // "_ga" = "GA1.1.<random>.<timestamp>" -> "<random>.<timestamp>"
  function getGaClientId() {
    const value = getCookie("_ga");
    if (!value) return undefined;
    const parts = value.split(".");
    return parts.length >= 4 ? parts.slice(-2).join(".") : undefined;
  }

  // "_ga_<ID>" = "GS1.1.<session_id>...." or "GS2.1.s<session_id>$o1$g1..."
  function getGaSessionId() {
    const match = document.cookie.match(/(?:^|; )_ga_[^=]+=([^;]*)/);
    if (!match) return undefined;
    const value = decodeURIComponent(match[1]);
    const gs2 = value.match(/^GS2\.\d+\.s(\d+)/);
    if (gs2) return gs2[1];
    const parts = value.split(".");
    return value.indexOf("GS1.") === 0 && parts[2] ? parts[2] : undefined;
  }

  window.mirumeeAttribution = function () {
    let stored = {};
    try {
      stored = JSON.parse(getCookie(ATTR_COOKIE) || "{}");
    } catch {
      // ignore malformed value
    }
    return Object.assign({}, stored, {
      ga_client_id: getGaClientId(),
      ga_session_id: getGaSessionId(),
    });
  };

  captureAttribution();

  // Clicks on <a>/<button> with data-track="foo-bar" send "foo_bar_click".
  // Params come from data-track-location, data-track-name and the link href.
  // Elements inside Webflow Code Embeds (whose HTML we don't edit) are tagged
  // by AUTO_TAGS below instead; explicit data-track attributes always win.

  function slug(text) {
    return (text || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function textName(prefix) {
    return function (el) {
      return prefix + slug(el.textContent);
    };
  }

  // Rules for elements inside Code Embeds. `scope` is the `class` custom
  // attribute set on every Code Embed of that page in Webflow; renaming or
  // removing it there disables the page's rules.
  const AUTO_TAGS = [
    // /product-design
    {
      scope: "product-design",
      sel: 'a[href*="calendar.app.google"]',
      track: "booking",
      location: "product-design",
      name: "iwo-rzepiela",
    },
    {
      scope: "product-design",
      sel: "[data-acc-toggle]",
      track: "expand",
      location: "product-design",
      name: "design-services",
    },
    {
      scope: "product-design",
      sel: 'a[href*="/contact"]',
      track: "cta",
      location: "product-design",
      name: textName(""),
    },
    // /medtech-meetup
    {
      scope: "medtech-meetup",
      sel: 'a[href="#register"]',
      track: "register",
      location: "hero",
      name: "medtech-meetup",
    },
    // /case-study/prismavet chart toggles
    {
      scope: "case-study-prismavet",
      sel: "[data-k]",
      track: "chart-toggle",
      location: "case-study",
      name: textName(""),
    },
    // /case-study/butterfly-design step tabs
    {
      scope: "case-study-butterfly-design",
      sel: "[data-tm-num]",
      track: "tab",
      location: "case-study",
      name: textName("step-"),
    },
  ];

  // /case-study/<slug>: links to the client's site.
  [
    "breitling",
    "butterfly",
    "lulu",
    "rough-trade",
    "spaya",
    "butterfly-design",
  ].forEach(function (caseSlug) {
    AUTO_TAGS.push({
      scope: "case-study-" + caseSlug,
      sel: 'a[href^="http"]:not([href*="mirumee.com"])',
      track: "outbound",
      location: "case-study",
      name: caseSlug,
    });
  });

  // /case-study/<slug>: full-screen overlay controls.
  ["butterfly-design", "extrarx", "homenow"].forEach(function (caseSlug) {
    [
      ["[data-close]", "case-study-close"],
      ["[data-top]", "scroll-top"],
      ["[data-home]", "case-study-home"],
    ].forEach(function (rule) {
      AUTO_TAGS.push({
        scope: "case-study-" + caseSlug,
        sel: rule[0],
        track: rule[1],
        location: "case-study",
        name: caseSlug,
      });
    });
  });

  function resolveTag(target) {
    const el = target.closest("a[data-track], button[data-track]");
    if (el) {
      return {
        el: el,
        track: el.dataset.track,
        location: el.dataset.trackLocation,
        name: el.dataset.trackName,
      };
    }
    for (let i = 0; i < AUTO_TAGS.length; i++) {
      const rule = AUTO_TAGS[i];
      const match = target.closest("." + rule.scope + " " + rule.sel);
      if (match) {
        return {
          el: match,
          track: rule.track,
          location: rule.location,
          name: typeof rule.name === "function" ? rule.name(match) : rule.name,
        };
      }
    }
    return null;
  }

  document.addEventListener(
    "click",
    function (e) {
      const tag = e.target && e.target.closest ? resolveTag(e.target) : null;
      if (!tag) return;

      const el = tag.el;
      const href = el.getAttribute("href");
      if (el.tagName === "A" && (!href || href === "#")) return;

      const params = {};
      if (tag.location) params.track_location = tag.location;
      if (tag.name) params.track_name = tag.name;
      if (href) params.link_url = el.href;

      track(tag.track.replace(/-/g, "_") + "_click", params);
    },
    true,
  );
})();
