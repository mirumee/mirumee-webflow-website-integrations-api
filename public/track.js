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

  // Clicks on <a>/<button> with data-track="foo-bar" send "foo_bar_click".
  // Params come from data-track-location, data-track-name and the link href.
  document.addEventListener(
    "click",
    function (e) {
      const el =
        e.target && e.target.closest
          ? e.target.closest("a[data-track], button[data-track]")
          : null;
      if (!el) return;

      const href = el.getAttribute("href");
      if (el.tagName === "A" && (!href || href === "#")) return;

      const params = {};
      if (el.dataset.trackLocation) {
        params.track_location = el.dataset.trackLocation;
      }
      if (el.dataset.trackName) params.track_name = el.dataset.trackName;
      if (href) params.link_url = el.href;

      track(el.dataset.track.replace(/-/g, "_") + "_click", params);
    },
    true,
  );
})();
