(function () {
  const API_BASE = "/app/api";
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("to");

  function loadPipedriveUser() {
    const hiddenInput = document.getElementById("pipedrive-user-id");
    if (hiddenInput && userId) {
      hiddenInput.value = userId;
    }

    let endpoint = API_BASE + "/get-pipedrive-user";
    if (userId) endpoint += "?userId=" + userId;

    fetch(endpoint)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then(function (user) {
        const container = document.getElementById("contact-avatar-wrapper");
        const nameEl = document.getElementById("contact-person-name");
        const avatarEl = document.getElementById("contact-avatar");
        const calendarEl = document.getElementById("calendar-link");

        if (nameEl) nameEl.textContent = user.name;
        if (avatarEl) {
          avatarEl.src = user.icon_url || "";
          avatarEl.alt = user.name;
        }
        if (hiddenInput) hiddenInput.value = String(user.id);
        if (calendarEl && user.calendar_link) {
          calendarEl.href = user.calendar_link;
          calendarEl.dataset.trackName = String(user.id);
          calendarEl.style.opacity = "1";
        }
        if (container) container.style.opacity = "1";
      })
      .catch(function (err) {
        console.error("Pipedrive user load error:", err);
      });
  }

  function submitFormData(form) {
    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      message: formData.get("message"),
      pipedriveUserId: formData.get("pipedriveUserId") || undefined,
    };

    const submitBtn = form.querySelector("input[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.5";
      submitBtn.style.cursor = "not-allowed";
    }

    const errorEl = form.parentElement.querySelector(".w-form-fail");
    if (errorEl) errorEl.style.display = "none";

    fetch(API_BASE + "/submit-contact-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Submission failed");
        const pipedriveUserId = formData.get("pipedriveUserId");
        if (window.mirumeeTrack) {
          window.mirumeeTrack("generate_lead", {
            lead_source: "form",
            track_location: "contact",
            track_name: pipedriveUserId || undefined,
          });
        }
        const sentUrl = pipedriveUserId
          ? "/contact-sent?to=" + pipedriveUserId
          : "/contact-sent";
        window.location.href = sentUrl;
      })
      .catch(function () {
        if (errorEl) errorEl.style.display = "block";
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "";
          submitBtn.style.cursor = "";
        }
      });
  }

  function setup() {
    const form =
      document.querySelector("[data-name='Contact Form']") ||
      document.querySelector("form");
    if (!form) return;

    form.setAttribute("action", "javascript:void(0)");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      submitFormData(form);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadPipedriveUser();
      setup();
    });
  } else {
    loadPipedriveUser();
    setup();
  }
})();
