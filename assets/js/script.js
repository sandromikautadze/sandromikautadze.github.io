'use strict';



// iOS Safari only resolves :active on an element once the document has a
// touch listener attached — without this no-op, every :active rule in
// style.css is dead exactly on the platform that needs it most.
document.addEventListener("touchstart", function () {}, { passive: true });



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

    // filtering a hovered card out sets display:none on its <li>, and a
    // display:none element does not reliably fire pointerleave — without
    // this, a stale tilt would still be baked in when the card comes back
    resetAllTilts();

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

// Poppins lands after this script runs and its metrics differ from the
// fallback face, changing the header's real height — without this, the
// scroll-padding measured above stays off for the rest of the session
if (document.fonts) document.fonts.ready.then(updateHeaderScrollOffset);



// entrance animation: give each staggered list item (blog posts, portfolio
// projects, CV entries) its own --stagger index so the CSS animation-delay
// staggers them without hardcoding :nth-child rules per page
document.querySelectorAll(".entrance-item, .project-item").forEach(function (el, i) {
  el.style.setProperty("--stagger", Math.min(i, 10));
});



/*-----------------------------------*\
  #POINTER EFFECTS
\*-----------------------------------*/

// one gate for everything cursor-driven. (hover: hover) rules out devices
// where :hover is faked by a tap and then sticks; (pointer: fine) rules out
// anything without pixel-accurate aim. If either fails, or motion is
// reduced, no listener below is ever bound and the site behaves exactly as
// it does today — the CSS in style.css is gated on the same query, so
// nothing (not even a hidden glare pseudo-element) is left half-applied.
const supportsPointerFx =
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TILT_PERSPECTIVE = 900;
const tiltResets = [];

// glare host is separate from the tilt host: the pointer roams the whole
// <a> (image plus caption on a project card) while the highlight has to
// stay inside the clipped image box, so the two need their own rects.
function bindTilt(host, glareHost, max) {
  let hostRect = null;
  let glareRect = null;
  let px = 0, py = 0, ticking = false;

  function apply() {
    ticking = false;
    if (!hostRect) return;

    const nx = (px - hostRect.left) / hostRect.width * 2 - 1;
    const ny = (py - hostRect.top) / hostRect.height * 2 - 1;

    // max of 0 (blog rows): glare only, no rotation. A 700x132 list row
    // rotating in 3D reads as a glitch, not as an object being handled —
    // but it still deserves the light-catching-glass highlight.
    if (max > 0) {
      // rotateY is negated so the corner under the cursor lifts toward the
      // viewer rather than receding: a bright glare on a receding face is
      // what makes cheap tilt effects look wrong
      host.style.transform =
        "perspective(" + TILT_PERSPECTIVE + "px)" +
        " rotateX(" + (ny * max).toFixed(2) + "deg)" +
        " rotateY(" + (-nx * max).toFixed(2) + "deg)";
    }

    if (glareRect) {
      host.style.setProperty("--glare-x", ((px - glareRect.left) / glareRect.width * 100).toFixed(1) + "%");
      host.style.setProperty("--glare-y", ((py - glareRect.top) / glareRect.height * 100).toFixed(1) + "%");
    }
  }

  function reset() {
    hostRect = null;
    host.style.transform = "";
    host.style.removeProperty("--glare-x");
    host.style.removeProperty("--glare-y");
  }

  host.addEventListener("pointerenter", function (e) {
    // measured once per hover, not on every move: nothing in the card's
    // layout shifts while the pointer is inside it, and reading a rect
    // right after writing a transform would force a style+layout flush on
    // every single frame
    hostRect = host.getBoundingClientRect();
    glareRect = glareHost ? glareHost.getBoundingClientRect() : null;
    px = e.clientX; py = e.clientY;
    apply();
  });

  host.addEventListener("pointermove", function (e) {
    px = e.clientX; py = e.clientY;
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  });

  host.addEventListener("pointerleave", reset);
  host.addEventListener("pointercancel", reset);

  tiltResets.push(reset);
}

function resetAllTilts() {
  tiltResets.forEach(function (reset) { reset(); });
}

if (supportsPointerFx) {
  // portfolio cards tilt (4°, the surface actually looks like a card)
  document.querySelectorAll(".project-item > a").forEach(function (a) {
    bindTilt(a, a.querySelector(".project-img"), 4);
  });

  // blog rows: glare only (max 0), no rotation — see the comment in apply()
  document.querySelectorAll(".blog-post-item > a").forEach(function (a) {
    bindTilt(a, a, 0);
  });
}


// magnetic pull on the two hero CTAs. Bound to window, not the elements:
// the pull has to begin before the pointer arrives, and an element only
// hears pointermove once the pointer is already over it.
if (supportsPointerFx) {
  const magnets = document.querySelectorAll("[data-magnet]");

  if (magnets.length) {
    const MAGNET_PAD = 60;
    const MAGNET_MAX = 6;
    let mx = 0, my = 0, magnetTicking = false;

    function updateMagnets() {
      magnetTicking = false;
      // all rects read before any transform is written: interleaving reads
      // and writes forces one layout flush per element instead of one total
      const rects = [];
      magnets.forEach(function (el) { rects.push(el.getBoundingClientRect()); });

      magnets.forEach(function (el, i) {
        const r = rects[i];
        const dx = (mx - (r.left + r.width / 2)) / (r.width / 2 + MAGNET_PAD);
        const dy = (my - (r.top + r.height / 2)) / (r.height / 2 + MAGNET_PAD);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { el.style.transform = ""; return; }
        el.style.transform =
          "translate(" + (dx * MAGNET_MAX).toFixed(2) + "px, " + (dy * MAGNET_MAX).toFixed(2) + "px)";
      });
    }

    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!magnetTicking) { magnetTicking = true; requestAnimationFrame(updateMagnets); }
    }, { passive: true });
  }
}



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



/*-----------------------------------*\
  #SCROLL-SCRUBBED WORD REVEAL
\*-----------------------------------*/

// Wraps each word of a block in its own inline span, in place. Element
// nodes are never removed or re-parsed, so a <strong> or an
// <a class="inline-link"> survives with its attributes, identity and
// listeners intact — the words inside it get wrapped too and join the
// reveal in document order.
function wrapWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  const words = [];
  let node;

  // collected up front rather than replaced during the walk: swapping the
  // node the walker is parked on moves the walker into the replacement, and
  // it then re-walks the text it just produced, forever
  while ((node = walker.nextNode())) {
    const tag = node.parentNode.nodeName;
    if (tag === "SCRIPT" || tag === "STYLE") continue;
    if (node.nodeValue.trim() !== "") textNodes.push(node);
  }

  textNodes.forEach(function (textNode) {
    const frag = document.createDocumentFragment();

    // split on whitespace but KEEP it (capturing group) and re-emit it as a
    // real text node — that is what makes the rewrite invisible to
    // selection and the clipboard: the character stream stays byte-
    // identical, only extra inline element boundaries are introduced
    // around the non-space runs
    textNode.nodeValue.split(/(\s+)/).forEach(function (chunk) {
      if (chunk === "") return;
      if (/\s/.test(chunk)) {
        frag.appendChild(document.createTextNode(chunk));
        return;
      }
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = chunk;
      frag.appendChild(span);
      words.push(span);
    });

    textNode.parentNode.replaceChild(frag, textNode);
  });

  return words;
}

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {

  const scrubBlocks = [];

  document.querySelectorAll("[data-scrub]").forEach(function (el) {
    const words = wrapWords(el);
    if (words.length) scrubBlocks.push({ el: el, words: words, lit: 0 });
  });

  if (scrubBlocks.length) {
    const armed = new Set();
    let scrubTicking = false;

    function updateScrub() {
      scrubTicking = false;
      const vh = window.innerHeight;

      armed.forEach(function (block) {
        const rect = block.el.getBoundingClientRect();

        // the scrub window scales with the block's own height, so a four-
        // paragraph section and a two-line one finish at about the same
        // point on screen instead of the tall one flashing past in half a
        // viewport of scrolling
        const total = rect.height + vh * 0.30;
        const travelled = vh * 0.90 - rect.top;
        const p = Math.min(1, Math.max(0, travelled / total));
        const target = Math.round(p * block.words.length);

        // only the words that changed state this frame are touched, not
        // all of them — O(delta), not O(n). Works in both directions.
        while (block.lit < target) block.words[block.lit++].classList.add("is-lit");
        while (block.lit > target) block.words[--block.lit].classList.remove("is-lit");
      });
    }

    // arm/disarm so the maths only runs for blocks that are actually on
    // screen
    const scrubObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const block = scrubBlocks.find(function (b) { return b.el === entry.target; });
        if (entry.isIntersecting) armed.add(block); else armed.delete(block);
      });
      updateScrub();
    });

    scrubBlocks.forEach(function (block) { scrubObserver.observe(block.el); });

    window.addEventListener("scroll", function () {
      if (!scrubTicking) { scrubTicking = true; requestAnimationFrame(updateScrub); }
    }, { passive: true });

    window.addEventListener("resize", updateScrub);
  }

}



/*-----------------------------------*\
  #SHARED-ELEMENT MORPH (blog -> post)
\*-----------------------------------*/

// view-transition-name has to be unique across everything rendered in a
// snapshot, so a list of ten cards cannot carry it in the stylesheet. It is
// stamped on the single thumbnail that was clicked, immediately before the
// navigation that captures it. Only same-origin links qualify: a cross-
// document transition to an external medium.com post is not a thing.
(function () {

  let morphSource = null;

  document.querySelectorAll(".blog-post-item > a[href^='post.html']").forEach(function (link) {
    link.addEventListener("click", function () {
      const thumb = link.querySelector(".blog-banner-box");
      if (!thumb) return;
      // the figure, not the bare <img>: it carries the rounded corners and
      // the clip, so the morph reads as one box growing rather than a
      // bitmap flying loose
      thumb.style.viewTransitionName = "post-hero";
      morphSource = thumb;
    });
  });

  // bfcache can hand this exact document back on a Back navigation with the
  // name still stamped on it, which would collide on a second click.
  // pageshow fires on both the initial load and the bfcache restore.
  window.addEventListener("pageshow", function () {
    if (!morphSource) return;
    morphSource.style.viewTransitionName = "";
    morphSource = null;
  });

})();



/*-----------------------------------*\
  #HERO AMBIENT LAYERS (index.html)
\*-----------------------------------*/

// Every hero layer is driven by three numbers written on .hero: --sp (0..1
// progress scrolling through the hero) and --px/--py (-1..1 pointer offset
// from the viewport centre). CSS decides what each layer does with them.
// This file deliberately never touches `transform` itself — that is what
// stops the scroll motion and the pointer parallax from overwriting each
// other, which is exactly what happens when two handlers share one element.
(function () {

  const hero = document.querySelector(".hero");
  if (!hero) return;

  const net = document.querySelector("[data-hero-net]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  /**
   * scroll + pointer inputs
   */

  let pointerX = 0;
  let pointerY = 0;
  let inputTicking = false;

  function flushInputs() {
    inputTicking = false;
    const rect = hero.getBoundingClientRect();
    // guard the divide: a zero-height hero yields NaN, and one NaN custom
    // property invalidates the whole transform consuming it, dropping the
    // hero content back to its untransformed position mid-scroll
    const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
    hero.style.setProperty("--sp", progress.toFixed(4));
    hero.style.setProperty("--px", pointerX.toFixed(4));
    hero.style.setProperty("--py", pointerY.toFixed(4));
  }

  function requestInputFlush() {
    if (inputTicking) return;
    inputTicking = true;
    requestAnimationFrame(flushInputs);
  }

  if (!reducedMotion) {
    window.addEventListener("scroll", requestInputFlush, { passive: true });
    window.addEventListener("resize", requestInputFlush);

    // mouse only: a touch device fires pointermove only mid-drag, so the
    // layers would lurch around while the user is trying to scroll. No
    // pointerleave handler either — the layers keep their last offset when
    // the cursor leaves the window, where nobody can see them anyway.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener("pointermove", function (event) {
        pointerX = (event.clientX / window.innerWidth) * 2 - 1;
        pointerY = (event.clientY / window.innerHeight) * 2 - 1;
        requestInputFlush();
      }, { passive: true });
    }

    flushInputs();
  }


  /**
   * ambient neural network: a sparse particle system with distance-based
   * links and the occasional pulse travelling one edge. Unlike the one-shot
   * intro animation this replaces, this runs for as long as the tab is
   * open, so every constant below is sized for a cost paid forever.
   */

  if (!net) return;

  const ctx = net.getContext("2d");
  // capped at 2: a 3x phone would otherwise push 9x the pixels through the
  // fill for a layer that is deliberately faint and half-transparent
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const LINK_DIST_SQ = 150 * 150;
  const BAND_ALPHA = [0.08, 0.15, 0.26];
  const FRAME_MS = 32;
  const MAX_PULSES = 4;
  const PULSE_SECS = 1.8;
  const TAU = Math.PI * 2;

  const nodes = [];
  let pulses = [];
  let width = 0;
  let height = 0;
  let accent = "";
  let rafId = 0;
  let last = 0;
  let onScreen = true;

  function readAccent() {
    accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f6f66";
  }

  function resize() {
    const rect = net.getBoundingClientRect();
    const prevWidth = width;
    const prevHeight = height;
    width = rect.width;
    height = rect.height;
    net.width = Math.round(width * dpr);
    net.height = Math.round(height * dpr);
    // setting width/height resets the context, so the scale goes after
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // rescale the existing field into the new box before anything else.
    // Clamping alone (what this used to do) only ever pulls nodes inward, so
    // growing the canvas — maximising the window, closing devtools, an
    // orientation flip — left every node stranded in the old, smaller region
    // and the whole network visibly bunched toward the top-left corner.
    if (prevWidth > 0 && prevHeight > 0 && nodes.length) {
      const scaleX = width / prevWidth;
      const scaleY = height / prevHeight;
      nodes.forEach(function (n) {
        n.x *= scaleX;
        n.y *= scaleY;
      });
    }

    // one node per 15000px², clamped: 100 on a large desktop, floor of 26 on
    // a phone. The ceiling has to be generous or a big monitor ends up with a
    // visibly sparser field than a laptop. Linking is O(n²) over the pairs,
    // so 100 nodes cost ~4950 checks a frame — but at the 30fps gate that is
    // ~150k/s, still under the old one-shot ceremony (90 nodes at an uncapped
    // 60-120fps), and it stops entirely once the hero scrolls away.
    const target = Math.max(26, Math.min(100, Math.round((width * height) / 15000)));
    while (nodes.length > target) nodes.pop();
    while (nodes.length < target) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        // px per second, not per frame, so the drift is identical whether a
        // frame lands at 30Hz or 120Hz
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14
      });
    }
    // belt and braces after the rescale: a node sitting exactly on an edge
    // can round just outside it, where the bounce test would trap it
    nodes.forEach(function (n) {
      n.x = Math.min(Math.max(n.x, 0), width);
      n.y = Math.min(Math.max(n.y, 0), height);
    });
  }

  // pulses travel a real link rather than between two random nodes: a dot
  // crossing empty space doesn't read as a signal, it reads as a bug
  function spawnPulse() {
    const from = nodes[Math.floor(Math.random() * nodes.length)];
    const offset = Math.floor(Math.random() * nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const to = nodes[(offset + i) % nodes.length];
      if (to === from) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (dx * dx + dy * dy < LINK_DIST_SQ) {
        pulses.push({ from: from, to: to, t: 0 });
        return;
      }
    }
  }

  function draw(dt) {
    nodes.forEach(function (n) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    });

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;

    // links accumulate into three alpha bands and one Path2D each, so a
    // frame costs three stroke() calls instead of one per link (~400)
    const bands = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        // squared distance: the falloff curve differs slightly from the
        // linear one, but at these alphas no eye can tell and it drops
        // ~950 sqrt calls a frame
        const d2 = dx * dx + dy * dy;
        if (d2 >= LINK_DIST_SQ) continue;
        const band = bands[d2 < LINK_DIST_SQ / 3 ? 2 : d2 < LINK_DIST_SQ / 1.5 ? 1 : 0];
        band.moveTo(nodes[i].x, nodes[i].y);
        band.lineTo(nodes[j].x, nodes[j].y);
      }
    }
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = BAND_ALPHA[b];
      ctx.stroke(bands[b]);
    }

    const dots = new Path2D();
    nodes.forEach(function (n) {
      // moveTo before each arc, or Path2D joins them with a straight line
      dots.moveTo(n.x + 1.8, n.y);
      dots.arc(n.x, n.y, 1.8, 0, TAU);
    });
    ctx.globalAlpha = 0.45;
    ctx.fill(dots);

    if (pulses.length < MAX_PULSES && Math.random() < dt * 1.1) spawnPulse();
    const heads = new Path2D();
    pulses.forEach(function (p) {
      p.t += dt / PULSE_SECS;
      const x = p.from.x + (p.to.x - p.from.x) * p.t;
      const y = p.from.y + (p.to.y - p.from.y) * p.t;
      heads.moveTo(x + 2.6, y);
      heads.arc(x, y, 2.6, 0, TAU);
    });
    ctx.globalAlpha = 0.75;
    ctx.fill(heads);
    pulses = pulses.filter(function (p) { return p.t < 1; });
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    // ~30fps. Nodes drift at about 7px/s, so half the frames are wasted on
    // motion nobody can resolve, and this cost is paid for the life of the
    // tab rather than for four seconds.
    if (now - last < FRAME_MS) return;
    // clamped: returning from a paused tab must not teleport every node
    const dt = Math.min(now - last, 100) / 1000;
    last = now;
    draw(dt);
  }

  function start() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
    // the canvas is deliberately left painted: scrolling back up finds the
    // network where it was rather than popping in from an empty frame
  }

  function sync() {
    if (onScreen && !document.hidden) start(); else stop();
  }

  readAccent();
  resize();

  if (reducedMotion) {
    // one static frame. dt of 0 means no drift and no pulse spawn, and the
    // layer still has to be on screen or the hero looks empty.
    draw(0);
  } else {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }).observe(hero);

    // rAF is already throttled in a backgrounded tab, but not in a window
    // that is merely occluded, and this makes the resume path explicit
    document.addEventListener("visibilitychange", sync);
    sync();
  }

  let resizeQueued = false;
  window.addEventListener("resize", function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      resizeQueued = false;
      resize();
      if (reducedMotion) draw(0);
    });
  });

  // the dark palette's accent is a different, much lighter teal — keeping
  // the light one would leave the network nearly invisible after an OS flip
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    readAccent();
    if (reducedMotion) draw(0);
  });

})();
