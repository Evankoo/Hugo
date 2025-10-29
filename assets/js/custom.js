document.addEventListener('DOMContentLoaded', function () {
  if (window.__anatoleClickAwayInstalled) return;
  window.__anatoleClickAwayInstalled = true;

  // 找按钮与菜单（Anatole/Bulma 常见选择器）
  const toggle =
    document.querySelector('.navbar-burger') ||
    document.querySelector('.menu-toggle, #navToggle, .hamburger, .nav-toggle, [aria-controls]');
  if (!toggle) {
    console.warn('[clickaway] 未找到菜单开关按钮(toggle)。');
    return;
  }

  let menu = null;
  const target = toggle.getAttribute('aria-controls') || toggle.getAttribute('data-target');
  if (target) {
    menu = document.getElementById(target) || document.querySelector('#' + CSS.escape(target));
  }
  if (!menu) {
    menu =
      document.querySelector('.navbar-menu') ||
      document.querySelector('.mobile-menu') ||
      document.querySelector('#navMenu') ||
      document.querySelector('header nav') ||
      document.querySelector('nav[role="navigation"]') ||
      document.querySelector('.menu');
  }

  // 动态创建遮罩
  const mask = document.createElement('div');
  mask.id = 'navBackdrop';
  document.body.appendChild(mask);

  // 导航容器（用来计算“遮罩从哪开始盖”）
  const host = (menu || toggle).closest('header, .navbar, nav, .site-header, header.header') || document.querySelector('header') || document.body;

  // 判定是否打开
  const isOpen = () =>
    toggle.getAttribute('aria-expanded') === 'true' ||
    toggle.classList.contains('is-active') ||
    (menu && (menu.classList.contains('is-active') || menu.classList.contains('open') || menu.classList.contains('active')));

  // 计算遮罩的 top，使其不覆盖导航区域（按钮可点）
  const updateMaskTop = () => {
    const rect = host.getBoundingClientRect();
    // 遮罩为 fixed，top 用视口坐标即可
    const top = Math.max(0, Math.round(rect.bottom));
    mask.style.top = isOpen() ? (top + 'px') : '0px';
  };

  // 同步遮罩显示
  const syncMask = () => {
    if (isOpen()) {
      updateMaskTop();            // 遮罩从导航底部开始
      mask.classList.add('show');
      // 不再锁滚动：不设置 body.style.overflow
    } else {
      mask.classList.remove('show');
      mask.style.top = '0px';
    }
  };

  // 关闭菜单：复用主题原来的切换逻辑
  const closeMenu = () => {
    if (!isOpen()) return;
    toggle.click();
    // 等主题切完 class 再同步
    setTimeout(syncMask, 0);
  };

  // 绑定
  toggle.addEventListener('click', () => setTimeout(syncMask, 0));
  mask.addEventListener('click', closeMenu);

  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    const t = e.target;
    if ((menu && menu.contains(t)) || toggle.contains(t)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  if (menu) {
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) closeMenu();
    });
  }

  // 监听主题自身变更，实时同步遮罩与 top
  const mo = new MutationObserver(() => { syncMask(); });
  mo.observe(toggle, { attributes: true, attributeFilter: ['class', 'aria-expanded'] });
  if (menu) mo.observe(menu, { attributes: true, attributeFilter: ['class', 'style'] });

  // 打开时窗口滚动/尺寸变化，更新遮罩 top
  const onViewportChange = () => { if (isOpen()) updateMaskTop(); };
  window.addEventListener('scroll', onViewportChange, { passive: true });
  window.addEventListener('resize', onViewportChange);

  // 初始同步
  syncMask();
});
