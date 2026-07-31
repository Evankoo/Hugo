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
   手机端分享：系统分享面板 / 微信右上角提示 / 复制链接兜底
   使用事件委托，局部导航替换页面后无需重新绑定
   ========================================================== */
(function () {
  let toastTimer = null;

  function showShareToast(message, wechat) {
    let toast = document.querySelector('.share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'share-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.classList.toggle('share-toast--wechat', Boolean(wechat));
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, wechat ? 3600 : 2200);
  }

  function copyCurrentUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(location.href);
    }
    const field = document.createElement('textarea');
    field.value = location.href;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  document.addEventListener('click', async function (event) {
    const button = event.target.closest && event.target.closest('.navbar-share');
    if (!button) return;
    event.preventDefault();

    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWechat) {
      showShareToast('请点击右上角 ···，选择“转发给朋友”', true);
      return;
    }

    const shareData = {
      title: button.dataset.shareTitle || document.title,
      text: button.dataset.shareDescription || '',
      url: location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }

    try {
      await copyCurrentUrl();
      showShareToast('链接已复制');
    } catch (error) {
      showShareToast('请复制浏览器地址栏中的链接');
    }
  });
})();

/* ==========================================================
   侧栏动态画廊：点击空白翻入画廊，点击首页恢复头像；
   封面以温和淡入淡出自动轮播；跨普通页面保持画廊状态。
   ========================================================== */
document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const img = sidebar.querySelector('.sidebar__gallery-img');
  const covers = Array.isArray(window.EVAN_COVERS) ? window.EVAN_COVERS : [];
  const STORAGE_KEY = 'evanGallery';
  const SRC_KEY = 'evanGallerySrc';
  const FADE_MS = 800;
  let lastIndex = -1;

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
    img.setAttribute('src', c);
    sidebar.classList.add('is-flipped');
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
    sidebar.classList.remove('is-flipped');
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
    }
  }

  window.__evanResetGallery = resetGallery;

  sidebar.addEventListener('click', function (e) {
    if (sidebar.classList.contains('is-flipped')) {
      switchCover(); // 画廊态下点击：温和切换到下一张
      return;
    }
    // 只有点击真正的空白区域才翻页：链接、图标、图片、列表不触发
    if (e.target.closest('a, button, img, i, ul, h1')) return;
    enterGallery(true);
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
