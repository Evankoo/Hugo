/* ==========================================================
   手机端导航：汉堡按钮绑定 + 点击外部关闭
   SPA 换页后会重新绑定，避免按钮失效
   ========================================================== */
(function () {
  let boundToggle = null;
  let boundMenu = null;
  let boundNav = null;

  function isOpen(toggle, menu, nav) {
    return (
      toggle.getAttribute('aria-expanded') === 'true' ||
      toggle.classList.contains('is-active') ||
      (nav && nav.classList.contains('nav--active')) ||
      (menu &&
        (menu.classList.contains('is-active') ||
          menu.classList.contains('open') ||
          menu.classList.contains('active')))
    );
  }

  function setOpen(toggle, menu, nav, open) {
    toggle.classList.toggle('is-active', open);
    toggle.classList.toggle('nav--active', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menu) menu.classList.toggle('is-active', open);
    if (nav) nav.classList.toggle('nav--active', open);
  }

  function closeMenu() {
    if (!boundToggle) return;
    if (!isOpen(boundToggle, boundMenu, boundNav)) return;
    setOpen(boundToggle, boundMenu, boundNav, false);
  }

  function bindNavbar() {
    const toggle = document.querySelector('.navbar-burger');
    if (!toggle) {
      boundToggle = null;
      boundMenu = null;
      boundNav = null;
      return;
    }

    const target = toggle.getAttribute('aria-controls') || toggle.getAttribute('data-target');
    let menu = target
      ? document.getElementById(target) || document.querySelector('#' + CSS.escape(target))
      : null;
    if (!menu) {
      menu =
        document.querySelector('#navMenu') ||
        document.querySelector('.nav__list') ||
        document.querySelector('header nav');
    }
    const nav = menu ? menu.closest('nav') : document.querySelector('header nav');

    // 去掉旧监听：克隆节点最干净
    const fresh = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(fresh, toggle);

    boundToggle = fresh;
    boundMenu = menu;
    boundNav = nav;

    fresh.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(fresh, menu, nav, !isOpen(fresh, menu, nav));
    });

    if (menu) {
      menu.addEventListener('click', function (e) {
        const a = e.target.closest('a');
        if (a) closeMenu();
      });
    }

    // 初始关闭
    setOpen(fresh, menu, nav, false);
  }

  document.addEventListener('DOMContentLoaded', bindNavbar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', function (e) {
    if (!boundToggle || !isOpen(boundToggle, boundMenu, boundNav)) return;
    if (boundToggle.contains(e.target)) return;
    if (boundMenu && boundMenu.contains(e.target)) return;
    closeMenu();
  });

  window.__evanBindNavbar = bindNavbar;
  window.__evanCloseMenu = closeMenu;

})();

/* ==========================================================
   手机端分享海报：文章沿用封面比例，首页/联系页用统一视觉，
   About 使用电子名片。所有二维码都在点击时读取当前页面地址。
   ========================================================== */
(function () {
  const MAX_ARTICLE_WIDTH = 1200;
  const MAX_ARTICLE_HEIGHT = 1600;
  let posterRoot = null;
  let posterObjectUrl = null;
  let currentPosterBlob = null;
  let currentPosterFilename = 'evan-share.jpg';
  let toastTimer = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function showShareToast(message) {
    let toast = document.querySelector('.share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'share-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function copyUrl(url) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(url);
    }
    const field = document.createElement('textarea');
    field.value = url;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function loadImage(source) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('image failed: ' + source)); };
      image.src = source;
    });
  }

  function fitCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    const characters = Array.from((text || '').trim());
    const lines = [];
    let line = '';
    characters.forEach(function (character) {
      const candidate = line + character;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let finalLine = lines[maxLines - 1];
      while (finalLine && ctx.measureText(finalLine + '…').width > maxWidth) {
        finalLine = Array.from(finalLine).slice(0, -1).join('');
      }
      lines[maxLines - 1] = finalLine + '…';
    }
    return lines;
  }

  function drawQr(ctx, url, x, y, requestedSize, radius) {
    if (typeof window.qrcode !== 'function') throw new Error('QR generator unavailable');
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const quietModules = 4;
    const modules = qr.getModuleCount();
    const cell = Math.max(2, Math.floor(requestedSize / (modules + quietModules * 2)));
    const size = cell * (modules + quietModules * 2);
    roundedRect(ctx, x, y, size, size, radius);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#111820';
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (!qr.isDark(row, column)) continue;
        ctx.fillRect(
          x + (column + quietModules) * cell,
          y + (row + quietModules) * cell,
          cell,
          cell
        );
      }
    }
    return size;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('poster export failed'));
      }, 'image/jpeg', 0.85);
    });
  }

  async function drawArticlePoster(data) {
    const image = await loadImage(data.image);
    const scale = Math.min(
      1,
      MAX_ARTICLE_WIDTH / image.naturalWidth,
      MAX_ARTICLE_HEIGHT / image.naturalHeight
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    const padding = clamp(Math.round(width * 0.045), 22, 54);
    const qrRequest = clamp(Math.round(Math.min(width, height) * 0.25), 128, 240);
    const fontSize = clamp(Math.round(width * 0.045), 26, 54);
    const lineHeight = Math.round(fontSize * 1.38);
    const qrSpace = qrRequest + padding;
    const textWidth = Math.max(width * 0.42, width - qrSpace - padding * 2);
    ctx.font = '600 ' + fontSize + 'px "PingFang SC", "Noto Sans CJK SC", sans-serif';
    const lines = wrapText(ctx, data.title, textWidth, 3);
    const panelHeight = Math.min(
      height * 0.58,
      Math.max(qrRequest + padding * 2, lines.length * lineHeight + padding * 2)
    );
    const panelTop = height - panelHeight;
    const gradient = ctx.createLinearGradient(0, panelTop - panelHeight * 0.24, 0, height);
    gradient.addColorStop(0, 'rgba(9, 16, 22, 0)');
    gradient.addColorStop(0.25, 'rgba(9, 16, 22, 0.72)');
    gradient.addColorStop(1, 'rgba(9, 16, 22, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, panelTop - panelHeight * 0.24, width, panelHeight * 1.24);

    ctx.fillStyle = '#f8f6f0';
    ctx.textBaseline = 'top';
    lines.forEach(function (line, index) {
      ctx.fillText(line, padding, panelTop + padding + index * lineHeight);
    });
    const qrSize = drawQr(
      ctx,
      data.url,
      width - padding - qrRequest,
      height - padding - qrRequest,
      qrRequest,
      clamp(Math.round(width * 0.012), 7, 14)
    );
    if (qrSize !== qrRequest) {
      // qrcode modules use whole pixels; align the resulting square to the same corner.
      ctx.clearRect(width - padding - qrRequest, height - padding - qrRequest, qrRequest, qrRequest);
      drawQr(ctx, data.url, width - padding - qrSize, height - padding - qrSize, qrRequest, 10);
    }
    return canvas;
  }

  async function drawStandardPoster(data) {
    const image = await loadImage(data.image);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const visualHeight = 990;
    const panelTop = visualHeight;
    const padding = 76;
    const qrRequest = 252;

    if (data.kind === 'contact') {
      const background = ctx.createLinearGradient(0, 0, width, visualHeight);
      background.addColorStop(0, '#172631');
      background.addColorStop(0.55, '#101c25');
      background.addColorStop(1, '#0b151d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, visualHeight);
      ctx.strokeStyle = 'rgba(216, 183, 117, 0.2)';
      ctx.lineWidth = 2;
      [150, 205, 830, 885].forEach(function (offset) {
        ctx.beginPath();
        ctx.arc(width / 2, visualHeight / 2, offset, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.fillStyle = '#f6f3ec';
      ctx.font = '500 104px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('联系伊万', width / 2, 448);
      ctx.fillStyle = '#d8b775';
      ctx.fillRect(width / 2 - 96, 535, 192, 4);
      ctx.fillStyle = 'rgba(246, 243, 236, 0.7)';
      ctx.font = '400 30px "PingFang SC", sans-serif';
      ctx.fillText('内容合作 · 项目咨询 · 交流联系', width / 2, 610);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    } else {
      fitCover(ctx, image, 0, 0, width, visualHeight);
    }

    ctx.fillStyle = '#f5f1e8';
    ctx.fillRect(0, panelTop, width, height - panelTop);
    ctx.fillStyle = '#b49456';
    ctx.fillRect(padding, panelTop + 54, 120, 3);
    ctx.fillStyle = '#17222b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 43px "PingFang SC", sans-serif';
    ctx.fillText(data.kind === 'contact' ? '扫码打开联系方式' : 'evan-manual.com', padding, panelTop + 84);
    ctx.fillStyle = '#56616a';
    ctx.font = '400 30px "PingFang SC", sans-serif';
    ctx.fillText(data.kind === 'contact' ? '微信、内容平台与合作入口' : '文章 · 思考 · 个人记录', padding, panelTop + 151);
    ctx.fillStyle = '#8b7650';
    ctx.font = '400 24px "PingFang SC", sans-serif';
    ctx.fillText(data.kind === 'contact' ? data.copy : '扫码访问网站', padding, panelTop + 236);
    drawQr(ctx, data.url, width - padding - qrRequest, panelTop + 54, qrRequest, 16);
    return canvas;
  }

  async function drawAboutPoster(data) {
    const avatar = await loadImage(data.image);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#f7f4ed');
    background.addColorStop(1, '#ece6da');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const avatarSize = 264;
    const avatarX = 80;
    const avatarY = 104;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    fitCover(ctx, avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.fillStyle = '#16222b';
    ctx.font = '600 96px "PingFang SC", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('伊万', 398, 120);
    ctx.fillStyle = '#34414a';
    ctx.font = '400 35px "PingFang SC", sans-serif';
    ctx.fillText('个体 / 项目 / 老板 IP 操盘手', 402, 254);
    ctx.fillText('ACT 心理博主', 402, 310);

    ctx.fillStyle = '#c5a96d';
    ctx.fillRect(80, 438, 150, 3);
    ctx.fillStyle = '#16222b';
    ctx.font = '500 46px "PingFang SC", sans-serif';
    ctx.fillText('把专业能力变成长期内容，', 80, 510);
    ctx.fillText('也持续记录个体成长与心理探索。', 80, 578);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    roundedRect(ctx, 64, 760, 952, 424, 28);
    ctx.fill();
    const qrRequest = 316;
    drawQr(ctx, data.url, 100, 814, qrRequest, 18);
    ctx.fillStyle = '#16222b';
    ctx.font = '600 42px "PingFang SC", sans-serif';
    ctx.fillText('扫码查看完整介绍', 470, 868);
    ctx.fillStyle = '#667078';
    ctx.font = '400 28px "PingFang SC", sans-serif';
    ctx.fillText('evan-manual.com/about/', 470, 938);
    ctx.fillStyle = '#8b7650';
    ctx.font = '400 26px "PingFang SC", sans-serif';
    ctx.fillText('个人经历 · 内容方向 · 联系方式', 470, 1020);
    ctx.fillStyle = '#9b7e43';
    ctx.font = '500 25px "PingFang SC", sans-serif';
    ctx.fillText('伊万的个人主页', 80, 1252);
    return canvas;
  }

  function ensurePosterRoot() {
    if (posterRoot) return posterRoot;
    posterRoot = document.createElement('div');
    posterRoot.className = 'share-poster';
    posterRoot.hidden = true;
    posterRoot.setAttribute('role', 'dialog');
    posterRoot.setAttribute('aria-modal', 'true');
    posterRoot.setAttribute('aria-labelledby', 'share-poster-title');
    posterRoot.innerHTML =
      '<div class="share-poster__sheet">' +
        '<div class="share-poster__header">' +
          '<div><p class="share-poster__eyebrow">SHARE</p><h2 id="share-poster-title">分享当前页面</h2></div>' +
          '<button type="button" class="share-poster__close" aria-label="关闭分享图">×</button>' +
        '</div>' +
        '<div class="share-poster__stage">' +
          '<div class="share-poster__loading" role="status">正在生成分享图…</div>' +
          '<img class="share-poster__image" alt="当前页面的二维码分享图" hidden />' +
        '</div>' +
        '<p class="share-poster__hint"></p>' +
        '<div class="share-poster__actions">' +
          '<a class="share-poster__save" href="#" download>保存图片</a>' +
          '<button type="button" class="share-poster__copy">复制链接</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(posterRoot);
    posterRoot.querySelector('.share-poster__close').addEventListener('click', closePoster);
    posterRoot.addEventListener('click', function (event) {
      if (event.target === posterRoot) closePoster();
    });
    posterRoot.querySelector('.share-poster__copy').addEventListener('click', async function () {
      try {
        await copyUrl(posterRoot.dataset.shareUrl || location.href);
        showShareToast('链接已复制');
      } catch (error) {
        showShareToast('请复制浏览器地址栏中的链接');
      }
    });
    return posterRoot;
  }

  function closePoster() {
    if (!posterRoot) return;
    posterRoot.hidden = true;
    document.documentElement.classList.remove('share-poster-open');
  }

  async function openPoster(button) {
    const root = ensurePosterRoot();
    const imageElement = root.querySelector('.share-poster__image');
    const loading = root.querySelector('.share-poster__loading');
    const save = root.querySelector('.share-poster__save');
    const hint = root.querySelector('.share-poster__hint');
    const absoluteUrl = new URL(button.dataset.shareUrl || location.href, location.href).href;
    const imageUrl = new URL(button.dataset.shareImage || '/images/share-default.jpg', location.href).href;
    const data = {
      kind: button.dataset.shareKind || 'page',
      title: button.dataset.shareTitle || document.title,
      copy: button.dataset.shareCopy || '扫码打开当前页面',
      image: imageUrl,
      url: absoluteUrl
    };
    root.dataset.shareUrl = absoluteUrl;
    root.hidden = false;
    document.documentElement.classList.add('share-poster-open');
    imageElement.hidden = true;
    loading.hidden = false;
    loading.textContent = '正在生成分享图…';
    save.classList.add('is-disabled');
    save.removeAttribute('href');
    hint.textContent = /MicroMessenger/i.test(navigator.userAgent)
      ? '长按图片保存，再发送给朋友；对方扫码即可打开。'
      : '保存图片后发送给朋友，对方扫码即可打开。';
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      let canvas;
      if (data.kind === 'article') canvas = await drawArticlePoster(data);
      else if (data.kind === 'about') canvas = await drawAboutPoster(data);
      else canvas = await drawStandardPoster(data);
      currentPosterBlob = await canvasToBlob(canvas);
      if (posterObjectUrl) URL.revokeObjectURL(posterObjectUrl);
      posterObjectUrl = URL.createObjectURL(currentPosterBlob);
      currentPosterFilename = data.kind === 'article'
        ? '伊万-文章分享图.jpg'
        : data.kind === 'about'
          ? '伊万-电子名片.jpg'
          : '伊万-分享图.jpg';
      imageElement.src = posterObjectUrl;
      imageElement.hidden = false;
      loading.hidden = true;
      save.href = posterObjectUrl;
      save.download = currentPosterFilename;
      save.classList.remove('is-disabled');
    } catch (error) {
      loading.textContent = '分享图生成失败，请稍后重试。';
      console.error(error);
    }
  }

  function syncShareButton(sourceDocument) {
    const source = sourceDocument && sourceDocument.querySelector('.navbar-share');
    const target = document.querySelector('.navbar-share');
    if (!source || !target) return;
    ['shareTitle', 'shareDescription', 'shareKind', 'shareImage', 'shareUrl', 'shareCopy'].forEach(function (key) {
      target.dataset[key] = source.dataset[key] || '';
    });
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest && event.target.closest('.navbar-share');
    if (!button) return;
    event.preventDefault();
    openPoster(button);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && posterRoot && !posterRoot.hidden) closePoster();
  });
  window.__evanSyncShareButton = syncShareButton;
})();

/* ==========================================================
   侧栏肖像序章：每次会话首次进入首页时依次播放；
   内页保持完成态，减少动态效果偏好下不播放。
   ========================================================== */
(function () {
  const STORAGE_KEY = 'evanPortraitSeenV1';
  const ROOT_CLASS = 'evan-portrait-animate';
  const DURATION_MS = 2600;
  let finishTimer = null;

  function isHome(pathname) {
    return (pathname || '/').replace(/\/+$/, '') === '';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function finishAnimation() {
    clearTimeout(finishTimer);
    finishTimer = null;
    document.documentElement.classList.remove(ROOT_CLASS);
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.removeAttribute('aria-busy');
  }

  function scheduleFinish() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.setAttribute('aria-busy', 'true');
      sidebar.dataset.portraitPlayed = 'true';
    }
    clearTimeout(finishTimer);
    finishTimer = setTimeout(finishAnimation, DURATION_MS);
  }

  function syncPortraitHeading(pathname) {
    const caption = document.querySelector('.sidebar-portrait__caption');
    if (!caption) return;
    const current = caption.querySelector('h1, .sidebar-portrait__name');
    if (!current) return;
    const shouldBeHeading = isHome(pathname);
    if ((shouldBeHeading && current.tagName === 'H1') || (!shouldBeHeading && current.tagName !== 'H1')) return;

    const replacement = document.createElement(shouldBeHeading ? 'h1' : 'span');
    if (!shouldBeHeading) replacement.className = 'sidebar-portrait__name';
    replacement.textContent = current.textContent;
    current.replaceWith(replacement);
  }

  function syncPortraitIntro(pathname) {
    const root = document.documentElement;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    syncPortraitHeading(pathname);

    if (!isHome(pathname)) {
      finishAnimation();
      return;
    }
    if (root.classList.contains(ROOT_CLASS)) {
      scheduleFinish();
      return;
    }
    if (
      root.classList.contains('evan-gallery') ||
      sidebar.classList.contains('is-flipped') ||
      sidebar.classList.contains('is-resetting-gallery')
    ) return;

    let seen = false;
    try { seen = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (err) {}
    if (seen) return;
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) {}
    if (prefersReducedMotion()) return;

    // Restart the CSS sequence after an SPA navigation without rebuilding the sidebar.
    root.classList.remove(ROOT_CLASS);
    void sidebar.offsetWidth;
    root.classList.add(ROOT_CLASS);
    scheduleFinish();
  }

  function cancelPortraitIntro() {
    finishAnimation();
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncPortraitIntro(location.pathname);
  });
  window.__evanSyncPortraitIntro = syncPortraitIntro;
  window.__evanCancelPortraitIntro = cancelPortraitIntro;
})();

/* ==========================================================
   侧栏动态画廊：点击空白翻入画廊，点击首页恢复头像；
   封面以温和淡入淡出自动轮播；跨普通页面保持画廊状态。
   ========================================================== */
document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const img = sidebar.querySelector('.sidebar__gallery-img');
  const portrait = sidebar.querySelector('[data-sidebar-portrait]');
  const galleryFace = sidebar.querySelector('.sidebar__face--back');
  const covers = Array.isArray(window.EVAN_COVERS) ? window.EVAN_COVERS : [];
  const STORAGE_KEY = 'evanGallery';
  const SRC_KEY = 'evanGallerySrc';
  const FADE_MS = 800;
  let lastIndex = -1;

  function setGalleryTabState(flipped) {
    if (portrait) portrait.setAttribute('tabindex', flipped ? '-1' : '0');
    if (galleryFace) galleryFace.setAttribute('tabindex', flipped ? '0' : '-1');
  }

  function randomCover() {
    if (!covers.length) return null;
    let i = lastIndex;
    while (covers.length > 1 && i === lastIndex) {
      i = Math.floor(Math.random() * covers.length);
    }
    lastIndex = i;
    return covers[i];
  }

  function switchCover() {
    const next = randomCover();
    if (!next) return;
    // 先预加载，再淡出-换图-淡入，避免闪烁
    const pre = new Image();
    pre.onload = function () {
      img.classList.add('is-fading');
      setTimeout(function () {
        img.setAttribute('src', next);
        img.classList.remove('is-fading');
        try { sessionStorage.setItem(SRC_KEY, next); } catch (err) {}
      }, FADE_MS);
    };
    pre.src = next;
  }

  function enterGallery(animated) {
    if (sidebar.classList.contains('is-flipped')) return;
    // 跨页面保持同一张图；只有点击画廊才换图
    let c = null;
    try { c = sessionStorage.getItem(SRC_KEY); } catch (err) {}
    if (!c || covers.indexOf(c) < 0) c = randomCover();
    if (!c) {
      document.documentElement.classList.remove('evan-gallery');
      return;
    }
    if (!animated) sidebar.classList.add('no-anim');
    if (window.__evanCancelPortraitIntro) window.__evanCancelPortraitIntro();
    img.setAttribute('src', c);
    sidebar.classList.add('is-flipped');
    setGalleryTabState(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
      sessionStorage.setItem(SRC_KEY, c);
    } catch (err) {}
    if (!animated) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sidebar.classList.remove('no-anim');
          document.documentElement.classList.remove('evan-gallery');
        });
      });
    }
  }

  function resetGallery(animated) {
    if (!animated) sidebar.classList.add('no-anim');
    if (animated) sidebar.classList.add('is-resetting-gallery');
    sidebar.classList.remove('is-flipped');
    setGalleryTabState(false);
    img.classList.remove('is-fading');
    document.documentElement.classList.remove('evan-gallery');
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SRC_KEY);
    } catch (err) {}
    if (!animated) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          sidebar.classList.remove('no-anim');
        });
      });
    } else {
      setTimeout(function () {
        sidebar.classList.remove('is-resetting-gallery');
        if (window.__evanSyncPortraitIntro) window.__evanSyncPortraitIntro(location.pathname);
      }, 760);
    }
  }

  window.__evanResetGallery = resetGallery;

  sidebar.addEventListener('click', function (e) {
    if (sidebar.classList.contains('is-flipped')) {
      switchCover(); // 画廊态下点击：温和切换到下一张
      return;
    }
    if (e.target.closest('[data-sidebar-portrait]')) {
      enterGallery(true);
      return;
    }
    // 只有点击真正的空白区域才翻页：链接、图标、图片、列表不触发
    if (e.target.closest('a, button, img, i, ul, h1')) return;
    enterGallery(true);
  });

  sidebar.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!sidebar.classList.contains('is-flipped') && e.target.closest('[data-sidebar-portrait]')) {
      e.preventDefault();
      enterGallery(true);
      setTimeout(function () {
        if (galleryFace) galleryFace.focus({ preventScroll: true });
      }, 760);
      return;
    }
    if (sidebar.classList.contains('is-flipped') && e.target.closest('.sidebar__face--back')) {
      e.preventDefault();
      switchCover();
    }
  });

  document.addEventListener('click', function (e) {
    const homeLink = e.target.closest && e.target.closest('a[data-evan-home-link]');
    if (homeLink) resetGallery(true);
  });

  // 同一会话内已进入过画廊：页面加载后直接恢复（无动画）
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') enterGallery(false);
  } catch (err) { /* sessionStorage 不可用时忽略 */ }

  // 支持 #gallery 直接打开画廊（也便于测试）；测试时跳过动画
  if (location.hash === '#gallery') enterGallery(false);
});

/* ==========================================================
   首页渐进式瀑布流：首屏只渲染一页，接近底部时再加载下一页。
   ========================================================== */
(function () {
  let activeObserver = null;

  function setFeedState(feed, state, message) {
    feed.dataset.state = state;
    feed.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    const status = feed.querySelector('.gallery-feed__status');
    const retry = feed.querySelector('.gallery-feed__retry');
    if (status) status.textContent = message;
    if (retry) retry.hidden = state !== 'error' && state !== 'fallback';
  }

  async function loadNextPage(grid, feed) {
    if (!grid || !feed) return;
    if (feed.dataset.state === 'loading' || feed.dataset.state === 'complete') return;

    const nextUrl = feed.dataset.nextUrl;
    if (!nextUrl) {
      setFeedState(feed, 'complete', '已经看完全部文章');
      if (activeObserver) activeObserver.unobserve(feed);
      return;
    }

    setFeedState(feed, 'loading', '正在加载更多文章');

    try {
      const nextPageUrl = new URL(nextUrl, location.href).href;
      const response = await fetch(nextPageUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('http ' + response.status);

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextGrid = doc.querySelector('.gallery-grid');
      const nextFeed = doc.querySelector('[data-gallery-feed]');
      if (!nextGrid || !nextFeed) throw new Error('invalid gallery page');

      const existing = new Set(
        Array.from(grid.querySelectorAll('.gallery-card[href]')).map(function (card) {
          return new URL(card.href, location.href).href;
        })
      );

      Array.from(nextGrid.children).forEach(function (card) {
        if (!card.matches('.gallery-card[href]')) return;
        const href = new URL(card.getAttribute('href'), nextPageUrl).href;
        if (existing.has(href)) return;
        const fresh = document.importNode(card, true);
        fresh.classList.add('gallery-card--revealed');
        grid.appendChild(fresh);
        existing.add(href);
      });

      const followingUrl = nextFeed.dataset.nextUrl;
      if (followingUrl) {
        feed.dataset.nextUrl = followingUrl;
        setFeedState(feed, 'idle', '继续向下浏览');
      } else {
        feed.removeAttribute('data-next-url');
        setFeedState(feed, 'complete', '已经看完全部文章');
        if (activeObserver) activeObserver.unobserve(feed);
      }
    } catch (err) {
      setFeedState(feed, 'error', '暂时没有加载成功');
    }
  }

  function bindProgressiveGallery() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    const main = document.querySelector('.wrapper__main');
    const grid = main && main.querySelector('.gallery-grid');
    const feed = main && main.querySelector('[data-gallery-feed]');
    if (!grid || !feed || feed.dataset.galleryBound === 'true') return;

    feed.dataset.galleryBound = 'true';
    const retry = feed.querySelector('.gallery-feed__retry');
    if (retry) {
      retry.addEventListener('click', function () {
        loadNextPage(grid, feed);
      });
    }

    if (!feed.dataset.nextUrl) {
      setFeedState(feed, 'complete', '已经看完全部文章');
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setFeedState(feed, 'fallback', '继续浏览更多文章');
      return;
    }

    activeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) loadNextPage(grid, feed);
        });
      },
      { rootMargin: '420px 0px' }
    );
    activeObserver.observe(feed);
  }

  document.addEventListener('DOMContentLoaded', bindProgressiveGallery);
  window.__evanBindProgressiveGallery = bindProgressiveGallery;
})();

/* ==========================================================
   局部导航路由：只替换右侧内容区，左侧栏保持静止
   SPA 换页后重新绑定汉堡按钮
   ========================================================== */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.history.pushState || !window.DOMParser) return;
  // WeChat snapshots share metadata when a document loads. Its share menu can
  // keep the entry page's description and image across our partial navigation,
  // so use normal document loads there to refresh the complete <head>.
  if (/MicroMessenger/i.test(navigator.userAgent)) return;
  let main = document.querySelector('.wrapper__main');
  if (!main) return;

  main.style.transition = 'opacity 0.15s ease';
  const cache = new Map();

  function shouldHandle(a, e) {
    if (!a) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    let url;
    try {
      url = new URL(a.href, location.href);
    } catch (err) {
      return false;
    }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.hash) return false;
    return true;
  }

  async function navigate(url, push) {
    try {
      let doc = cache.get(url);
      if (!doc) {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('http ' + res.status);
        const html = await res.text();
        doc = new DOMParser().parseFromString(html, 'text/html');
        cache.set(url, doc);
      }
      const newMain = doc.querySelector('.wrapper__main');
      if (!newMain) throw new Error('no main in response');

      if (window.__evanCloseMenu) window.__evanCloseMenu();

      if (push) history.pushState({ evanNav: true }, '', url);
      document.title = doc.title;
      if (window.__evanSyncShareButton) window.__evanSyncShareButton(doc);

      main.style.opacity = '0';
      setTimeout(function () {
        const fresh = newMain.cloneNode(true);
        fresh.style.transition = 'opacity 0.15s ease';
        fresh.style.opacity = '0';
        main.replaceWith(fresh);
        main = fresh;
        window.scrollTo(0, 0);
        if (window.__evanBindNavbar) window.__evanBindNavbar();
        if (window.__evanBindProgressiveGallery) window.__evanBindProgressiveGallery();
        if (window.__evanSyncPortraitIntro) {
          window.__evanSyncPortraitIntro(new URL(url, location.href).pathname);
        }
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            fresh.style.opacity = '1';
          });
        });
      }, 150);
    } catch (err) {
      location.href = url;
    }
  }

  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!shouldHandle(a, e)) return;
    e.preventDefault();
    const url = new URL(a.href, location.href).href;
    if (url === location.href) return;
    navigate(url, true);
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });
});
