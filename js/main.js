/*
 * MIN K. portfolio interactions
 * Figma prototype → web:
 *  - NAVIGATE (dissolve / smart animate, 300ms ease-in-out) → page fade out/in
 *  - SCROLL_TO (scroll animate)                              → smooth scroll
 *  - ON_HOVER CHANGE_TO variants                             → CSS :hover (style.css)
 */
(function () {
  const DURATION = 300;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function scrollToY(y) {
    window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function scrollToHash(hash) {
    const target = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      scrollToY(target.getBoundingClientRect().top + window.scrollY - margin);
    }
    else scrollToY(0);
  }

  function isSameDocument(url) {
    return url.protocol === location.protocol && url.host === location.host && url.pathname === location.pathname;
  }

  // Page transitions and in-page anchors
  document.addEventListener("click", function (event) {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;

    const url = new URL(link.getAttribute("href"), location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "file:") return;
    if (url.host !== location.host) return;

    event.preventDefault();

    if (isSameDocument(url)) {
      scrollToHash(url.hash);
      if (url.hash) history.pushState(null, "", url.hash);
      return;
    }

    try {
      sessionStorage.setItem("mk-nav", "1");
      if (!reduceMotion) sessionStorage.setItem("mk-fade", "1");
    } catch (error) {
      // storage blocked: next page simply appears without the fade
    }
    if (reduceMotion) {
      location.href = url.href;
      return;
    }
    document.body.classList.add("is-leaving");
    window.setTimeout(function () {
      location.href = url.href;
    }, DURATION);
  });

  // Back/forward cache restores the faded-out page — bring it back
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) document.body.classList.remove("is-leaving");
  });

  // Arriving through an in-site link: start at the top (or at the linked section),
  // even when the host frame restores the previous page's scroll position
  let arrivedFromSite = false;
  try {
    arrivedFromSite = sessionStorage.getItem("mk-nav") === "1";
    sessionStorage.removeItem("mk-nav");
  } catch (error) {
    arrivedFromSite = false;
  }
  if (arrivedFromSite) {
    let userMoved = false;
    ["wheel", "touchstart", "keydown"].forEach(function (type) {
      window.addEventListener(type, function () { userMoved = true; }, { once: true, passive: true });
    });
    const settle = function () {
      if (userMoved) return;
      const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (target) {
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - margin);
      } else {
        window.scrollTo(0, 0);
      }
    };
    settle();
    window.addEventListener("load", settle);
    window.setTimeout(settle, 150);
    window.setTimeout(settle, 450);
  }

  // Footer "top" buttons and the hero scroll cue
  document.querySelectorAll("[data-scroll-top]").forEach(function (button) {
    button.addEventListener("click", function () {
      scrollToY(0);
    });
  });
  document.querySelectorAll("[data-scroll-to]").forEach(function (button) {
    button.addEventListener("click", function () {
      scrollToHash("#" + button.getAttribute("data-scroll-to"));
    });
  });

  // SELECT PROJECTS filter chips
  const chips = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll("[data-category]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      const filter = chip.getAttribute("data-filter");
      chips.forEach(function (other) {
        other.setAttribute("aria-pressed", String(other === chip));
      });
      cards.forEach(function (card) {
        const match = filter === "all" || card.getAttribute("data-category").split(" ").indexOf(filter) !== -1;
        card.classList.toggle("is-dim", !match);
        if (match) card.removeAttribute("aria-hidden");
        else card.setAttribute("aria-hidden", "true");
        if (card.tagName === "A") card.tabIndex = match ? 0 : -1;
      });
    });
  });

  /* ---------------------------------------------------------
   * Web-only interactions (not in the Figma prototype)
   * --------------------------------------------------------- */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
  window.addEventListener("resize", function () {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
  });

  // Per-frame updater that runs only while its element is on screen and something is still moving.
  // `update` returns true to keep going; the returned wake() restarts it after input.
  function animateWhileVisible(element, update) {
    let frame = 0;
    let visible = false;
    function loop(time) {
      frame = visible && update(time) ? requestAnimationFrame(loop) : 0;
    }
    function wake() {
      if (visible && !frame) frame = requestAnimationFrame(loop);
    }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      wake();
    }).observe(element);
    return wake;
  }

  // Header hides while scrolling down and returns on the way back up; project pages get a progress bar
  const header = document.querySelector(".site-header");
  const progress = document.querySelector(".progress");
  let lastY = window.scrollY;
  let scrollQueued = false;
  let scrollRange = 1;
  function measureScrollRange() {
    scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  measureScrollRange();
  window.addEventListener("resize", measureScrollRange);
  window.addEventListener("load", measureScrollRange);
  if ("ResizeObserver" in window) new ResizeObserver(measureScrollRange).observe(document.body);
  function onScrollFrame() {
    scrollQueued = false;
    const y = window.scrollY;
    if (header) {
      if (y < 160 || y < lastY - 4) header.classList.remove("is-hidden");
      else if (y > lastY + 4) header.classList.add("is-hidden");
      header.classList.toggle("is-solid", y > 40);
    }
    if (progress) progress.style.transform = "scaleX(" + Math.min(1, y / scrollRange).toFixed(4) + ")";
    if (Math.abs(y - lastY) > 4) lastY = y;
  }
  window.addEventListener("scroll", function () {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(onScrollFrame);
  }, { passive: true });
  onScrollFrame();
  if (header) {
    header.addEventListener("focusin", function () {
      header.classList.remove("is-hidden");
    });
  }

  // Hero: each frame and its red circle drift apart with the pointer and with scroll
  const hero = document.querySelector(".hero");
  if (hero && !reduceMotion) {
    const shapes = Array.prototype.map.call(hero.querySelectorAll(".shape[data-depth]"), function (el) {
      const angle = -(parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0) * Math.PI / 180;
      return { el: el, dot: el.querySelector(".shape__dot"), depth: parseFloat(el.dataset.depth), cos: Math.cos(angle), sin: Math.sin(angle) };
    });
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let drawnScroll = -1;
    const wakeHero = animateWhileVisible(hero, function () {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      const scroll = window.scrollY;
      const settled = Math.abs(target.x - current.x) < 0.0005 && Math.abs(target.y - current.y) < 0.0005;
      if (settled && scroll === drawnScroll) return false;
      drawnScroll = scroll;
      shapes.forEach(function (shape) {
        const reach = shape.depth * rem;
        shape.el.style.translate = (current.x * reach).toFixed(1) + "px " + (current.y * reach - scroll * shape.depth * 0.05).toFixed(1) + "px";
        // the circle travels further than its frame, measured in the frame's rotated axes
        const dx = current.x * reach * 1.2;
        const dy = current.y * reach * 1.2;
        shape.dot.style.translate = (dx * shape.cos - dy * shape.sin).toFixed(1) + "px " + (dx * shape.sin + dy * shape.cos).toFixed(1) + "px";
      });
      return true;
    });
    if (finePointer) {
      window.addEventListener("pointermove", function (event) {
        target.x = event.clientX / window.innerWidth * 2 - 1;
        target.y = event.clientY / window.innerHeight * 2 - 1;
        wakeHero();
      }, { passive: true });
    }
    window.addEventListener("scroll", wakeHero, { passive: true });
  }

  // Project list: a preview of the project floats beside the pointer
  const list = document.querySelector(".plist");
  const preview = document.querySelector(".plist-preview");
  if (list && preview && finePointer) {
    const previewImage = preview.querySelector("img");
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let active = false;
    let frame = 0;
    function follow() {
      current.x += (target.x - current.x) * 0.18;
      current.y += (target.y - current.y) * 0.18;
      // sits below-right of the pointer, flipping sides so it never leaves the window
      const gap = 2.4 * rem;
      const edge = 16;
      const width = preview.offsetWidth;
      const height = preview.offsetHeight;
      let left = current.x + gap;
      let top = current.y + gap;
      if (left + width > window.innerWidth - edge) left = current.x - gap - width;
      if (top + height > window.innerHeight - edge) top = current.y - gap - height;
      left = Math.max(edge, left);
      top = Math.max(edge, top);
      preview.style.transform = "translate(" + left.toFixed(1) + "px," + top.toFixed(1) + "px)";
      const moving = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.5;
      frame = active || moving ? requestAnimationFrame(follow) : 0;
    }
    list.addEventListener("pointermove", function (event) {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(follow);
    });
    list.querySelectorAll("[data-preview]").forEach(function (row) {
      row.addEventListener("pointerenter", function (event) {
        if (!active) {
          current.x = target.x = event.clientX;
          current.y = target.y = event.clientY;
        }
        previewImage.src = row.getAttribute("data-preview");
        active = true;
        preview.classList.add("is-on");
        if (!frame) frame = requestAnimationFrame(follow);
      });
      row.addEventListener("pointerleave", function () {
        active = false;
        preview.classList.remove("is-on");
      });
    });
  }

  // Project cards: the VIEW ring follows the pointer inside the image
  if (finePointer) {
    document.querySelectorAll("a.card .card__media").forEach(function (media) {
      const ring = media.querySelector(".card__view");
      if (!ring) return;
      media.addEventListener("pointermove", function (event) {
        const box = media.getBoundingClientRect();
        ring.style.setProperty("--vx", (event.clientX - box.left - box.width / 2).toFixed(1) + "px");
        ring.style.setProperty("--vy", (event.clientY - box.top - box.height / 2).toFixed(1) + "px");
      });
      media.addEventListener("pointerleave", function () {
        ring.style.setProperty("--vx", "0px");
        ring.style.setProperty("--vy", "0px");
      });
    });
  }

  // Connect: the red circle chases the pointer toward the blue frame
  const connect = document.querySelector(".connect");
  if (connect && finePointer && !reduceMotion) {
    const circle = connect.querySelector(".s-connect-circle");
    const square = connect.querySelector(".s-connect-square");
    const pointer = { x: 0, y: 0 };
    const pos = { cx: 0, cy: 0, sx: 0, sy: 0 };
    const wakeConnect = animateWhileVisible(connect, function () {
      const tcx = pointer.x * 16 * rem;
      const tcy = pointer.y * 6 * rem;
      const tsx = pointer.x * -2.4 * rem;
      const tsy = pointer.y * -1.2 * rem;
      pos.cx += (tcx - pos.cx) * 0.08;
      pos.cy += (tcy - pos.cy) * 0.08;
      pos.sx += (tsx - pos.sx) * 0.08;
      pos.sy += (tsy - pos.sy) * 0.08;
      circle.style.translate = pos.cx.toFixed(1) + "px " + pos.cy.toFixed(1) + "px";
      square.style.translate = pos.sx.toFixed(1) + "px " + pos.sy.toFixed(1) + "px";
      return Math.abs(tcx - pos.cx) + Math.abs(tcy - pos.cy) + Math.abs(tsx - pos.sx) + Math.abs(tsy - pos.sy) > 0.2;
    });
    connect.addEventListener("pointermove", function (event) {
      const box = connect.getBoundingClientRect();
      pointer.x = (event.clientX - box.left) / box.width * 2 - 1;
      pointer.y = (event.clientY - box.top) / box.height * 2 - 1;
      wakeConnect();
    });
    connect.addEventListener("pointerleave", function () {
      pointer.x = 0;
      pointer.y = 0;
      wakeConnect();
    });
  }

  // Copy-to-clipboard buttons with a short confirmation
  const hint = document.querySelector(".connect__hint");
  if (hint && !finePointer) hint.textContent = "TAP TO COPY EMAIL";
  const toast = document.querySelector(".toast");
  let toastTimer = 0;
  function showToast(title, detail) {
    if (!toast) return;
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = title;
    span.textContent = detail;
    toast.replaceChildren(strong, span);
    toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-on");
    }, 2600);
  }
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      const text = button.getAttribute("data-copy");
      const copied = function () { showToast("EMAIL COPIED", text); };
      // older path for browsers or frames that refuse the async clipboard
      const fallback = function () {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(field);
        field.select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (error) {
          ok = false;
        }
        field.remove();
        if (ok) copied();
        else showToast("COPY FAILED", text);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(copied, fallback);
      else fallback();
    });
  });

  // Posters: on touch screens and keyboards, tap or press to (mis)align the grid
  document.querySelectorAll(".poster[tabindex]").forEach(function (poster) {
    function toggle() {
      poster.classList.toggle("is-shifted");
    }
    poster.addEventListener("click", function () {
      if (!finePointer) toggle();
    });
    poster.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  });

  // DIPTYQUE web showing: the sentence slowly orbits the oval photo
  const orbit = document.querySelector(".ws-orbit");
  if (orbit && !reduceMotion) {
    const path = document.getElementById("ws-oval");
    const lap = path.getTotalLength() / 2;
    const start = parseFloat(orbit.getAttribute("startOffset")) || 0;
    let drawnAt = 0;
    animateWhileVisible(orbit.closest("svg"), function (time) {
      // ~20px per second is slow enough that 25 updates per second look smooth
      if (time - drawnAt >= 40) {
        drawnAt = time;
        orbit.setAttribute("startOffset", (start + (time / 45000 * lap) % lap).toFixed(1));
      }
      return true;
    });
  }
})();
