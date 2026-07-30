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
   侧栏动态画廊：点击空白翻入画廊后不再翻回，
   封面以温和淡入淡出自动轮播；同一会话内跨页面保持，
   只有新开标签页（全新访问）才回到头像页。
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

  sidebar.addEventListener('click', function (e) {
    if (sidebar.classList.contains('is-flipped')) {
      switchCover(); // 画廊态下点击：温和切换到下一张
      return;
    }
    // 只有点击真正的空白区域才翻页：链接、图标、图片、列表不触发
    if (e.target.closest('a, button, img, i, ul, h1')) return;
    enterGallery(true);
  });

  // 同一会话内已进入过画廊：页面加载后直接恢复（无动画）
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') enterGallery(false);
  } catch (err) { /* sessionStorage 不可用时忽略 */ }

  // 支持 #gallery 直接打开画廊（也便于测试）；测试时跳过动画
  if (location.hash === '#gallery') enterGallery(false);
});

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
