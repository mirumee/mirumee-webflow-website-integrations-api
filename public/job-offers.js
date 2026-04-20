/**
 * Careers page helper for Webflow.
 *
 * CMS (use this): add `data-job-offers-cms` on a parent. Put `data-job-offers-list` on the
 * element that wraps your Collection list. Inside each collection item, add custom attribute
 * `data-job-position` on the small element that shows 01, 02, … (don’t bind that field in CMS).
 * On the “Can’t find an offer?” number element add `data-find-offer-index` (value can be empty).
 *
 * Legacy: no `data-job-offers-cms`, but `[data-job-offers-list]` + `[data-job-offer-template]` → fetches GET /app/api/get-job-offers.
 */
(function () {
  const API_BASE = "/app/api";

  const injectedStyle = document.createElement("style");
  injectedStyle.textContent = [
    ".jof-hidden { display: none !important; }",
    ".jof-dept-filtered .jof-last-visible .has-border-bottom { border-bottom: none !important; }",
    ".jof-tabs-bar { display: contents; }",
    "@media (max-width: 991px) {",
    "  .all_positions_wrapper {",
    "    max-width: 100%;",
    "    min-width: 0;",
    "    overflow: hidden;",
    "  }",
    "  .jof-tabs-bar {",
    "    display: flex !important;",
    "    flex-wrap: nowrap;",
    "    align-items: center;",
    "    background: #000;",
    "    border-radius: 100px;",
    "    padding: 4px;",
    "    max-width: 100%;",
    "    width: 100%;",
    "    box-sizing: border-box;",
    "    min-width: 0;",
    "    overflow-x: auto;",
    "    overflow-y: hidden;",
    "    overscroll-behavior-x: contain;",
    "    touch-action: pan-x;",
    "    -webkit-overflow-scrolling: touch;",
    "    scrollbar-width: none;",
    "    margin: 0 auto 2rem;",
    "  }",
    "  .jof-tabs-bar::-webkit-scrollbar { display: none; }",
    "  .jof-tabs-bar .all_positions_button,",
    "  .jof-tabs-bar [data-job-tab-dynamic] {",
    "    flex-shrink: 0;",
    "    white-space: nowrap;",
    "    background: transparent !important;",
    "    border: none !important;",
    "    border-radius: 0 !important;",
    "    box-shadow: none !important;",
    "    color: #fff !important;",
    "    padding: 8px 16px;",
    "    margin: 0 !important;",
    "    font-weight: 400;",
    "  }",
    "  .jof-tabs-bar .all_positions_button.is-button-active,",
    "  .jof-tabs-bar [data-job-tab-dynamic].is-button-active {",
    "    font-weight: 700 !important;",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(injectedStyle);

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function listRoot() {
    const el =
      document.querySelector("[data-job-offers-list]") ||
      document.querySelector(".job_offers_list");
    if (!el) return null;
    if (el.querySelector(".w-dyn-item")) return el;
    const list = el.closest(".w-dyn-list") || el.closest(".w-dyn-items");
    return list || el;
  }

  function cmsRows(root) {
    let items = Array.from(root.querySelectorAll(".w-dyn-item"));
    if (items.length === 0) {
      const list = root.closest(".w-dyn-list") || root.closest(".w-dyn-items");
      if (list) items = Array.from(list.querySelectorAll(".w-dyn-item"));
    }
    return items;
  }

  function markLastVisible(rows) {
    rows.forEach((r) => r.classList.remove("jof-last-visible"));
    for (var i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].classList.contains("jof-hidden")) {
        rows[i].classList.add("jof-last-visible");
        break;
      }
    }
  }

  function renumberVisibleRows(rows) {
    var idx = 1;
    rows.forEach(function (row) {
      if (row.classList.contains("jof-hidden")) return;
      var el = row.querySelector("[data-job-position]");
      if (el) el.textContent = pad2(idx);
      idx++;
    });
    setFindOfferNumber(idx);
  }

  function setFindOfferNumber(n) {
    const label = pad2(n);
    document.querySelectorAll("[data-find-offer-index]").forEach((el) => {
      el.textContent = label;
    });
  }

  function applyCmsNumbering(root) {
    const rows = cmsRows(root);
    rows.forEach((row, i) => {
      const el = row.querySelector("[data-job-position]");
      if (el) el.textContent = pad2(i + 1);
    });
    setFindOfferNumber(rows.length > 0 ? rows.length + 1 : 1);
    markLastVisible(rows);
    return rows;
  }

  function initCms() {
    const root = listRoot();
    if (!root) {
      console.warn("[job-offers] Add data-job-offers-list (or class job_offers_list) on the list wrapper.");
      setFindOfferNumber(1);
      return;
    }

    let rows = applyCmsNumbering(root);
    setupDepartmentTabs(root, rows);

    let applying = false;
    const reapply = () => {
      if (applying) return;
      applying = true;
      try {
        const current = cmsRows(root);
        const want = pad2(current.length > 0 ? current.length + 1 : 1);
        if (current.length !== rows.length) {
          rows = applyCmsNumbering(root);
        } else {
          document.querySelectorAll("[data-find-offer-index]").forEach((el) => {
            if (el.textContent !== want) el.textContent = want;
          });
        }
      } finally {
        applying = false;
      }
    };

    const section = root.closest(".find_offer_section") || document.body;
    const observer = new MutationObserver(reapply);
    observer.observe(section, { childList: true, subtree: true, characterData: true });

    window.addEventListener("load", reapply);
    if (window.Webflow && typeof window.Webflow.push === "function") {
      window.Webflow.push(reapply);
    }
  }

  /**
   * Collect "Can't find an offer?" link elements — the direct-child .offer_link
   * siblings of the CMS list inside .find_offer_section.
   */
  function collectCantFindEls() {
    var section = document.querySelector(".find_offer_section");
    if (!section) return [];
    var found = [];
    var seen = new Set();
    document.querySelectorAll("[data-find-offer-index]").forEach(function (el) {
      var node = el;
      while (node.parentElement && node.parentElement !== section) {
        node = node.parentElement;
      }
      if (node.parentElement === section && !seen.has(node)) {
        seen.add(node);
        found.push(node);
      }
    });
    return found;
  }

  /** Optional: only runs if you use tabs + data-job-department-id on rows. */
  function setupDepartmentTabs(listRoot, rows) {
    const host = document.querySelector(".all_positions_wrapper");
    if (!host || rows.length === 0) return;

    const buttons = Array.from(host.querySelectorAll(".all_positions_button"));
    const tabAll = buttons[0];
    const tabTpl = buttons[1];
    if (!tabAll || !tabTpl) return;

    tabTpl.classList.add("jof-hidden");

    host.querySelectorAll("[data-job-tab-dynamic]").forEach((n) => n.remove());

    const cantFindEls = collectCantFindEls();

    const show = (el, on) => {
      if (on) el.classList.remove("jof-hidden");
      else el.classList.add("jof-hidden");
    };

    const ACTIVE_CLS = "is-button-active";

    const deactivateAll = () => {
      host.querySelectorAll(".all_positions_button").forEach((b) => b.classList.remove(ACTIVE_CLS));
    };

    tabAll.onclick = (e) => {
      e.preventDefault();
      deactivateAll();
      tabAll.classList.add(ACTIVE_CLS);
      rows.forEach((r) => show(r, true));
      cantFindEls.forEach((el) => show(el, true));
      listRoot.classList.remove("jof-dept-filtered");
      renumberVisibleRows(rows);
      markLastVisible(rows);
    };
    deactivateAll();
    tabAll.classList.add(ACTIVE_CLS);

    const departments = [];
    const seen = new Set();
    rows.forEach((item) => {
      const el = item.querySelector("[data-job-department-id]") || item;
      const id = el.getAttribute("data-job-department-id") || "";
      const name = el.getAttribute("data-job-department-name") || id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      departments.push({ id, name });
    });
    if (!departments.length) return;

    var bar = host.querySelector(".jof-tabs-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "jof-tabs-bar";
      host.appendChild(bar);
    }

    bar.appendChild(tabAll);

    departments.forEach((dep) => {
      const btn = tabTpl.cloneNode(true);
      btn.setAttribute("data-job-tab-dynamic", "");
      btn.removeAttribute("id");
      btn.style.display = "";
      btn.classList.remove(ACTIVE_CLS, "hide_element", "w-condition-invisible", "jof-hidden");
      btn.textContent = dep.name || dep.id;
      btn.onclick = (e) => {
        e.preventDefault();
        deactivateAll();
        btn.classList.add(ACTIVE_CLS);
        rows.forEach((row) => {
          const el = row.querySelector("[data-job-department-id]") || row;
          const rid = el.getAttribute("data-job-department-id") || "";
          show(row, rid === dep.id);
        });
        cantFindEls.forEach((el) => show(el, false));
        listRoot.classList.add("jof-dept-filtered");
        renumberVisibleRows(rows);
        markLastVisible(rows);
      };
      bar.appendChild(btn);
    });
  }

  function initLegacy() {
    const wrapper = document.querySelector("[data-job-offers-wrapper]");
    const template = document.querySelector("[data-job-offer-template]");
    const list = document.querySelector("[data-job-offers-list]");
    if (!list || !template) {
      console.warn("[job-offers] Legacy: need [data-job-offers-list] and [data-job-offer-template].");
      return;
    }

    const company = wrapper ? wrapper.getAttribute("data-company") : "";
    const endpoint =
      API_BASE + "/get-job-offers" + (company ? "?company=" + encodeURIComponent(company) : "");

    function formatSalary(offer) {
      if (offer.salaryDisplay) return offer.salaryDisplay;
      if (!offer.currency || (offer.minSalary == null && offer.maxSalary == null)) return "";
      const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      if (offer.minSalary != null && offer.maxSalary != null) {
        return fmt(offer.minSalary) + " - " + fmt(offer.maxSalary) + " " + offer.currency;
      }
      return fmt(offer.minSalary || offer.maxSalary) + " " + offer.currency;
    }

    function remoteLabel(s) {
      if (s === "remote") return "Fully Remote";
      if (s === "hybrid") return "Hybrid";
      return "";
    }

    function renderOffer(offer, index) {
      const root = template.cloneNode(true);
      root.classList.remove("w-condition-invisible");
      root.querySelectorAll(".w-condition-invisible").forEach((n) => n.classList.remove("w-condition-invisible"));
      root.removeAttribute("data-job-offer-template");
      root.removeAttribute("style");
      root.style.cssText =
        "display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;";

      const deptId = offer.departmentId || "";
      if (deptId) root.setAttribute("data-job-department-id", deptId);

      const pos =
        root.querySelector("[data-job-position]") || root.querySelector(".index_number");
      const title =
        root.querySelector("[data-job-title]") || root.querySelector(".job_offer_header");
      const salary =
        root.querySelector("[data-job-salary]") || root.querySelector(".offer_salary");
      const details = root.querySelectorAll(".offer_detail");
      const loc = root.querySelector("[data-job-location]") || details[0];
      const rem = root.querySelector("[data-job-remote]") || details[1];

      if (title) title.textContent = offer.title || "";
      if (salary) salary.textContent = formatSalary(offer);
      if (pos) pos.textContent = pad2(index + 1);
      if (loc) loc.textContent = offer.locationsLabel || "";
      if (rem) rem.textContent = remoteLabel(offer.remoteStatus) || "";

      if (offer.url) {
        if (root.tagName === "A") root.setAttribute("href", offer.url);
        else {
          const a = root.querySelector("[data-job-link]") || root.querySelector("a[href]");
          if (a) a.setAttribute("href", offer.url);
        }
      }

      root.setAttribute("data-job-clone", "");
      list.appendChild(root);
    }

    function tabsFromOffers(offers) {
      const host = document.querySelector(".all_positions_wrapper");
      if (!host) return;
      const buttons = Array.from(host.querySelectorAll(".all_positions_button"));
      const tabAll = buttons[0];
      const tabTpl = buttons[1];
      if (!tabAll || !tabTpl) return;
      host.querySelectorAll("[data-job-tab-dynamic]").forEach((n) => n.remove());

      const departments = [];
      const seen = new Set();
      offers.forEach((o) => {
        const id = o.departmentId || "";
        const name = o.departmentName || id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        departments.push({ id, name });
      });
      if (!departments.length) return;

      const ACTIVE_CLS = "is-button-active";

      const deactivateAll = () => {
        host.querySelectorAll(".all_positions_button").forEach((b) => b.classList.remove(ACTIVE_CLS));
      };

      const cantFindEls = collectCantFindEls();

      tabAll.onclick = (e) => {
        e.preventDefault();
        deactivateAll();
        tabAll.classList.add(ACTIVE_CLS);
        list.querySelectorAll("[data-job-department-id]").forEach((row) => {
          row.classList.remove("jof-hidden");
        });
        cantFindEls.forEach((el) => el.classList.remove("jof-hidden"));
      };
      deactivateAll();
      tabAll.classList.add(ACTIVE_CLS);

      departments.forEach((dep) => {
        const btn = tabTpl.cloneNode(true);
        btn.setAttribute("data-job-tab-dynamic", "");
        btn.removeAttribute("id");
        btn.style.display = "";
        btn.classList.remove(ACTIVE_CLS, "hide_element", "w-condition-invisible");
        btn.textContent = dep.name || "Department";
        btn.onclick = (e) => {
          e.preventDefault();
          deactivateAll();
          btn.classList.add(ACTIVE_CLS);
          list.querySelectorAll("[data-job-department-id]").forEach((row) => {
            const rid = row.getAttribute("data-job-department-id") || "";
            if (rid === dep.id) row.classList.remove("jof-hidden");
            else row.classList.add("jof-hidden");
          });
          cantFindEls.forEach((el) => el.classList.add("jof-hidden"));
        };
        host.insertBefore(btn, tabAll.nextSibling);
      });
    }

    function apply(payload) {
      const offers = Array.isArray(payload.offers) ? payload.offers : [];
      list.querySelectorAll("[data-job-clone]").forEach((n) => n.remove());

      if (!offers.length) {
        list.style.display = "none";
        setFindOfferNumber(1);
        return;
      }

      const mode = list.getAttribute("data-list-display") || "flex";
      list.style.display = mode;
      if (mode === "flex") list.style.flexDirection = "column";

      offers.forEach((o, i) => renderOffer(o, i));
      tabsFromOffers(offers);
      setFindOfferNumber(offers.length + 1);
    }

    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text().then((t) => t.slice(0, 300)));
        return res.json();
      })
      .then(apply)
      .catch((err) => {
        console.error("[job-offers]", err);
        list.style.display = "none";
      });
  }

  function start() {
    if (document.querySelector("[data-job-offers-cms]")) {
      initCms();
    } else {
      initLegacy();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
