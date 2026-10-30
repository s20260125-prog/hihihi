(function () {
  "use strict";

  const root = document.documentElement;
  const original = new Map();
  const translatable = [...document.querySelectorAll("[data-en]")];

  translatable.forEach(el => original.set(el, el.textContent));

  const META = {
    zh: {
      title: "Relay — 會議結束，工作自動開始 | AI Meeting Action Router",
      desc: "Relay 將會議對話變成有負責人、有期限的行動項目，審核後直接送到 Notion、Jira 與 Trello。",
      ogTitle: "Relay — 會議結束，工作自動開始",
      ogDesc: "AI meeting action router. Turn conversations into owned, routed tasks in Notion, Jira, and Trello."
    },
    en: {
      title: "Relay — Meetings end. Work starts. | AI meeting action router",
      desc: "Relay turns Zoom, Google Meet, and Fireflies conversations into owned, dated action items routed to Notion, Jira, and Trello.",
      ogTitle: "Relay — Meetings end. Work starts.",
      ogDesc: "Turn conversations into owned, routed tasks in Notion, Jira, and Trello."
    }
  };

  function setMeta(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  }

  function setLanguage(lang, options) {
    const opts = Object.assign({ persist: true, updateUrl: true }, options || {});
    const next = lang === "en" ? "en" : "zh";
    root.dataset.lang = next;
    root.lang = next === "zh" ? "zh-Hant" : "en";

    translatable.forEach(el => {
      el.textContent = next === "en" ? el.dataset.en : original.get(el);
    });

    const meta = META[next];
    document.title = meta.title;
    setMeta('meta[name="description"]', meta.desc);
    setMeta('meta[property="og:title"]', meta.ogTitle);
    setMeta('meta[property="og:description"]', meta.ogDesc);

    document.querySelectorAll("[data-lang-btn]").forEach(btn => {
      const active = btn.dataset.langBtn === next;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    if (opts.persist) {
      try { localStorage.setItem("relay-site-lang", next); } catch (err) { /* private mode */ }
    }
    if (opts.updateUrl) {
      try {
        const url = new URL(location.href);
        url.searchParams.set("lang", next);
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (err) { /* file:// */ }
    }
  }

  const initial = root.dataset.lang === "en" ? "en" : "zh";
  setLanguage(initial, { persist: false, updateUrl: false });

  document.querySelectorAll("[data-lang-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      setLanguage(btn.dataset.langBtn, { persist: true, updateUrl: true });
      if (window.innerWidth <= 980) closeMenu();
    });
  });

  /* mobile navigation */
  const body = document.body;
  const toggle = document.getElementById("mobileToggle");
  const menu = document.getElementById("mobileMenu");
  function closeMenu() {
    body.classList.remove("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  if (menu) {
    menu.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) closeMenu();
  });

  /* sticky header state */
  const header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* product screens */
  const screens = {
    overview: { src: "assets/screen-overview.png", alt: "Relay dashboard overview" },
    review: { src: "assets/screen-review.png", alt: "Relay review and route screen" },
    integrations: { src: "assets/screen-integrations.png", alt: "Relay integrations screen" }
  };
  const productImage = document.getElementById("productScreen");
  const productTabs = [...document.querySelectorAll(".product-tab")];
  productTabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.classList.contains("active"))));
  productTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const screen = screens[tab.dataset.screen];
      if (!screen || !productImage) return;
      productTabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      const nextImage = new Image();
      nextImage.onload = () => {
        productImage.classList.add("swapping");
        setTimeout(() => {
          productImage.src = screen.src;
          productImage.alt = screen.alt;
          productImage.classList.remove("swapping");
        }, 120);
      };
      nextImage.src = screen.src;
    });
  });

  /* reveal on scroll */
  const reveal = [...document.querySelectorAll(".reveal")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    reveal.forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight * .95) el.classList.add("in");
      else observer.observe(el);
    });
  } else {
    reveal.forEach(el => el.classList.add("in"));
  }
})();
