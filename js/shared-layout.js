
(() => {
  async function loadPartial(url, placeholderId) {
    const placeholder = document.getElementById(placeholderId);

    if (!placeholder) {
      console.error(`[Shared layout] Missing placeholder: #${placeholderId}`);
      return false;
    }

    placeholder.innerHTML = '<div style="padding:12px;color:#00d9ff">Loading...</div>';

    try {
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} — ${url}`);
      }

      const html = await response.text();
      placeholder.innerHTML = html;

      console.log(`[Shared layout] Loaded ${url} (${html.length} characters)`);
      return true;
    } catch (error) {
      console.error(`[Shared layout] Failed to load ${url}`, error);

      placeholder.innerHTML = `
        <div style="padding:16px;color:#ff6b6b;background:#1b1010">
          <strong>Could not load website layout.</strong>
          <p>${url}</p>
          <p>Open F12 → Console for details.</p>
        </div>`;

      return false;
    }
  }

  function initializeNavigation() {
    const currentPage =
      (location.pathname.split("/").pop() || "index.html").toLowerCase();

    document.querySelectorAll("[data-page]").forEach(link => {
      const active = link.dataset.page.toLowerCase() === currentPage;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const menuButton = document.getElementById("menuBtn");
    const closeButton = document.getElementById("closeBtn");
    const mobileNav = document.getElementById("mobileNav");

    if (menuButton && mobileNav) {
      function openMenu() {
        mobileNav.classList.add("open");
        mobileNav.setAttribute("aria-hidden", "false");
        menuButton.setAttribute("aria-expanded", "true");
      }

      function closeMenu() {
        mobileNav.classList.remove("open");
        mobileNav.setAttribute("aria-hidden", "true");
        menuButton.setAttribute("aria-expanded", "false");
      }

      menuButton.addEventListener("click", openMenu);
      closeButton?.addEventListener("click", closeMenu);

      mobileNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
      });
    }

    console.log("[Shared layout] Navigation initialized.");
  }

async function updateAccountNavigation() {
  const links = document.querySelectorAll("[data-auth-account]");

  if (!links.length) return;

  try {
    const response = await fetch("/api/session-status.php", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Could not check account session.");
    }

    const session = await response.json();
    const isLoggedIn = session.logged_in === true;
    const currentPage =
      (location.pathname.split("/").pop() || "index.html").toLowerCase();

    links.forEach(link => {
      // Reset the default logged-out behaviour first.
      link.removeAttribute("data-logout");
      link.setAttribute("data-open-account", "");

      if (isLoggedIn && currentPage === "account.php") {
        // On the dashboard, the account button becomes Logout.
        link.textContent = "Logout";
        link.href = "#";
        link.removeAttribute("data-open-account");
        link.setAttribute("data-logout", "");
      } else if (isLoggedIn) {
        // On other pages, take the user directly to their dashboard.
        link.textContent = "Account ↗";
        link.href = "/account.php";
        link.removeAttribute("data-open-account");
      } else {
        // Logged out: retain the existing login modal behaviour.
        link.textContent = "Account ↗";
        link.href = "#";
      }
    });
  } catch (error) {
    console.error("[Shared layout] Account status check failed:", error);
  }
}

async function logoutFromNavigation() {
  try {
    const csrfResponse = await fetch("/api/account.php?action=csrf", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    const csrfData = await csrfResponse.json();

    if (!csrfResponse.ok || !csrfData.ok || !csrfData.csrf) {
      throw new Error("Could not verify the logout request. Please refresh.");
    }

    const response = await fetch("/api/account.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        action: "logout",
        csrf: csrfData.csrf
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Logout failed.");
    }

    window.location.href = "/index.html";
  } catch (error) {
    window.alert(error.message || "Could not log out.");
  }
}
  async function initializeSharedLayout() {
    console.log("[Shared layout] Starting...");

const results = await Promise.all([
  loadPartial("/partials/navigation.html", "site-navigation"),
  loadPartial("/partials/footer.html", "site-footer"),
  loadPartial("/partials/account-modal.html", "site-account-modal")
]);

initializeNavigation();
await updateAccountNavigation();

document.addEventListener("click", event => {
  const logoutLink = event.target.closest("[data-logout]");

  if (logoutLink) {
    event.preventDefault();
    logoutFromNavigation();
  }
});
// Let register.js attach its handlers after the modal exists.
if (results[2]) {
  document.dispatchEvent(new Event("account-modal-ready"));
}
  console.log(
    `[Shared layout] Finished. Navigation: ${results[0] ? 'OK' : 'FAILED'}; Footer: ${results[1] ? 'OK' : 'FAILED'}; Account modal: ${results[2] ? 'OK' : 'FAILED'}`
  );

const accountMode = new URLSearchParams(location.search).get("account");

if (accountMode === "login" || accountMode === "register") {
  const modal = document.getElementById("account-modal");

  if (modal) {
    modal.hidden = false;

    if (accountMode === "register") {
      document.getElementById("login-view")?.classList.remove("active");
      document.getElementById("register-view")?.classList.add("active");
    }
  }
}


    console.log(
      `[Shared layout] Finished. Navigation: ${results[0] ? "OK" : "FAILED"}; Footer: ${results[1] ? "OK" : "FAILED"}`
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSharedLayout, {
      once: true
    });
  } else {
    initializeSharedLayout();
  }
})();
