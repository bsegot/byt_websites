(() => {
  "use strict";

  // Cross-document view transitions (from the CSS `@view-transition` rule) reject their
  // internal promises when a page unloads mid-transition — expected, but noisy in devtools.
  // Attaching .catch() on pageswap/pagereveal races the rejection itself, so this narrowly
  // targeted unhandledrejection filter is the only reliable way to silence just this one.
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason && e.reason.name === "AbortError" && /transition/i.test(e.reason.message || "")) {
      e.preventDefault();
    }
  });

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Live U.S. market open/closed indicator (America/New_York, regular session only —
  // does not account for exchange holidays)
  function updateMarketStatus() {
    const dot = document.getElementById("market-dot");
    const text = document.getElementById("market-status-text");
    if (!dot || !text) return;

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;

    const weekday = get("weekday");
    const minutesNow = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
    const isWeekday = weekday !== "Sat" && weekday !== "Sun";
    const isOpen = isWeekday && minutesNow >= 9 * 60 + 30 && minutesNow < 16 * 60;

    const timeLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);

    dot.classList.toggle("open", isOpen);
    dot.classList.toggle("closed", !isOpen);
    text.textContent = `U.S. markets ${isOpen ? "open" : "closed"} · ${timeLabel} ET`;
  }
  updateMarketStatus();
  setInterval(updateMarketStatus, 30000);

  // Magnetic buttons (fine pointers only)
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  // Sticky header background on scroll
  const header = document.getElementById("site-header");
  const onScroll = () => {
    if (window.scrollY > 12) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile nav toggle
  const navToggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("nav");
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  // Split headings into words for kinetic reveal
  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((w, i) => `<span class="word" style="transition-delay:${i * 45}ms">${w}</span>`)
      .join(" ");
  });

  // Scroll-reveal (fades + kinetic word-split headings share one observer)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealEls = document.querySelectorAll(".reveal, [data-split]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in-view"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add("in-view"), i * 60);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  // Pipeline connector line (Approach page)
  const pipeline = document.querySelector(".pipeline");
  if (pipeline) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      pipeline.classList.add("in-view");
    } else {
      const po = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              pipeline.classList.add("in-view");
              po.unobserve(pipeline);
            }
          });
        },
        { threshold: 0.2 }
      );
      po.observe(pipeline);
    }
  }

  // Hero background: subtle drifting particle network
  (function initParticleNetwork() {
  const canvas = document.getElementById("network");
  if (!canvas || reduceMotion) return;

  const ctx = canvas.getContext("2d");
  const hero = canvas.closest(".hero");
  let width, height, dpr;
  let particles = [];
  let animId = null;
  let running = false;

  const ACCENT = "150, 105, 47"; // matches --accent

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(28, Math.min(70, Math.round((width * height) / 22000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
    }

    const linkDist = Math.min(160, width / 6);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < linkDist) {
          const alpha = (1 - dist / linkDist) * 0.3;
          ctx.strokeStyle = `rgba(${ACCENT}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx.fillStyle = `rgba(${ACCENT}, 0.65)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (running) animId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    animId = requestAnimationFrame(step);
  }
  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
  }

  resize();
  start();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if ("IntersectionObserver" in window) {
    const heroObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0 }
    );
    heroObserver.observe(hero);
  }
  })();

  // Generative "signal" visual (About page) — abstract radial waveform, not market data
  const signalCanvas = document.getElementById("signal");
  if (signalCanvas) {
    const sctx = signalCanvas.getContext("2d");
    let sw, sh, sdpr, sphase = 0, srunning = false, sraf = null;

    function sResize() {
      sdpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = signalCanvas.parentElement.getBoundingClientRect();
      sw = rect.width;
      sh = rect.width;
      signalCanvas.width = sw * sdpr;
      signalCanvas.height = sh * sdpr;
      signalCanvas.style.width = sw + "px";
      signalCanvas.style.height = sh + "px";
      sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    }

    function sRing(radiusBase, amp1, amp2, freq1, freq2, color, lineWidth, phaseOffset) {
      const cx = sw / 2, cy = sh / 2;
      sctx.beginPath();
      for (let i = 0; i <= 360; i += 3) {
        const a = (i * Math.PI) / 180;
        const r =
          radiusBase +
          amp1 * Math.sin(freq1 * a + sphase + phaseOffset) +
          amp2 * Math.sin(freq2 * a - sphase * 1.3 + phaseOffset);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) sctx.moveTo(x, y);
        else sctx.lineTo(x, y);
      }
      sctx.closePath();
      sctx.strokeStyle = color;
      sctx.lineWidth = lineWidth;
      sctx.stroke();
    }

    function sDraw() {
      sctx.clearRect(0, 0, sw, sh);
      const base = Math.min(sw, sh) * 0.3;
      sRing(base, base * 0.12, base * 0.05, 3, 7, "rgba(150,105,47,0.55)", 1.4, 0);
      sRing(base * 0.76, base * 0.09, base * 0.04, 5, 2, "rgba(91,116,140,0.5)", 1.2, 1.4);
      sRing(base * 0.5, base * 0.07, base * 0.03, 4, 6, "rgba(150,105,47,0.32)", 1, 2.6);
    }

    function sLoop() {
      sphase += 0.006;
      sDraw();
      if (srunning) sraf = requestAnimationFrame(sLoop);
    }

    sResize();
    sDraw();
    let sResizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(sResizeTimer);
      sResizeTimer = setTimeout(() => {
        sResize();
        sDraw();
      }, 150);
    });

    if (!reduceMotion && "IntersectionObserver" in window) {
      const sio = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              if (!srunning) {
                srunning = true;
                sLoop();
              }
            } else {
              srunning = false;
              if (sraf) cancelAnimationFrame(sraf);
            }
          });
        },
        { threshold: 0 }
      );
      sio.observe(signalCanvas);
    }
  }
})();
