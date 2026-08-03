'use strict';



// filter variables (portfolio)
const filterBtn = document.querySelectorAll("[data-filter-btn]");
const filterItems = document.querySelectorAll("[data-filter-item]");

const filterFunc = function (selectedValue) {

  for (let i = 0; i < filterItems.length; i++) {

    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else if (selectedValue === filterItems[i].dataset.category) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
    }

  }

}

let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {

  filterBtn[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    filterFunc(selectedValue);

    if (lastClickedBtn) lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;

  });

}



// keep anchor jumps (e.g. #bio) clear of the sticky header. Computed from
// the header's real rendered height rather than a hardcoded number: on a
// narrow phone the nav wraps onto a second line and the header gets taller,
// so a fixed offset would undershoot there while overshooting on desktop.
const siteHeaderForOffset = document.querySelector(".site-header");

function updateHeaderScrollOffset() {
  if (!siteHeaderForOffset) return;
  document.documentElement.style.scrollPaddingTop = siteHeaderForOffset.getBoundingClientRect().height + "px";
}

updateHeaderScrollOffset();
window.addEventListener("resize", updateHeaderScrollOffset);



// entrance animation: give each staggered list item (blog posts, portfolio
// projects, CV entries) its own --stagger index so the CSS animation-delay
// staggers them without hardcoding :nth-child rules per page
document.querySelectorAll(".entrance-item, .project-item").forEach(function (el, i) {
  el.style.setProperty("--stagger", Math.min(i, 10));
});



// scroll reveal: fade + slide up sections as they enter the viewport, once
const revealEls = document.querySelectorAll("[data-reveal]");

if (revealEls.length) {
  const revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });

  revealEls.forEach(function (el) { revealObserver.observe(el); });
}



// hero content: as you scroll through the hero, it rises a bit faster than
// the scroll itself and shrinks slightly. Plain transform, no repositioning
// beyond that and no scroll-lock, so it reads as one continuous motion into
// Bio rather than a static block that just disappears.
const heroContentForScale = document.querySelector(".hero-content");
const heroElForScale = document.querySelector(".hero");

if (heroContentForScale && heroElForScale && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let scaleTicking = false;

  function updateHeroContentScale() {
    scaleTicking = false;
    const heroRect = heroElForScale.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
    heroContentForScale.style.transform = "translateY(" + (-progress * 160) + "px) scale(" + (1 - progress * 0.2) + ")";
  }

  function requestScaleUpdate() {
    if (!scaleTicking) {
      scaleTicking = true;
      requestAnimationFrame(updateHeroContentScale);
    }
  }

  window.addEventListener("scroll", requestScaleUpdate, { passive: true });
  window.addEventListener("resize", requestScaleUpdate);
  updateHeroContentScale();
}





// "Generate webpage": the whole site is hidden ([hidden] sections, header,
// footer) behind one button. Clicking it plays a short "AI at work" spectacle
// (scrambled status text over a canvas neural network with floating status
// snippets), then bounces the rest of the page into view. No scroll-lock
// needed anywhere: there is simply nothing to scroll into until it's done.
// The generated state persists in localStorage, so it never replays on a
// repeat visit; other pages never had this gate to begin with.
(function () {

  const generateBtn = document.querySelector("[data-generate-btn]");
  const generateStatus = document.querySelector("[data-generate-status]");
  const generateCanvas = document.querySelector("[data-generate-canvas]");
  const generateSnippets = document.querySelector("[data-generate-snippets]");
  const scrollHint = document.querySelector("[data-scroll-hint]");
  const heroEl = document.querySelector(".hero");
  const siteHeader = document.querySelector("[data-site-header]");
  const siteFooter = document.querySelector("[data-site-footer]");
  const contentSections = document.querySelectorAll("[data-reveal]");

  if (!generateBtn || !generateStatus) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STORAGE_KEY = "siteGenerated";

  let alreadyGenerated = false;
  try { alreadyGenerated = localStorage.getItem(STORAGE_KEY) === "true"; } catch (e) { /* private mode etc: just replay it */ }

  function markGenerated() {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch (e) { /* nothing to persist to, harmless */ }
  }

  function showPlain(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.add("is-visible");
  }

  function bounceIn(el) {
    if (!el) return;
    el.hidden = false;
    // a tick of setTimeout, not requestAnimationFrame: guarantees the browser
    // has applied the hidden-just-removed state as its own frame before the
    // class change that animates it, and is a more robust "defer one tick"
    // primitive than rAF for this
    setTimeout(function () { el.classList.add("is-visible"); }, 20);
  }

  // Bio/Work/News/Hobbies appear plain and already-resolved once generated,
  // not with their own fade-up-on-scroll (the generation ceremony already
  // stood in for that reveal). Without this, #bio's own scroll-reveal
  // transform (translateY(24px) -> none) would still be pending when the
  // "Scroll down" button jumps to it, shifting it upward right after the
  // jump lands and throwing off the header-clearance math below.
  function revealContentSections() {
    contentSections.forEach(function (el) { showPlain(el); });
  }

  // fast path: already generated on a previous visit, or motion is reduced.
  // Either way, skip the button/spectacle and just show the site plainly.
  if (alreadyGenerated || prefersReducedMotion) {
    generateBtn.hidden = true;
    revealContentSections();
    showPlain(siteHeader);
    showPlain(siteFooter);
    showPlain(scrollHint);
    if (!alreadyGenerated) markGenerated();
    updateHeaderScrollOffset();
    return;
  }

  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const MAX_BLUR_PX = 6;
  const STATUS_TEXT = "Generating website…";
  const SCRAMBLE_MS = 4500;

  const randomChar = function () { return CHARSET[Math.floor(Math.random() * CHARSET.length)]; };

  // wrap every non-space character in its own span with a random reveal
  // threshold, so characters resolve in random order rather than left-to-right
  const chars = [];
  for (const ch of STATUS_TEXT) {
    const span = document.createElement("span");
    span.textContent = ch;
    if (ch.trim() !== "") {
      span.dataset.char = ch;
      // named revealAt, not reveal: a plain "reveal" attribute would collide
      // with the unrelated [data-reveal] selector used for section fade-ins
      span.dataset.revealAt = Math.random();
      chars.push(span);
    }
    generateStatus.appendChild(span);
  }

  function renderStatus(t) {
    generateStatus.style.setProperty("--diffusion-blur", ((1 - t) * MAX_BLUR_PX) + "px");
    chars.forEach(function (span) {
      span.textContent = t >= parseFloat(span.dataset.revealAt) ? span.dataset.char : randomChar();
    });
  }

  // neural network: a small particle system with distance-based links and
  // an occasional bright pulse traveling one edge, like a neuron firing
  function runNeuralNetwork(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f6f66";
    let width = 0, height = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // node count scales with viewport area (~1 per 14000px²) so a phone
    // screen isn't as crowded/slow as a desktop monitor, and a desktop
    // monitor isn't left looking sparse
    const nodeCount = Math.max(20, Math.min(90, Math.round((width * height) / 14000)));
    const nodes = Array.from({ length: nodeCount }, function () {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3
      };
    });
    const LINK_DIST = 130;
    const MAX_PULSES = 3;
    let pulses = [];
    let running = true;
    let rafId;

    function step() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      nodes.forEach(function (n) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      });

      ctx.strokeStyle = accent;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.globalAlpha = (1 - dist / LINK_DIST) * 0.3;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = accent;
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      if (pulses.length < MAX_PULSES && Math.random() < 0.06) {
        const from = nodes[Math.floor(Math.random() * nodes.length)];
        const to = nodes[Math.floor(Math.random() * nodes.length)];
        if (from !== to) pulses.push({ from: from, to: to, t: 0 });
      }
      ctx.globalAlpha = 1;
      pulses.forEach(function (p) {
        p.t += 0.02;
        ctx.beginPath();
        ctx.arc(
          p.from.x + (p.to.x - p.from.x) * p.t,
          p.from.y + (p.to.y - p.from.y) * p.t,
          3, 0, Math.PI * 2
        );
        ctx.fill();
      });
      pulses = pulses.filter(function (p) { return p.t < 1; });

      rafId = requestAnimationFrame(step);
    }
    step();

    return function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    };
  }

  // floating status/formula snippets, fading in and out at staggered spots
  function runSnippets(container) {
    const PHRASES = [
      "Gathering Sandro's information…",
      "Training persona embedding…",
      "Compiling research interests…",
      "Rendering portfolio…",
      "Indexing publications…",
      "Backpropagating identity…",
      "Fine-tuning charisma parameters…",
      "Loading personality.pth…",
      "Optimizing awkward jokes…",
      "Resolving Italian-Georgian ancestry…",
      "∇θ L(θ)",
      "P(hire | resume)",
      "argmax P(bio | prompt)",
      "θ ← θ - α∇L",
      "L = -Σ y log(ŷ)",
      "H(X) = -Σ p(x) log p(x)",
      "softmax(overqualified)"
    ];
    let running = true;
    const active = [];

    function spawn() {
      if (!running) return;
      if (active.length < 7) {
        const el = document.createElement("div");
        el.className = "generate-snippet";
        el.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        el.style.top = (15 + Math.random() * 70) + "%";
        el.style.left = (10 + Math.random() * 80) + "%";
        container.appendChild(el);
        setTimeout(function () { el.classList.add("is-visible"); }, 20);
        active.push(el);
        setTimeout(function () {
          el.classList.remove("is-visible");
          setTimeout(function () {
            el.remove();
            const idx = active.indexOf(el);
            if (idx !== -1) active.splice(idx, 1);
          }, 600);
        }, 1400);
      }
      if (running) setTimeout(spawn, 250 + Math.random() * 300);
    }
    spawn();

    return function stop() {
      running = false;
      active.forEach(function (el) { el.remove(); });
      active.length = 0;
    };
  }

  generateBtn.addEventListener("click", function () {
    generateBtn.hidden = true;

    generateStatus.hidden = false;
    renderStatus(0);

    let stopNetwork = null;
    let stopSnippets = null;
    if (generateCanvas) {
      generateCanvas.hidden = false;
      stopNetwork = runNeuralNetwork(generateCanvas);
    }
    if (generateSnippets) {
      generateSnippets.hidden = false;
      stopSnippets = runSnippets(generateSnippets);
    }

    const stepMs = 40;
    const steps = SCRAMBLE_MS / stepMs;
    let step = 0;
    const id = setInterval(function () {
      step++;
      renderStatus(Math.min(1, step / steps));
      if (step >= steps) {
        clearInterval(id);
        setTimeout(function () {
          if (stopNetwork) stopNetwork();
          if (stopSnippets) stopSnippets();
          if (generateCanvas) generateCanvas.hidden = true;
          if (generateSnippets) generateSnippets.hidden = true;
          generateStatus.hidden = true;

          revealContentSections();
          bounceIn(siteHeader);
          bounceIn(siteFooter);
          bounceIn(scrollHint);
          markGenerated();
          // header just went from hidden to rendered, so its height needs
          // recomputing now rather than waiting on the next resize event.
          // Measured again once its own bounce-in transition finishes: mid-
          // transition it's still visually shrunk by the entrance transform
          // (scale(0.97)), which would otherwise be baked in as a slightly
          // too-small offset for the rest of the session.
          updateHeaderScrollOffset();
          if (siteHeader) siteHeader.addEventListener("transitionend", updateHeaderScrollOffset, { once: true });
        }, 800);
      }
    }, stepMs);
  });

})();
