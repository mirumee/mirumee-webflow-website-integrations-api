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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function listRoot() {
    return (
      document.querySelector("[data-job-offers-list]") || document.querySelector(".job_offers_list")
    );
  }

  function cmsRows(root) {
    return Array.from(root.querySelectorAll(".w-dyn-item"));
  }

  function setFindOfferNumber(n) {
    const label = pad2(n);
    document.querySelectorAll("[data-find-offer-index]").forEach((el) => {
      el.textContent = label;
    });
  }

  function initCms() {
    const root = listRoot();
    if (!root) {
      console.warn("[job-offers] Add data-job-offers-list (or class job_offers_list) on the list wrapper.");
      setFindOfferNumber(1);
      return;
    }

    const rows = cmsRows(root);
    rows.forEach((row, i) => {
      const el = row.querySelector("[data-job-position]");
      if (el) el.textContent = pad2(i + 1);
    });

    setFindOfferNumber(rows.length > 0 ? rows.length + 1 : 1);
    setupDepartmentTabs(root, rows);
  }

  /** Optional: only runs if you use tabs + data-job-department-id on rows. */
  function setupDepartmentTabs(listRoot, rows) {
    const host = document.querySelector(".all_positions_wrapper");
    if (!host || rows.length === 0) return;

    const buttons = Array.from(host.querySelectorAll(".all_positions_button"));
    const tabAll = buttons[0];
    const tabTpl = buttons[1];
    if (!tabAll || !tabTpl) return;

    host.querySelectorAll("[data-job-tab-dynamic]").forEach((n) => n.remove());

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

    const show = (row, on) => {
      if (on) row.style.removeProperty("display");
      else row.style.setProperty("display", "none", "important");
    };

    const all = () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      tabAll.classList.add("is-active");
      rows.forEach((r) => show(r, true));
    };

    tabAll.onclick = all;
    all();

    departments.forEach((dep) => {
      const btn = tabTpl.cloneNode(true);
      btn.setAttribute("data-job-tab-dynamic", "");
      btn.removeAttribute("id");
      btn.style.display = "";
      btn.classList.remove("is-active", "hide_element", "w-condition-invisible");
      btn.textContent = dep.name || dep.id;
      btn.onclick = () => {
        buttons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        rows.forEach((row) => {
          const el = row.querySelector("[data-job-department-id]") || row;
          const rid = el.getAttribute("data-job-department-id") || "";
          show(row, rid === dep.id);
        });
      };
      host.insertBefore(btn, tabAll.nextSibling);
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

      const activateAll = () => {
        buttons.forEach((b) => b.classList.remove("is-active"));
        tabAll.classList.add("is-active");
        list.querySelectorAll("[data-job-department-id]").forEach((row) => {
          row.style.setProperty("display", "block", "important");
        });
      };
      tabAll.onclick = activateAll;
      activateAll();

      departments.forEach((dep) => {
        const btn = tabTpl.cloneNode(true);
        btn.setAttribute("data-job-tab-dynamic", "");
        btn.removeAttribute("id");
        btn.style.display = "";
        btn.classList.remove("is-active", "hide_element", "w-condition-invisible");
        btn.textContent = dep.name || "Department";
        btn.onclick = () => {
          buttons.forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          list.querySelectorAll("[data-job-department-id]").forEach((row) => {
            const rid = row.getAttribute("data-job-department-id") || "";
            row.style.setProperty("display", rid === dep.id ? "block" : "none", "important");
          });
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
