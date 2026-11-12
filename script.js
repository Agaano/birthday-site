/* Скролл-эффекты, привязанные к положению блока во вьюпорте.
   Не таймеры: всё управляется прокруткой, поэтому анимации обратимы
   и не «играют» сами по себе.

   data-fx:
     drift        — вертикальный параллакс (data-speed: >0 отстаёт, <0 навстречу)
     slide-left   — блок выезжает из-за левого края экрана
     slide-right  — блок выезжает из-за правого края экрана
     fade         — прозрачность зависит от близости к центру экрана
     scale        — мягкое увеличение при подходе к центру
     tilt         — лёгкий наклон (data-dir: 1 / -1), выпрямляется при входе
     rise         — подъём снизу с проявлением
*/

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var LERP = 0.09;       // плавность приближения
  var MAX_DRIFT = 90;    // предел вертикального смещения, px
  var SETTLE = 80;       // запас за краем экрана для выездов, px

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  var items = Array.prototype.slice.call(
    document.querySelectorAll("[data-fx]")
  ).map(function (el) {
    var type = el.getAttribute("data-fx");
    return {
      el: el,
      type: type,
      speed: parseFloat(el.getAttribute("data-speed")) || 0,
      dir: parseFloat(el.getAttribute("data-dir")) || 1,
      // Слой drift двигается внутри родительского «окна» — измеряем окно.
      measure: type === "drift" ? (el.parentElement || el) : el,
      enter: null,
      drift: null
    };
  });

  if (!items.length) return;

  var vh = document.documentElement.clientHeight;
  var vw = document.documentElement.clientWidth;

  window.addEventListener("resize", function () {
    vh = document.documentElement.clientHeight;
    vw = document.documentElement.clientWidth;
  });

  // Позиция в документе без учёта transform (offsetTop/offsetLeft).
  function absPos(el) {
    var top = 0, left = 0, node = el;
    while (node) {
      top += node.offsetTop;
      left += node.offsetLeft;
      node = node.offsetParent;
    }
    return { top: top, left: left };
  }

  var reads = [];

  function tick() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var centerY = scrollTop + vh / 2;

    // Чтение геометрии — до записи стилей.
    for (var i = 0; i < items.length; i++) {
      var m = items[i].measure;
      var pos = absPos(m);
      reads[i] = {
        top: pos.top,
        left: pos.left,
        height: m.offsetHeight,
        width: m.offsetWidth
      };
    }

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var r = reads[j];
      var cDoc = r.top + r.height / 2;
      var offset = (cDoc - centerY) / (vh / 2); // 0 — блок в центре экрана
      var enterTarget = clamp01(1 - offset);
      var el = item.el;

      // Первый кадр: сразу в правильное состояние, без «прыжка» с нуля.
      if (item.enter === null) item.enter = enterTarget;
      item.enter += (enterTarget - item.enter) * LERP;
      var e = smooth(item.enter);

      switch (item.type) {
        case "drift": {
          var target = (cDoc - centerY) * item.speed * -1;
          if (target > MAX_DRIFT) target = MAX_DRIFT;
          if (target < -MAX_DRIFT) target = -MAX_DRIFT;
          if (item.drift === null) item.drift = target;
          item.drift += (target - item.drift) * LERP;
          el.style.transform = "translate3d(0," + item.drift.toFixed(2) + "px,0)";
          break;
        }

        case "slide-left": {
          var dLeft = r.left + r.width + SETTLE;
          el.style.transform =
            "translate3d(" + (-dLeft * (1 - e)).toFixed(2) + "px,0,0)";
          el.style.opacity = (0.2 + 0.8 * e).toFixed(3);
          break;
        }

        case "slide-right": {
          var dRight = vw - r.left + SETTLE;
          el.style.transform =
            "translate3d(" + (dRight * (1 - e)).toFixed(2) + "px,0,0)";
          el.style.opacity = (0.2 + 0.8 * e).toFixed(3);
          break;
        }

        case "fade": {
          var c = smooth(clamp01(1 - Math.abs(offset)));
          el.style.opacity = (0.15 + 0.85 * c).toFixed(3);
          break;
        }

        case "scale": {
          var s = 0.93 + 0.07 * e;
          el.style.transform = "scale(" + s.toFixed(4) + ")";
          el.style.opacity = (0.25 + 0.75 * e).toFixed(3);
          break;
        }

        case "tilt": {
          var deg = (1 - e) * 2 * item.dir;
          el.style.transform =
            "translate3d(0," + ((1 - e) * 30).toFixed(2) + "px,0) rotate(" +
            deg.toFixed(2) + "deg)";
          el.style.opacity = (0.25 + 0.75 * e).toFixed(3);
          break;
        }

        case "rise": {
          el.style.transform =
            "translate3d(0," + ((1 - e) * 60).toFixed(2) + "px,0)";
          // На светлом фоне слишком прозрачные блоки теряют контраст.
          el.style.opacity = (0.4 + 0.6 * e).toFixed(3);
          break;
        }
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

/* ===== Шутка в заголовке вкладки ===== */
(function () {
  "use strict";
  var baseTitle = document.title;
  document.addEventListener("visibilitychange", function () {
    document.title = document.hidden ? "вернись, тут торт" : baseTitle;
  });
})();

/* ===== Частицы =====
   Один холст на всю страницу (canvas#confetti зафиксирован во вьюпорте),
   поэтому координаты частиц — экранные. Отсюда же стреляют конфетти
   и существа при клике. */
(function () {
  "use strict";

  var canvas = document.getElementById("confetti");
  if (!canvas) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;
  var parts = [];
  var running = false;

  // Цвета из палитры картины
  var COLORS = ["#8a4a3f", "#b08a5f", "#6f7d4f", "#c9a227", "#5b4a3a"];

  // Спрайты частиц: перья, мясо и лепестки.
  function loadSprites(dir, name, count) {
    var list = [];
    for (var i = 1; i <= count; i++) {
      var img = new Image();
      img.src = "assets/" + dir + "/" + name + "-" + i + ".png";
      list.push(img);
    }
    return list;
  }

  var WHITE_FEATHERS = loadSprites("feathers", "feather", 7);
  var MEAT_CHUNKS = loadSprites("feathers", "meat", 5);
  var WHITE_PETALS = loadSprites("petals", "white", 3);
  var YELLOW_PETALS = loadSprites("petals", "yellow", 3);
  var RED_PETALS = loadSprites("petals", "red", 6);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }
  resize();
  window.addEventListener("resize", resize);

  /* opts:
       colors    — массив цветов
       count     — сколько частиц
       speedMin / speedMax — начальная скорость разлёта
       bias      — вертикальный импульс (минус — вверх)
       gravity   — гравитация за кадр
       drag      — сопротивление воздуха
       lifeMin / lifeRange — время жизни в кадрах
       sizeMin / sizeMax   — размер частиц
       round     — круглые вместо прямоугольников
       sprites   — массив картинок: если задан, частицы рисуются спрайтами
       spriteMin / spriteMax — высота спрайта на экране, px */
  function burst(x, y, opts) {
    opts = opts || {};
    var colors = opts.colors || COLORS;
    var count = opts.count || 100;
    var speedMin = opts.speedMin != null ? opts.speedMin : 3;
    var speedMax = opts.speedMax != null ? opts.speedMax : 11;
    var bias = opts.bias != null ? opts.bias : -3.5;
    var gravity = opts.gravity != null ? opts.gravity : 0.12;
    var drag = opts.drag != null ? opts.drag : 0.995;
    var lifeMin = opts.lifeMin || 110;
    var lifeRange = opts.lifeRange != null ? opts.lifeRange : 70;
    var sizeMin = opts.sizeMin || 3;
    var sizeMax = opts.sizeMax || 8;
    var sprites = opts.sprites || null;
    var spriteMin = opts.spriteMin != null ? opts.spriteMin : 10;
    var spriteMax = opts.spriteMax != null ? opts.spriteMax : 18;

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = speedMin + Math.random() * (speedMax - speedMin);
      var size = sizeMin + Math.random() * (sizeMax - sizeMin);
      parts.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + bias,
        w: size,
        h: size * 1.6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
        gravity: gravity,
        drag: drag,
        round: !!opts.round,
        sprite: sprites ? sprites[(Math.random() * sprites.length) | 0] : null,
        spriteH: spriteMin + Math.random() * (spriteMax - spriteMin),
        life: 0,
        ttl: lifeMin + Math.random() * lifeRange
      });
    }

    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  }

  function loop() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var alive = false;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life++;
      if (p.life > p.ttl) continue;

      alive = true;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y - p.h > H) { p.life = p.ttl; continue; }

      var alpha = p.life > p.ttl - 35 ? (p.ttl - p.life) / 35 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;

      if (p.sprite && p.sprite.complete && p.sprite.naturalWidth) {
        var sh = p.spriteH;
        var sw = sh * p.sprite.naturalWidth / p.sprite.naturalHeight;
        // лёгкая тень, чтобы белые перья читались на светлом фоне
        ctx.shadowColor = "rgba(43, 33, 26, 0.28)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.drawImage(p.sprite, -sw / 2, -sh / 2, sw, sh);
      } else if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
    }

    parts = parts.filter(function (p) { return p.life <= p.ttl; });

    if (alive) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      ctx.clearRect(0, 0, W, H);
    }
  }

  // Наружу — запуск частиц и готовые наборы спрайтов.
  window.BirthdayParticles = {
    burst: burst,
    whiteFeathers: WHITE_FEATHERS,
    meat: MEAT_CHUNKS,
    petals: {
      white: WHITE_PETALS,
      yellow: YELLOW_PETALS,
      red: RED_PETALS
    }
  };

  /* ===== Конфетти по кнопке (не автоматически) ===== */
  var btn = document.getElementById("confetti-btn");
  if (!btn) return;

  btn.addEventListener("click", function () {
    if (reduced) return;
    var r = btn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + 8, {
      colors: COLORS,
      count: 110,
      speedMin: 3,
      speedMax: 11,
      bias: -3.5,
      gravity: 0.12,
      drag: 0.995,
      lifeMin: 110,
      lifeRange: 70,
      sizeMin: 3,
      sizeMax: 8
    });
  });
})();

/* ===== Летающие существа =====
   8 существ (все готовые картинки), закреплённых в документе
   (position: absolute). Позиции случайные при каждой загрузке страницы.
   Горизонтальный параллакс как у [data-fx="slide-left/right"]: пока блок
   приближается к центру экрана, существо въезжает из-за края и
   останавливается в своей точке (до противоположного края не долетает).
   Когда скролл останавливается — «полёт» на месте (вверх-вниз).
   Клик: белые перья. Третий клик: мясо (как у грибов) и исчезновение. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = window.BirthdayParticles || {};

  var LERP = 0.09;  // плавность въезда
  var SETTLE = 80;  // запас за краем экрана, чтобы существо скрылось

  var ASSETS = [
    "assets/creatures/creature-1.png",
    "assets/creatures/creature-2.png",
    "assets/creatures/creature-3.png",
    "assets/creatures/creature-4.png",
    "assets/creatures/creature-5.png",
    "assets/creatures/creature-6.png",
    "assets/creatures/creature-7.png",
    "assets/creatures/creature-8.png"
  ];

  // 8 базовых + 15 случайных существ.
  // Раскладываем по случайным вертикальным полосам и горизонтальным точкам.
  var EXTRA = 15;
  var TOTAL = ASSETS.length + EXTRA;

  var DEFS = (function () {
    var bands = [];
    for (var b = 0; b < TOTAL; b++) bands.push(b);

    for (var s = bands.length - 1; s > 0; s--) {
      var r = (Math.random() * (s + 1)) | 0;
      var tmp = bands[s];
      bands[s] = bands[r];
      bands[r] = tmp;
    }

    var bandH = 82 / TOTAL; // 8% … 90% высоты документа

    var defs = [];
    for (var i = 0; i < TOTAL; i++) {
      var asset = i < ASSETS.length
        ? ASSETS[i]
        : ASSETS[(Math.random() * ASSETS.length) | 0];

      var dir = Math.random() < 0.5 ? "left" : "right";
      var top = 8 + (bands[i] + 0.12 + Math.random() * 0.76) * bandH;
      var left = dir === "left"
        ? 50 + Math.random() * 20   // финиш ближе к правому краю
        : 8 + Math.random() * 26;   // финиш ближе к левому краю

      defs.push({
        top: +top.toFixed(1),
        left: +left.toFixed(1),
        dir: dir,
        asset: asset
      });
    }

    return defs;
  })();

  var WHITE = {
    colors: ["#ffffff", "#f4efe6", "#e7ddcf"],
    count: 18,
    speedMin: 1.5,
    speedMax: 5.5,
    bias: -1.2,
    gravity: 0.045,
    drag: 0.99,
    lifeMin: 60,
    lifeRange: 60,
    sizeMin: 2,
    sizeMax: 5,
    round: true,
    sprites: FX.whiteFeathers,
    spriteMin: 16,
    spriteMax: 28
  };

  var RED = {
    colors: ["#c0392b", "#8a2f28", "#e05a4a"],
    count: 60,
    speedMin: 3,
    speedMax: 9.5,
    bias: -2.5,
    gravity: 0.12,
    drag: 0.99,
    lifeMin: 45,
    lifeRange: 55,
    sizeMin: 2.5,
    sizeMax: 7,
    round: true,
    sprites: FX.meat,
    spriteMin: 16,
    spriteMax: 28
  };

  var layer = document.createElement("div");
  layer.className = "creature-layer";
  document.body.appendChild(layer);

  var docH = 0;

  var items = DEFS.map(function (def, i) {
    var el = document.createElement("div");
    el.className = "creature";
    el.style.top = def.top + "%";
    el.style.left = def.left + "%";
    el.style.setProperty("--bob-delay", (-i * 0.55).toFixed(2) + "s");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Летающее существо, нажми на него");

    var bob = document.createElement("div");
    bob.className = "creature__bob";

    var art = document.createElement("img");
    art.className = "creature__art";
    art.src = def.asset;
    art.alt = "";
    art.draggable = false;

    bob.appendChild(art);
    el.appendChild(bob);
    layer.appendChild(el);

    return {
      el: el,
      art: art,
      dir: def.dir,
      baseCenter: 0,
      distance: 0,
      enter: null,
      hits: 0,
      dead: false
    };
  });

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // Высота слоя = высота контента страницы (без самого слоя, иначе он
  // сам себе добавляет высоту); от неё считаются % позиции существ.
  // Здесь же считаем путь до края при текущей ширине окна.
  function syncSize() {
    docH = document.body.getBoundingClientRect().height;
    layer.style.height = docH + "px";

    var trackW = layer.clientWidth;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var anchorLeft = it.el.offsetLeft;
      var width = it.el.offsetWidth;

      it.baseCenter = docH * DEFS[i].top / 100 + it.el.offsetHeight / 2;
      it.distance = it.dir === "left"
        ? anchorLeft + width + SETTLE            // спрятать за левым краем
        : trackW - anchorLeft + SETTLE;          // спрятать за правым краем
    }
  }

  function frame() {
    var vh = window.innerHeight;
    var centerY =
      (window.pageYOffset || document.documentElement.scrollTop) + vh / 2;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.dead) continue;

      // 0 — блок далеко внизу, 1 — дошёл до центра экрана.
      var offset = (it.baseCenter - centerY) / (vh / 2);
      var target = clamp01(1 - offset);

      if (it.enter === null) it.enter = target;
      it.enter += (target - it.enter) * LERP;

      var e = smooth(it.enter);
      var sign = it.dir === "left" ? -1 : 1;
      var x = it.distance * (1 - e) * sign;

      it.el.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
      it.el.style.opacity = (0.2 + 0.8 * e).toFixed(3);
    }

    requestAnimationFrame(frame);
  }

  function emit(x, y, opts) {
    if (reduced) return;
    if (window.BirthdayParticles) window.BirthdayParticles.burst(x, y, opts);
  }

  function hit(it) {
    if (it.dead) return;
    it.hits++;

    var r = it.art.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;

    // Перезапуск анимации попадания.
    it.art.classList.remove("is-hit");
    void it.art.offsetWidth;
    it.art.classList.add("is-hit");

    if (it.hits >= 3) {
      it.dead = true;
      it.el.classList.add("is-dead");
      it.el.tabIndex = -1;
      it.el.style.pointerEvents = "none";
      emit(cx, cy, RED);

      setTimeout(function () {
        if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
      }, 500);
    } else {
      emit(cx, cy, WHITE);
    }

    document.dispatchEvent(new CustomEvent("birthday:hit", {
      detail: { type: "creature", killed: it.hits >= 3 }
    }));
  }

  items.forEach(function (it) {
    it.el.addEventListener("click", function (e) {
      e.preventDefault();
      hit(it);
    });

    it.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        hit(it);
      }
    });
  });

  var stopTimer = 0;

  function onScroll() {
    // Пока скролл идёт — параллакс, остановились — покачиваемся на месте.
    layer.classList.add("is-moving");
    clearTimeout(stopTimer);
    stopTimer = setTimeout(function () {
      layer.classList.remove("is-moving");
    }, 150);
  }

  syncSize();

  if (!reduced) {
    requestAnimationFrame(frame);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  window.addEventListener("resize", syncSize);
  window.addEventListener("load", syncSize);

  if (window.ResizeObserver) {
    new ResizeObserver(syncSize).observe(document.body);
  }
})();

/* ===== Грибы внизу документа =====
   Другой тип существ: растут в самом низу страницы (в футере) и всегда
   стреляют красными частицами (в отличие от летающих — у тех белые).
   Прорастают, когда до них доскроллили.
   Механика кликов прежняя: третий клик — большой залп и исчезновение.

   Ассеты: картинка гриба и «перья»-мясо. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = window.BirthdayParticles || {};
  var COUNT = 8;

  var RED_SMALL = {
    colors: ["#c0392b", "#8a2f28", "#e05a4a"],
    count: 18,
    speedMin: 1.5,
    speedMax: 5.5,
    bias: -2,
    gravity: 0.12,
    drag: 0.99,
    lifeMin: 45,
    lifeRange: 40,
    sizeMin: 2,
    sizeMax: 5.5,
    round: true,
    sprites: FX.meat,
    spriteMin: 12,
    spriteMax: 20
  };

  var RED_BIG = {
    colors: ["#c0392b", "#8a2f28", "#e05a4a"],
    count: 60,
    speedMin: 3,
    speedMax: 10,
    bias: -2.5,
    gravity: 0.12,
    drag: 0.99,
    lifeMin: 45,
    lifeRange: 55,
    sizeMin: 2.5,
    sizeMax: 7,
    round: true,
    sprites: FX.meat,
    spriteMin: 16,
    spriteMax: 28
  };

  var layer = document.createElement("div");
  layer.className = "shroom-layer";

  // Живут в футере — это самый низ документа, а не вьюпорта.
  var host = document.querySelector(".footer") || document.body;
  host.appendChild(layer);

  var items = [];

  for (var i = 0; i < COUNT; i++) {
    var el = document.createElement("div");
    el.className = "shroom";
    el.style.left = ((i + 0.5) / COUNT * 100) + "%";
    el.style.setProperty("--grow-delay", (0.15 + i * 0.07).toFixed(2) + "s");
    el.style.setProperty("--s", (0.88 + Math.random() * 0.18).toFixed(3));
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Гриб, нажми на него");

    var grow = document.createElement("div");
    grow.className = "shroom__grow";

    var art = document.createElement("img");
    art.className = "shroom__art";
    art.src = "assets/mushrooms/mushroom.png";
    art.alt = "";
    art.draggable = false;

    grow.appendChild(art);
    el.appendChild(grow);
    layer.appendChild(el);

    items.push({ el: el, art: art, hits: 0, dead: false });
  }

  function emit(x, y, opts) {
    if (reduced) return;
    if (window.BirthdayParticles) window.BirthdayParticles.burst(x, y, opts);
  }

  function hit(it) {
    if (it.dead) return;
    it.hits++;

    var r = it.art.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;

    it.art.classList.remove("is-hit");
    void it.art.offsetWidth;
    it.art.classList.add("is-hit");

    if (it.hits >= 3) {
      it.dead = true;
      it.el.classList.add("is-dead");
      it.el.tabIndex = -1;
      it.el.style.pointerEvents = "none";
      emit(cx, cy, RED_BIG);

      setTimeout(function () {
        if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
      }, 500);
    } else {
      // Грибы всегда дают красные частицы — и на первом, и на втором клике.
      emit(cx, cy, RED_SMALL);
    }

    document.dispatchEvent(new CustomEvent("birthday:hit", {
      detail: { type: "shroom", killed: it.hits >= 3 }
    }));
  }

  items.forEach(function (it) {
    it.el.addEventListener("click", function (e) {
      e.preventDefault();
      hit(it);
    });

    it.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        hit(it);
      }
    });
  });

  // Прорастаем, когда низ документа попадает в кадр.
  function sprout() {
    layer.classList.add("is-grown");
  }

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          sprout();
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.01 });

    io.observe(layer);
  } else {
    sprout();
  }
})();

/* ===== Крылатые грибы =====
   Летают чуть выше обычных грибов в футере. Убиваются за 3 клика,
   каждый клик — мясо, как у обычных грибов. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = window.BirthdayParticles || {};
  var COUNT = 3;

  var MEAT_SMALL = {
    colors: ["#c0392b", "#8a2f28", "#e05a4a"],
    count: 16,
    speedMin: 1.5,
    speedMax: 5.5,
    bias: -2,
    gravity: 0.12,
    drag: 0.99,
    lifeMin: 45,
    lifeRange: 40,
    sizeMin: 2,
    sizeMax: 5.5,
    round: true,
    sprites: FX.meat,
    spriteMin: 12,
    spriteMax: 20
  };

  var MEAT_BIG = {
    colors: ["#c0392b", "#8a2f28", "#e05a4a"],
    count: 60,
    speedMin: 3,
    speedMax: 10,
    bias: -2.5,
    gravity: 0.12,
    drag: 0.99,
    lifeMin: 45,
    lifeRange: 55,
    sizeMin: 2.5,
    sizeMax: 7,
    round: true,
    sprites: FX.meat,
    spriteMin: 16,
    spriteMax: 28
  };

  // Три зоны по ширине, чтобы крылатые грибы не сбивались в кучу.
  var ZONES = [
    [12, 26],
    [42, 58],
    [70, 84]
  ];

  var host = document.querySelector(".footer") || document.body;
  var layer = document.createElement("div");
  layer.className = "winged-layer";
  host.appendChild(layer);

  var items = [];

  for (var i = 0; i < COUNT; i++) {
    var zone = ZONES[i % ZONES.length];
    var left = zone[0] + Math.random() * (zone[1] - zone[0]);

    var el = document.createElement("div");
    el.className = "winged";
    el.style.left = left.toFixed(1) + "%";
    el.style.bottom = (90 + Math.random() * 32).toFixed(1) + "px";
    el.style.setProperty("--float-delay", (-i * 1.1).toFixed(2) + "s");
    el.style.setProperty("--s", (0.9 + Math.random() * 0.2).toFixed(3));
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Крылатый гриб, нажми на него");

    var bob = document.createElement("div");
    bob.className = "winged__bob";

    var art = document.createElement("img");
    art.className = "winged__art";
    art.src = "assets/mushrooms/mushroom-winged.png";
    art.alt = "";
    art.draggable = false;

    bob.appendChild(art);
    el.appendChild(bob);
    layer.appendChild(el);

    items.push({ el: el, art: art, hits: 0, dead: false });
  }

  function emit(x, y, opts) {
    if (reduced) return;
    if (window.BirthdayParticles) window.BirthdayParticles.burst(x, y, opts);
  }

  function hit(it) {
    if (it.dead) return;
    it.hits++;

    var r = it.art.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;

    it.art.classList.remove("is-hit");
    void it.art.offsetWidth;
    it.art.classList.add("is-hit");

    if (it.hits >= 3) {
      it.dead = true;
      it.el.classList.add("is-dead");
      it.el.tabIndex = -1;
      it.el.style.pointerEvents = "none";
      emit(cx, cy, MEAT_BIG);

      setTimeout(function () {
        if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
      }, 500);
    } else {
      emit(cx, cy, MEAT_SMALL);
    }

    document.dispatchEvent(new CustomEvent("birthday:hit", {
      detail: { type: "winged", killed: it.hits >= 3 }
    }));
  }

  items.forEach(function (it) {
    it.el.addEventListener("click", function (e) {
      e.preventDefault();
      hit(it);
    });

    it.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        hit(it);
      }
    });
  });
})();

/* ===== Цветы рядом с грибами =====
   Готовые картинки цветов, позиции случайные при каждой загрузке.
   При клике из цветка вылетают лепестки его цвета. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = window.BirthdayParticles || {};
  var COUNT = 24;

  var VARIANTS = [
    { src: "assets/flowers/flower-1.png", stem: true,  petal: "red" },    // персиковый
    { src: "assets/flowers/flower-2.png", stem: false, petal: "yellow" }, // подсолнух
    { src: "assets/flowers/flower-3.png", stem: true,  petal: "white" }   // белая ромашка
  ];

  var PETAL_COLORS = {
    white: ["#ffffff", "#f4efe6"],
    yellow: ["#e0b23a", "#c9972c"],
    red: ["#c0392b", "#8a2f28"]
  };

  var host = document.querySelector(".footer") || document.body;
  var layer = document.createElement("div");
  layer.className = "flower-layer";
  host.appendChild(layer);

  // Раскладываем варианты так, чтобы использовались все три вида.
  var order = [];
  for (var o = 0; o < COUNT; o++) order.push(o % VARIANTS.length);

  for (var s = order.length - 1; s > 0; s--) {
    var r = (Math.random() * (s + 1)) | 0;
    var tmp = order[s];
    order[s] = order[r];
    order[r] = tmp;
  }

  // Плотный цветочный ковёр по всей ширине.
  var items = [];

  for (var i = 0; i < COUNT; i++) {
    var variant = VARIANTS[order[i]];
    var left = ((i + 0.5) / COUNT) * 100 + (Math.random() * 1.6 - 0.8);

    var el = document.createElement("div");
    el.className = "flower";
    el.style.left = left.toFixed(1) + "%";
    el.style.bottom = (Math.random() * 8).toFixed(1) + "px";
    el.style.setProperty("--s", (0.9 + Math.random() * 0.35).toFixed(3));
    el.style.setProperty("--sway-delay", (-Math.random() * 4).toFixed(2) + "s");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Цветок, нажми на него");

    var bob = document.createElement("div");
    bob.className = "flower__bob";

    var art = document.createElement("div");
    art.className = "flower__art";

    var hitEl;

    if (variant.stem) {
      // Голова цветка + стебель, нарисованный на CSS.
      var stem = document.createElement("span");
      stem.className = "flower__stem";

      var head = document.createElement("img");
      head.className = "flower__head-img";
      head.src = variant.src;
      head.alt = "";
      head.draggable = false;

      art.appendChild(stem);
      art.appendChild(head);
      hitEl = head;
    } else {
      // Целое растение уже со стеблем и листьями.
      var plant = document.createElement("img");
      plant.className = "flower__plant-img";
      plant.src = variant.src;
      plant.alt = "";
      plant.draggable = false;

      art.appendChild(plant);
      hitEl = plant;
    }

    bob.appendChild(art);
    el.appendChild(bob);
    layer.appendChild(el);

    items.push({ el: el, art: art, hitEl: hitEl, petal: variant.petal, dead: false });
  }

  function emit(x, y, opts) {
    if (reduced) return;
    if (window.BirthdayParticles) window.BirthdayParticles.burst(x, y, opts);
  }

  function pick(it) {
    if (it.dead) return;
    it.dead = true;

    var r = it.hitEl.getBoundingClientRect();
    var sprites = FX.petals ? FX.petals[it.petal] : null;

    emit(r.left + r.width / 2, r.top + r.height / 2, {
      colors: PETAL_COLORS[it.petal] || ["#ffffff"],
      count: 18,
      speedMin: 1.5,
      speedMax: 5,
      bias: -1.5,
      gravity: 0.08,
      drag: 0.985,
      lifeMin: 55,
      lifeRange: 45,
      sizeMin: 2,
      sizeMax: 5,
      round: true,
      sprites: sprites || null,
      spriteMin: 12,
      spriteMax: 22
    });

    it.el.classList.add("is-dead");
    it.el.tabIndex = -1;
    it.el.style.pointerEvents = "none";

    document.dispatchEvent(new CustomEvent("birthday:hit", {
      detail: { type: "flower", killed: true }
    }));

    setTimeout(function () {
      if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
    }, 420);
  }

  items.forEach(function (it) {
    it.el.addEventListener("click", function (e) {
      e.preventDefault();
      pick(it);
    });

    it.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        pick(it);
      }
    });
  });
})();

/* ===== Декор из «Доп ассеты Готовый» =====
   52 картинки: разделители между секциями, крупные полупрозрачные
   «водяные знаки» на фоне и мелкие плавающие детали по краям. */
(function () {
  "use strict";

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function src(n) { return "assets/decor/decor-" + pad(n) + ".png"; }

  /* ----- 1. Разделители между секциями ----- */
  var DIVIDERS = [
    { target: ".moments", kind: "line", n: 16 }, // ангел
    { target: ".finale",  kind: "line", n: 6 }   // рука с крестом
  ];

  DIVIDERS.forEach(function (d) {
    var sec = document.querySelector(d.target);
    if (!sec) return;

    var box = document.createElement("div");
    box.className = "decor-divider";

    if (d.kind === "band") {
      box.classList.add("decor-divider--band");
      box.style.backgroundImage = "url(" + src(d.n) + ")";
    } else {
      var lineL = document.createElement("span");
      lineL.className = "decor-divider__line";

      var img = document.createElement("img");
      img.className = "decor-divider__img";
      img.src = src(d.n);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      var lineR = document.createElement("span");
      lineR.className = "decor-divider__line decor-divider__line--right";

      box.appendChild(lineL);
      box.appendChild(img);
      box.appendChild(lineR);
    }

    sec.parentNode.insertBefore(box, sec);
  });

  /* ----- 2. Слой декораций ----- */
  var layer = document.createElement("div");
  layer.className = "decor-layer";
  document.body.appendChild(layer);

  // Крупные едва заметные картинки на фоне
  var WATERMARKS = [
    { n: 31, top: 11, left: 76, size: 380, opacity: 0.055 }, // луна с лицом
    { n: 35, top: 43, left: 12, size: 300, opacity: 0.06 },  // сова
    { n: 43, top: 57, left: 76, size: 340, opacity: 0.055 }, // глаз-луна
    { n: 28, top: 72, left: 8,  size: 300, opacity: 0.05 },  // мозг
    { n: 20, top: 81, left: 78, size: 280, opacity: 0.055 }, // монахиня
    { n: 44, top: 92, left: 50, size: 480, opacity: 0.05 }   // арка из глаз
  ];

  WATERMARKS.forEach(function (w) {
    var img = document.createElement("img");
    img.className = "decor-watermark";
    img.src = src(w.n);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.style.top = w.top + "%";
    img.style.left = w.left + "%";
    img.style.width = w.size + "px";
    img.style.opacity = w.opacity;
    layer.appendChild(img);
  });

  // Всё остальное — мелкие плавающие детали по краям страницы
  var USED = [3, 6, 8, 10, 16, 20, 28, 31, 32, 35, 43, 44];
  var floaters = [];
  for (var n = 1; n <= 52; n++) {
    if (USED.indexOf(n) === -1) floaters.push(n);
  }

  floaters.forEach(function (num) {
    var wrap = document.createElement("div");
    wrap.className = "decor-float";

    var edge = Math.random() < 0.85;
    var side = Math.random() < 0.5 ? 0 : 1;
    var left = edge
      ? (side === 0 ? 3 + Math.random() * 9 : 88 + Math.random() * 9)
      : 20 + Math.random() * 60;
    var top = 3 + Math.random() * 86;
    var size = 36 + Math.random() * 58;

    wrap.style.top = top.toFixed(2) + "%";
    wrap.style.left = left.toFixed(2) + "%";
    wrap.style.setProperty("--r", (Math.random() * 36 - 18).toFixed(1) + "deg");
    wrap.style.setProperty("--d", (-Math.random() * 9).toFixed(2) + "s");
    wrap.style.setProperty("--t", (7 + Math.random() * 8).toFixed(2) + "s");

    var img = document.createElement("img");
    img.src = src(num);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.style.width = size.toFixed(1) + "px";
    img.style.opacity = (0.09 + Math.random() * 0.1).toFixed(2);

    wrap.appendChild(img);
    layer.appendChild(wrap);
  });

  // Вертикальные орнаментальные ленты по краям всего документа.
  var railL = document.createElement("div");
  railL.className = "doc-rail doc-rail--left";

  var railR = document.createElement("div");
  railR.className = "doc-rail doc-rail--right";

  layer.appendChild(railL);
  layer.appendChild(railR);

  // Крестики-декор по краям документа.
  var EDGE_CROSSES = [
    { n: "jewel",  top: 9,  side: "left",  size: 24, opacity: 0.55 },
    { n: "simple", top: 22, side: "right", size: 20, opacity: 0.5 },
    { n: "ornate", top: 35, side: "left",  size: 26, opacity: 0.45 },
    { n: "cloth",  top: 48, side: "right", size: 30, opacity: 0.5 },
    { n: "jewel",  top: 61, side: "left",  size: 22, opacity: 0.5 },
    { n: "simple", top: 74, side: "right", size: 20, opacity: 0.45 },
    { n: "ornate", top: 87, side: "left",  size: 26, opacity: 0.45 },
    { n: "cloth",  top: 95, side: "right", size: 28, opacity: 0.4 }
  ];

  EDGE_CROSSES.forEach(function (c) {
    var img = document.createElement("img");
    img.className = "edge-cross";
    img.src = "assets/crosses/" + c.n + ".gif";
    img.alt = "";
    img.loading = "lazy";
    img.style.top = c.top + "%";
    img.style.width = c.size + "px";
    img.style.opacity = c.opacity;
    if (c.side === "left") img.style.left = "14px";
    else img.style.right = "14px";
    layer.appendChild(img);
  });

  // Крестик у каждого главного события в хронологии.
  var majorDates = document.querySelectorAll(".tl-event--major .tl-event__date");
  for (var m = 0; m < majorDates.length; m++) {
    var mark = document.createElement("img");
    mark.className = "tl-event__cross";
    mark.src = "assets/crosses/jewel.gif";
    mark.alt = "";
    majorDates[m].insertBefore(mark, majorDates[m].firstChild);
  }

  // Высота слоя равна высоте документа, чтобы % позиции работали.
  function syncSize() {
    layer.style.height = document.body.getBoundingClientRect().height + "px";
  }

  syncSize();
  window.addEventListener("resize", syncSize);
  window.addEventListener("load", syncSize);
  if (window.ResizeObserver) new ResizeObserver(syncSize).observe(document.body);
})();

/* ===== Ачивки: итоговый экран =====
   Во время прохождения считаем убийства по трём категориям:
   ангелы (двое в финале + глазастые существа), грибы (наземные +
   крылатые) и цветы. По кнопке «Закончить» вычисляем, какие ачивки
   заслужил текущий заход, добавляем их к сохранённым и открываем
   отдельный экран. Незаработанные карточки остаются чёрными. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = window.BirthdayParticles || {};
  var STORAGE_KEY = "birthday-site-achievements-v2";
  var HITS_TO_KILL = 3;

  var screen = document.getElementById("achievements-screen");
  var finishBtn = document.getElementById("finish-btn");
  if (!screen || !finishBtn) return;

  var closeBtns = Array.prototype.slice.call(
    screen.querySelectorAll("[data-achievements-close]")
  );
  var cards = Array.prototype.slice.call(
    screen.querySelectorAll("[data-achievement]")
  );
  var countEl = screen.querySelector("[data-achievements-count]");
  var totalEl = screen.querySelector("[data-achievements-total]");

  var KEYS = cards.map(function (card) {
    return card.getAttribute("data-achievement");
  });

  // Ангелы = финальные + глазастые существа; грибы = наземные + крылатые.
  var totals = {
    angels:
      document.querySelectorAll(".finale__angel").length +
      document.querySelectorAll(".creature").length,
    mushrooms:
      document.querySelectorAll(".shroom").length +
      document.querySelectorAll(".winged").length,
    flowers: document.querySelectorAll(".flower").length
  };

  var kills = { angels: 0, mushrooms: 0, flowers: 0 };

  // ----- Сохранённые ачивки -----
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (err) {
    saved = {};
  }

  var earned = {};
  KEYS.forEach(function (key) {
    earned[key] = !!saved[key];
  });

  function save() {
    var data = {};
    for (var i = 0; i < KEYS.length; i++) {
      data[KEYS[i]] = !!earned[KEYS[i]];
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) { /* приватный режим */ }
  }

  // ----- Картинки на закрытых карточках -----
  var VEIL_IMAGES = [
    { src: "assets/achievements/hidden-2.gif", kind: "eye" },
    { src: "assets/achievements/hidden-3.gif", kind: "strip" }
  ];

  var veilPool = VEIL_IMAGES.slice();
  for (var v = veilPool.length - 1; v > 0; v--) {
    var vr = (Math.random() * (v + 1)) | 0;
    var vtmp = veilPool[v];
    veilPool[v] = veilPool[vr];
    veilPool[vr] = vtmp;
  }

  cards.forEach(function (card, index) {
    var veil = card.querySelector(".achievement__veil");
    if (!veil) return;

    var pick = veilPool[index % veilPool.length];
    veil.className = "achievement__veil achievement__veil--" + pick.kind;

    var img = veil.querySelector(".achievement__veil-img");
    if (img) img.src = pick.src;
  });

  // ----- Убийство финальных ангелов -----
  var WHITE = {
    colors: ["#ffffff", "#f4efe6", "#e7ddcf"],
    count: 20,
    speedMin: 1.5,
    speedMax: 5.5,
    bias: -1.2,
    gravity: 0.045,
    drag: 0.99,
    lifeMin: 60,
    lifeRange: 60,
    sizeMin: 2,
    sizeMax: 5,
    round: true,
    sprites: FX.whiteFeathers,
    spriteMin: 16,
    spriteMax: 28
  };

  var FINAL = {
    colors: ["#ffffff", "#f4efe6", "#e7ddcf", "#c9a227"],
    count: 70,
    speedMin: 2.5,
    speedMax: 9,
    bias: -2.5,
    gravity: 0.07,
    drag: 0.99,
    lifeMin: 70,
    lifeRange: 70,
    sizeMin: 2,
    sizeMax: 6,
    round: true,
    sprites: FX.whiteFeathers,
    spriteMin: 18,
    spriteMax: 32
  };

  var angelEls = Array.prototype.slice.call(
    document.querySelectorAll(".finale__angel")
  );
  var angels = angelEls.map(function (el) {
    return { el: el, hits: 0, dead: false };
  });

  function emit(x, y, opts) {
    if (reduced) return;
    if (window.BirthdayParticles) window.BirthdayParticles.burst(x, y, opts);
  }

  function hitAngel(a) {
    if (a.dead) return;
    a.hits++;

    var r = a.el.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;

    a.el.classList.remove("is-hit");
    void a.el.offsetWidth;
    a.el.classList.add("is-hit");

    if (a.hits >= HITS_TO_KILL) {
      a.dead = true;
      kills.angels++;
      a.el.classList.add("is-dead");
      a.el.tabIndex = -1;
      a.el.style.pointerEvents = "none";
      a.el.setAttribute("aria-label", "Убитый ангел");
      emit(cx, cy, FINAL);

      setTimeout(function () {
        if (a.el.parentNode) a.el.parentNode.removeChild(a.el);
      }, 750);
    } else {
      emit(cx, cy, WHITE);
    }
  }

  angels.forEach(function (a) {
    a.el.addEventListener("click", function (e) {
      e.preventDefault();
      hitAngel(a);
    });

    a.el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        hitAngel(a);
      }
    });
  });

  // ----- События от существ, грибов и цветов -----
  document.addEventListener("birthday:hit", function (e) {
    var detail = e.detail || {};
    if (!detail.killed) return;

    if (detail.type === "creature") {
      kills.angels++;
    } else if (detail.type === "shroom" || detail.type === "winged") {
      kills.mushrooms++;
    } else if (detail.type === "flower") {
      kills.flowers++;
    }
  });

  // ----- Итоговая проверка -----
  function evaluate() {
    var A = totals.angels > 0 && kills.angels >= totals.angels;
    var M = totals.mushrooms > 0 && kills.mushrooms >= totals.mushrooms;
    var F = totals.flowers > 0 && kills.flowers >= totals.flowers;
    var nothing = kills.angels + kills.mushrooms + kills.flowers === 0;

    var now = {
      allAngels: A,
      allMushrooms: M,
      allFlowers: F,
      all: A && M && F,
      none: nothing,
      allButAngels: kills.angels === 0 && M && F,
      allButMushrooms: kills.mushrooms === 0 && A && F,
      allButFlowers: kills.flowers === 0 && A && M,
      onlyAngels: A && kills.mushrooms === 0 && kills.flowers === 0,
      onlyMushrooms: M && kills.angels === 0 && kills.flowers === 0,
      onlyFlowers: F && kills.angels === 0 && kills.mushrooms === 0
    };

    var changed = false;
    Object.keys(now).forEach(function (key) {
      if (now[key] && !earned[key]) {
        earned[key] = true;
        changed = true;
      }
    });

    if (changed) save();
  }

  function render() {
    var opened = 0;

    cards.forEach(function (card) {
      var key = card.getAttribute("data-achievement");
      var isOn = !!earned[key];
      card.classList.toggle("is-unlocked", isOn);
      if (isOn) opened++;
    });

    if (countEl) countEl.textContent = opened;
    if (totalEl) totalEl.textContent = cards.length;
  }

  // ----- Открытие и закрытие экрана -----
  var inertTargets = Array.prototype.slice.call(
    document.querySelectorAll("header.hero, main, footer.footer, .candle-layer")
  );
  var lastFocus = null;

  function setPageInert(on) {
    inertTargets.forEach(function (el) {
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
  }

  function openScreen() {
    evaluate();
    render();

    lastFocus = document.activeElement;
    screen.classList.add("is-open");
    screen.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("is-achievements-open");
    document.body.classList.add("is-achievements-open");
    setPageInert(true);
    screen.scrollTop = 0;

    try {
      screen.focus({ preventScroll: true });
    } catch (err) {
      screen.focus();
    }
  }

  function closeScreen() {
    screen.classList.remove("is-open");
    screen.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("is-achievements-open");
    document.body.classList.remove("is-achievements-open");
    setPageInert(false);

    try {
      finishBtn.focus({ preventScroll: true });
    } catch (err) {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }

  finishBtn.addEventListener("click", openScreen);
  closeBtns.forEach(function (btn) {
    btn.addEventListener("click", closeScreen);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && screen.classList.contains("is-open")) {
      e.preventDefault();
      closeScreen();
    }
  });

  render();
})();

/* ===== Перетаскивание свечи =====
   Свеча лежит на отдельном слое поверх всей страницы и стартует
   на торте. Тянем её мышью, пером или пальцем куда угодно в пределах
   документа. Пока тянем мышью/пером, сама свеча скрывается, а курсор
   становится рукой со свечой. После отпускания свеча остаётся
   в документных координатах и скроллится вместе со страницей. */
(function () {
  "use strict";

  var candle = document.querySelector(".hero__candle");
  var img = document.querySelector(".hero__img");
  if (!candle || !img) return;

  // Положение и размер свечи относительно картины:
  // центр по X и низ (основание) по Y.
  var START_X = 50.7;      // % ширины картины
  var START_BOTTOM = 57.8; // % высоты картины
  var CANDLE_H = 13;       // % высоты картины
  var ASPECT = 57 / 258;   // ширина / высота исходной картинки свечи

  var dragging = false;
  var moved = false;
  var startPointerX = 0;
  var startPointerY = 0;
  var startLeft = 0;
  var startTop = 0;

  // Заранее грузим курсор, чтобы он не мигал при первом перетаскивании.
  var cursorImg = new Image();
  cursorImg.src = "assets/candle/candle-cursor-glowing.png";

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function scrollX() {
    return window.pageXOffset || document.documentElement.scrollLeft || 0;
  }

  function scrollY() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  // Пока свечу не трогали, держим её на торте.
  function placeOnCake() {
    var rect = img.getBoundingClientRect();
    var h = Math.max(38, rect.height * CANDLE_H / 100);
    var w = h * ASPECT;
    var centerX = rect.left + scrollX() + rect.width * START_X / 100;
    var bottomY = rect.top + scrollY() + rect.height * START_BOTTOM / 100;

    candle.style.width = w.toFixed(2) + "px";
    candle.style.height = h.toFixed(2) + "px";
    candle.style.left = (centerX - w / 2).toFixed(2) + "px";
    candle.style.top = (bottomY - h).toFixed(2) + "px";
    candle.classList.add("is-ready");
  }

  function isTouch(e) {
    return e.pointerType === "touch";
  }

  candle.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();

    var rect = candle.getBoundingClientRect();

    startPointerX = e.clientX + scrollX();
    startPointerY = e.clientY + scrollY();
    startLeft = rect.left + scrollX();
    startTop = rect.top + scrollY();

    dragging = true;
    moved = true;

    // На тач-экране курсора нет — оставляем свечу видимой под пальцем.
    if (!isTouch(e)) {
      candle.classList.add("is-dragging");
      document.documentElement.classList.add("is-candle-dragging");
    }

    if (candle.setPointerCapture) {
      try { candle.setPointerCapture(e.pointerId); } catch (err) { /* без capture тоже сработает */ }
    }
  });

  candle.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    e.preventDefault();

    var docW = document.documentElement.clientWidth;
    var docH = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    var maxLeft = Math.max(0, docW - candle.offsetWidth);
    var maxTop = Math.max(0, docH - candle.offsetHeight);

    var left = clamp(
      startLeft + (e.clientX + scrollX() - startPointerX),
      0,
      maxLeft
    );
    var top = clamp(
      startTop + (e.clientY + scrollY() - startPointerY),
      0,
      maxTop
    );

    candle.style.left = left + "px";
    candle.style.top = top + "px";
  });

  function stopDrag(e) {
    if (!dragging) return;

    dragging = false;
    candle.classList.remove("is-dragging");
    document.documentElement.classList.remove("is-candle-dragging");

    if (candle.releasePointerCapture && e && e.pointerId != null) {
      try { candle.releasePointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
    }
  }

  candle.addEventListener("pointerup", stopDrag);
  candle.addEventListener("pointercancel", stopDrag);

  placeOnCake();

  window.addEventListener("resize", function () {
    if (!moved) placeOnCake();
  });

  window.addEventListener("load", function () {
    if (!moved) placeOnCake();
  });
})();
