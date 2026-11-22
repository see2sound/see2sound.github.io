(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function svg(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  var ICON = {
    play: svg('M8 5v14l11-7z'),
    pause: svg('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
    soundOn: svg('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'),
    soundOff: svg('M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'),
    prev: svg('M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
    next: svg('M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
    headphones: svg('M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1a7 7 0 0 1 14 0v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z'),
    spatial: svg('M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7.05 7.05 5.64 5.64a9 9 0 0 0 0 12.72l1.41-1.41a7 7 0 0 1 0-9.9zm9.9 0a7 7 0 0 1 0 9.9l1.41 1.41a9 9 0 0 0 0-12.72l-1.41 1.41zM9.17 9.17 7.76 7.76a6 6 0 0 0 0 8.48l1.41-1.41a4 4 0 0 1 0-5.66zm5.66 0a4 4 0 0 1 0 5.66l1.41 1.41a6 6 0 0 0 0-8.48l-1.41 1.41z'),
    mono: svg('M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z'),
    video: svg('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z'),
    image: svg('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z')
  };

  function h(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function button(cls, html, label) {
    var b = h('button', cls, html);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Media elements are reused across items; seeks requested before metadata are applied on load.
  function setSrc(el, url) {
    if (el.s2sSrc === url) return;
    el.s2sSrc = url;
    el.s2sPending = null;
    el.src = url;
  }

  function unload(el) {
    if (!el.s2sSrc) return;
    el.pause();
    el.s2sSrc = null;
    el.s2sPending = null;
    el.removeAttribute('src');
    el.load();
  }

  function setTime(el, t) {
    if (el.readyState >= 1) {
      try { el.currentTime = t; } catch (e) { /* not seekable yet */ }
      el.s2sPending = null;
    } else {
      el.s2sPending = t;
    }
  }

  function getTime(el) {
    return el.s2sPending != null ? el.s2sPending : (el.currentTime || 0);
  }

  function mediaEl(tag) {
    var el = document.createElement(tag);
    el.preload = 'none';
    el.addEventListener('loadedmetadata', function () {
      if (el.s2sPending != null) setTime(el, el.s2sPending);
    });
    return el;
  }

  function Player(opts) {
    var self = this;
    this.opts = opts || {};
    this.item = null;
    this.duration = 0;
    this.mode = 'spatial';
    this.soundOn = false;
    this.visible = false;
    this.playing = false;
    this.userPaused = false;
    this.consent = false;
    this.vt = 0;
    this.vStart = 0;
    this.raf = 0;

    this.el = h('div', 's2s-player');
    this.stage = h('div', 's2s-stage');
    this.backdrop = h('div', 's2s-backdrop');
    this.img = h('img', 's2s-still');
    this.img.alt = '';
    this.img.decoding = 'async';
    var v = this.video = mediaEl('video');
    v.className = 's2s-video';
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    this.spatial = mediaEl('audio');
    this.mono = mediaEl('audio');

    this.tag = h('span', 's2s-tag');
    this.big = button('s2s-bigplay', ICON.play, 'Play');
    this.sound = button('s2s-sound');
    this.stage.append(this.backdrop, this.img, v, this.tag, this.big, this.sound);

    this.bar = h('div', 's2s-timeline');
    this.playBtn = button('s2s-play', ICON.play, 'Play');
    this.track = h('div', 's2s-track');
    this.track.tabIndex = 0;
    this.track.setAttribute('role', 'slider');
    this.track.setAttribute('aria-label', 'Seek');
    this.track.setAttribute('aria-valuemin', '0');
    this.fill = h('div', 's2s-fill');
    this.track.append(this.fill);
    this.time = h('span', 's2s-time');
    this.bar.append(this.playBtn, this.track, this.time);
    this.el.append(this.stage, this.bar);
    this.renderSound();

    function isClock(el) { return self.playing && el === self.clock(); }
    [v, this.spatial, this.mono].forEach(function (el) {
      el.addEventListener('waiting', function () {
        if (el === self.clock() || el === self.audible()) self.stage.classList.add('is-loading');
        if (el === v && self.audible() === self.mono) self.mono.pause();
      });
      el.addEventListener('playing', function () {
        self.stage.classList.remove('is-loading');
        if (el === v && self.playing && self.audible() === self.mono) {
          setTime(self.mono, v.currentTime);
          self.playEl(self.mono);
        }
      });
      el.addEventListener('ended', function () { if (isClock(el)) self.finish(); });
      el.addEventListener('error', function () {
        if (el.s2sSrc && window.console) console.warn('Could not load ' + el.s2sSrc);
      });
    });
    v.addEventListener('loadedmetadata', function () {
      if (self.item && self.item.video && isFinite(v.duration) && v.duration > 0) self.duration = v.duration;
      self.render(self.now());
    });

    this.stage.addEventListener('click', function (e) {
      // composedPath, not target.closest: the sound button re-renders its children on click.
      var onButton = e.composedPath().some(function (n) { return n.tagName === 'BUTTON'; });
      if (self.swiped || onButton) return;
      self.toggle();
    });
    this.big.addEventListener('click', function () { self.userPlay(); });
    this.playBtn.addEventListener('click', function () { self.toggle(); });
    this.sound.addEventListener('click', function () {
      self.setSound(!self.soundOn);
      if (self.soundOn && !self.playing) self.userPlay();
    });

    var start = null;
    this.stage.addEventListener('pointerdown', function (e) {
      self.swiped = false;
      start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
    });
    this.stage.addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy) && self.opts.onSwipe) {
        self.swiped = true;
        self.opts.onSwipe(dx < 0 ? 1 : -1);
      }
    });

    var dragging = false;
    function seekFromPointer(e) {
      var r = self.track.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      self.seek(f * (self.duration || 0));
    }
    this.track.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (self.track.setPointerCapture) self.track.setPointerCapture(e.pointerId);
      seekFromPointer(e);
    });
    this.track.addEventListener('pointermove', function (e) { if (dragging) seekFromPointer(e); });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      self.track.addEventListener(type, function () { dragging = false; });
    });
    this.track.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 }[e.key];
      e.stopPropagation();
      if (step) {
        e.preventDefault();
        self.seek(self.now() + step);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        self.seek(e.key === 'Home' ? 0 : self.duration);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        self.toggle();
      }
    });
  }

  // The element whose sound is heard (null when sound is off).
  Player.prototype.audible = function () {
    if (!this.soundOn || !this.item) return null;
    if (this.mode === 'mono') return this.mono;
    return this.item.video ? this.video : this.spatial;
  };

  // The element that drives the timeline; stills without sound run on a virtual clock (null).
  Player.prototype.clock = function () {
    if (this.item && this.item.video) return this.video;
    return this.audible();
  };

  Player.prototype.now = function () {
    var c = this.clock();
    if (c) return getTime(c);
    return this.playing ? this.vt + (performance.now() - this.vStart) / 1000 : this.vt;
  };

  Player.prototype.load = function (item) {
    var v = this.video;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    v.pause();
    unload(this.spatial);
    unload(this.mono);
    this.item = item;
    this.duration = item.duration;
    this.vt = 0;
    this.stage.classList.remove('is-loading');
    this.stage.classList.toggle('is-still', !item.video);
    if (item.video) {
      this.img.removeAttribute('srcset');
      this.img.removeAttribute('src');
      this.backdrop.style.backgroundImage = '';
      v.poster = item.poster;
      v.preload = this.visible ? 'auto' : 'none';
      setSrc(v, item.video);
      v.setAttribute('aria-label', item.title);
    } else {
      unload(v);
      v.removeAttribute('poster');
      var srcs = item.image, big = srcs[srcs.length - 1];
      var k = Math.min(1, (9 / 16) * big.w / big.h);
      this.img.width = big.w;
      this.img.height = big.h;
      this.img.sizes = Math.max(160, Math.round((this.stage.clientWidth || 640) * k)) + 'px';
      this.img.srcset = srcs.map(function (s) { return s.src + ' ' + s.w + 'w'; }).join(', ');
      this.img.src = srcs[0].src;
      this.img.alt = item.title;
      this.backdrop.style.backgroundImage = 'url("' + srcs[0].src + '")';
    }
    this.route(0);
    this.render(0);
    if (this.shouldPlay()) this.play();
    else this.renderPlayState();
  };

  // Point the output at the right element after the item, sound or mode changed.
  Player.prototype.route = function (t) {
    var it = this.item, v = this.video, a = this.audible();
    if (!it) return;
    if (it.video) {
      v.muted = a !== v;
      if (a === this.mono) {
        setSrc(this.mono, it.mono);
        this.mono.preload = 'auto';
        setTime(this.mono, getTime(v));
        if (this.playing && !v.paused) this.playEl(this.mono);
      } else {
        this.mono.pause();
      }
    } else {
      [this.spatial, this.mono].forEach(function (el) { if (el !== a) el.pause(); });
      if (a) {
        setSrc(a, a === this.mono ? it.mono : it.spatial);
        a.preload = 'auto';
        setTime(a, t);
        if (this.playing) this.playEl(a);
      } else {
        this.vt = t;
        this.vStart = performance.now();
      }
    }
    this.renderTag();
  };

  Player.prototype.shouldPlay = function () {
    return this.visible && !this.userPaused && !document.hidden && (!reduceMotion || this.consent);
  };

  Player.prototype.playEl = function (el) {
    var self = this;
    el.preload = 'auto';
    var p = el.play();
    if (!p || !p.catch) return;
    p.catch(function (err) {
      if (!err || err.name === 'AbortError' || !self.playing) return;
      if (self.soundOn && el === self.audible()) {
        // Sound was blocked by the autoplay policy: keep going without it.
        self.setSound(false);
        if (el === self.video) self.playEl(self.video);
      } else if (el === self.video) {
        self.playing = false;
        self.renderPlayState(true);
      }
    });
  };

  Player.prototype.play = function () {
    var it = this.item, a = this.audible();
    if (!it) return;
    if (this.now() >= this.duration - 0.05) this.seek(0);
    this.playing = true;
    if (it.video) {
      this.playEl(this.video);
      if (a === this.mono) {
        setTime(this.mono, getTime(this.video));
        this.playEl(this.mono);
      }
    } else if (a) {
      this.playEl(a);
    } else {
      this.vStart = performance.now();
    }
    this.renderPlayState();
    this.tickLoop();
  };

  Player.prototype.pause = function () {
    if (!this.playing) return;
    var t = this.now();
    this.playing = false;
    this.video.pause();
    this.spatial.pause();
    this.mono.pause();
    if (!this.clock()) this.vt = t;
    this.renderPlayState();
    this.render(t);
  };

  Player.prototype.finish = function () {
    if (!this.playing) return;
    this.playing = false;
    this.video.pause();
    this.spatial.pause();
    this.mono.pause();
    this.vt = this.duration;
    this.render(this.duration);
    this.renderPlayState();
    if (this.opts.onEnded) this.opts.onEnded();
  };

  Player.prototype.userPlay = function () {
    this.consent = true;
    this.userPaused = false;
    this.play();
  };

  Player.prototype.toggle = function () {
    if (this.playing) {
      this.userPaused = true;
      this.pause();
    } else {
      this.userPlay();
    }
  };

  Player.prototype.restart = function () {
    this.seek(0);
    if (this.shouldPlay()) this.play();
  };

  Player.prototype.seek = function (t) {
    var it = this.item, a = this.audible();
    t = Math.min(Math.max(0, t), this.duration || 0);
    if (!it) return;
    if (it.video) {
      setTime(this.video, t);
      if (a === this.mono) setTime(this.mono, t);
    } else if (a) {
      setTime(a, t);
    } else {
      this.vt = t;
      this.vStart = performance.now();
    }
    this.render(t);
  };

  Player.prototype.setVisible = function (on) {
    this.visible = on;
    if (on && this.item && this.item.video && this.video.preload !== 'auto') this.video.preload = 'auto';
    if (on && !this.playing && this.shouldPlay()) this.play();
    else if (!on && this.playing) this.pause();
  };

  Player.prototype.setSound = function (on) {
    var t = this.now();
    this.soundOn = on;
    this.route(t);
    this.renderSound();
    if (this.opts.onSound) this.opts.onSound(on);
  };

  Player.prototype.setMode = function (mode) {
    if (mode === this.mode) return;
    var t = this.now();
    this.mode = mode;
    this.route(t);
  };

  Player.prototype.renderSound = function () {
    var on = this.soundOn;
    this.sound.classList.toggle('is-muted', !on);
    this.sound.innerHTML = on ? ICON.soundOn : ICON.soundOff + '<span>Sound off</span>';
    this.sound.setAttribute('aria-label', on ? 'Mute' : 'Turn sound on');
    this.sound.setAttribute('aria-pressed', String(on));
    this.renderTag();
  };

  Player.prototype.renderTag = function () {
    var spatial = this.mode === 'spatial';
    this.tag.innerHTML = (spatial ? ICON.spatial : ICON.mono) + '<span>' + (spatial ? 'Spatial' : 'Mono') +
      '</span><i class="s2s-eq" aria-hidden="true"><b></b><b></b><b></b></i>';
    this.tag.classList.toggle('is-mono', !spatial);
    this.stage.classList.toggle('is-audible', this.soundOn);
  };

  Player.prototype.renderPlayState = function (blocked) {
    var showBig = !this.playing && (blocked || this.userPaused || (reduceMotion && !this.consent));
    this.stage.classList.toggle('is-paused', !!showBig);
    this.stage.classList.toggle('is-playing', this.playing);
    this.playBtn.innerHTML = this.playing ? ICON.pause : ICON.play;
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
  };

  Player.prototype.render = function (t) {
    var d = this.duration || 0;
    t = Math.min(Math.max(0, t || 0), d);
    this.fill.style.width = d ? (100 * t / d) + '%' : '0';
    this.time.textContent = t.toFixed(1) + ' / ' + d.toFixed(1) + ' s';
    this.track.setAttribute('aria-valuemax', d.toFixed(1));
    this.track.setAttribute('aria-valuenow', t.toFixed(1));
    this.track.setAttribute('aria-valuetext', t.toFixed(1) + ' seconds');
    if (this.opts.onTick) this.opts.onTick(t, d);
  };

  Player.prototype.tickLoop = function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    function step() {
      if (!self.playing) return;
      var t = self.now();
      var it = self.item, m = self.mono, v = self.video;
      if (it.video && self.audible() === m && !v.paused && !m.paused && !m.seeking && m.readyState >= 1 &&
          Math.abs(m.currentTime - v.currentTime) > 0.2) {
        setTime(m, v.currentTime);
      }
      if (!self.clock() && t >= self.duration) return self.finish();
      self.render(t);
      self.raf = requestAnimationFrame(step);
    }
    this.raf = requestAnimationFrame(step);
  };

  function observeVisibility(player, target, threshold) {
    var inView = false;
    function sync() { player.setVisible(inView && !document.hidden); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        inView = e.isIntersecting && e.intersectionRatio >= threshold - 0.01;
        sync();
      }, { threshold: [0, threshold] }).observe(target);
    } else {
      inView = true;
      sync();
    }
    document.addEventListener('visibilitychange', sync);
  }

  function Gallery(root, data) {
    this.root = root;
    this.items = data.items;
    this.sources = data.sources;
    this.index = -1;
    this.auto = true;
    this.hold = 0;
    this.build();
  }

  Gallery.prototype.build = function () {
    var self = this, items = this.items;

    this.player = new Player({
      onTick: function (t, d) {
        var cur = self.thumbs.children[self.index];
        if (cur && d) cur.querySelector('.s2s-thumb-bar').style.width = (100 * t / d) + '%';
      },
      onEnded: function () { self.ended(); },
      onSound: function () { self.renderAB(); },
      onSwipe: function (d) { self.pick(self.index + d); }
    });

    var info = h('div', 's2s-info');
    this.meta = h('div', 's2s-meta', '<span class="s2s-chip"></span><span class="s2s-count"></span>');
    this.title = h('h3', 's2s-title');
    this.caption = h('p', 's2s-caption');
    var ab = h('div', 's2s-ab-block');
    var abHead = h('div', 's2s-ab-head', '<span class="s2s-ab-label" id="s2s-ab-label">Listen</span>' +
      '<span class="s2s-phones">' + ICON.headphones + '<span>Headphones on</span></span>');
    this.ab = h('div', 's2s-ab');
    this.ab.setAttribute('role', 'radiogroup');
    this.ab.setAttribute('aria-labelledby', 's2s-ab-label');
    this.abOpts = ['mono', 'spatial'].map(function (mode) {
      var b = button('s2s-ab-opt', (mode === 'mono' ? ICON.mono : ICON.spatial) +
        '<span>' + (mode === 'mono' ? 'Mono' : 'Spatial') + '</span>');
      b.setAttribute('role', 'radio');
      b.setAttribute('data-mode', mode);
      b.addEventListener('click', function () { self.listen(mode); });
      self.ab.append(b);
      return b;
    });
    this.ab.addEventListener('keydown', function (e) {
      if (!/^Arrow/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      var mode = self.player.mode === 'mono' ? 'spatial' : 'mono';
      self.listen(mode);
      self.abOpts[mode === 'mono' ? 0 : 1].focus();
    });
    this.trackInfo = h('div', 's2s-trackinfo');
    ab.append(abHead, this.ab, this.trackInfo);
    info.append(this.meta, this.title, this.caption, ab);

    var main = h('div', 's2s-main');
    main.append(this.player.el, info);

    var strip = h('div', 's2s-strip');
    var head = h('div', 's2s-strip-head', '<span>' + items.length + ' examples<span class="s2s-strip-tip"> · ' +
      '<span class="s2s-on-hover">click</span><span class="s2s-on-touch">tap</span> any to explore</span></span>');
    this.autoBtn = button('s2s-auto', '<span class="s2s-auto-track" aria-hidden="true"></span><span>Auto-advance</span>');
    this.autoBtn.setAttribute('role', 'switch');
    this.autoBtn.setAttribute('aria-checked', 'true');
    this.autoBtn.addEventListener('click', function () { self.setAuto(!self.auto); });
    head.append(this.autoBtn);

    var row = h('div', 's2s-strip-row');
    var prev = button('s2s-nav', ICON.prev, 'Previous example');
    var next = button('s2s-nav', ICON.next, 'Next example');
    prev.addEventListener('click', function () { self.pick(self.index - 1); });
    next.addEventListener('click', function () { self.pick(self.index + 1); });
    this.thumbs = h('div', 's2s-thumbs');
    items.forEach(function (it, i) {
      var src = self.sources[it.kind];
      var b = button('s2s-thumb', null, 'Example ' + (i + 1) + ': ' + it.title + ' (' + src.label + ')');
      b.innerHTML = '<span class="s2s-thumb-img"><img src="' + esc(it.thumb) + '" alt="" width="320" height="180" loading="lazy" decoding="async">' +
        '<span class="s2s-thumb-kind">' + (it.video ? ICON.video : ICON.image) + '</span>' +
        '<span class="s2s-thumb-bar"></span></span><span class="s2s-thumb-title">' + esc(it.title) + '</span>';
      b.addEventListener('click', function () { self.pick(i); });
      self.thumbs.append(b);
    });
    row.append(prev, this.thumbs, next);
    strip.append(head, row);

    var body = this.root.querySelector('.s2s-body');
    body.innerHTML = '';
    body.append(main, strip);

    this.root.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        self.pick(self.index + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });

    this.select(0);
    this.renderAB();
    observeVisibility(this.player, this.player.stage, 0.35);
  };

  Gallery.prototype.listen = function (mode) {
    var p = this.player;
    p.setMode(mode);
    if (!p.soundOn) p.setSound(true);
    if (!p.playing) p.userPlay();
    this.renderAB();
  };

  Gallery.prototype.renderAB = function () {
    var p = this.player, it = this.items[this.index];
    this.abOpts.forEach(function (b) {
      var on = b.getAttribute('data-mode') === p.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    this.ab.classList.toggle('is-mono', p.mode === 'mono');
    this.ab.classList.toggle('is-silent', !p.soundOn);
    if (!it) return;
    this.trackInfo.innerHTML = p.mode === 'mono'
      ? ICON.mono + '<span>Mono: the same clip folded down to one channel</span>'
      : ICON.spatial + '<span>Spatial: ' + esc(it.layout) + ' from SEE‑2‑SOUND</span>';
  };

  Gallery.prototype.select = function (i) {
    var n = this.items.length;
    i = ((i % n) + n) % n;
    clearTimeout(this.hold);
    var old = this.thumbs.children[this.index];
    if (old) {
      old.removeAttribute('aria-current');
      old.querySelector('.s2s-thumb-bar').style.width = '0';
    }
    this.index = i;
    var it = this.items[i], src = this.sources[it.kind];
    var cur = this.thumbs.children[i];
    cur.setAttribute('aria-current', 'true');
    this.meta.firstChild.textContent = src.label;
    this.meta.firstChild.setAttribute('data-kind', it.kind);
    this.meta.lastChild.textContent = (i + 1) + ' / ' + n;
    this.title.textContent = it.title;
    this.caption.textContent = src.caption + ' · spatial audio by SEE‑2‑SOUND';
    this.scrollThumb(cur);
    this.player.load(it);
    this.renderAB();
    var nextItem = this.items[(i + 1) % n];
    if (nextItem && !nextItem.warm) {
      nextItem.warm = true;
      new Image().src = nextItem.video ? nextItem.poster : nextItem.image[0].src;
    }
  };

  Gallery.prototype.pick = function (i) {
    var p = this.player;
    p.consent = true;
    p.userPaused = false;
    if (((i % this.items.length) + this.items.length) % this.items.length === this.index) {
      clearTimeout(this.hold);
      p.restart();
    } else {
      this.select(i);
    }
  };

  Gallery.prototype.ended = function () {
    var self = this;
    clearTimeout(this.hold);
    if (this.player.userPaused) return;
    if (this.auto) this.hold = setTimeout(function () { self.select(self.index + 1); }, 1200);
    else this.hold = setTimeout(function () { self.player.restart(); }, 1500);
  };

  Gallery.prototype.setAuto = function (on) {
    var p = this.player;
    this.auto = on;
    this.autoBtn.setAttribute('aria-checked', String(on));
    if (!p.playing && !p.userPaused && p.now() >= p.duration - 0.05) this.ended();
  };

  Gallery.prototype.scrollThumb = function (b) {
    var s = this.thumbs;
    var left = b.offsetLeft - (s.clientWidth - b.offsetWidth) / 2;
    if (s.scrollTo) s.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
    else s.scrollLeft = left;
  };

  [].forEach.call(document.querySelectorAll('.s2s-viewer[data-items]'), function (root) {
    try {
      var data = JSON.parse(document.getElementById(root.getAttribute('data-items')).textContent);
      if (!data.items || !data.items.length) throw new Error('no examples');
      new Gallery(root, data);
    } catch (err) {
      root.classList.add('is-failed');
      if (window.console) console.warn(err);
    }
  });
})();
