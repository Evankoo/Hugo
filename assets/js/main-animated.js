// 文件位置：themes/你的主题/js/main-animated.js
document.addEventListener('DOMContentLoaded', function() {
  // -----------------------------
  // 1️⃣ Header 动画
  // -----------------------------
  var header = document.querySelector('.header > div');
  if (header && !header.classList.contains('animated')) {
    header.classList.add('animated', 'fadeInDown');
  }

  // -----------------------------
  // 2️⃣ Sidebar 动画
  // -----------------------------
  var sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.classList.contains('animated')) {
    sidebar.classList.add('animated', 'fadeInDown');
  }

  // -----------------------------
  // 3️⃣ Tag 页面 / Posts 页面 / Archive 页面 动画
  // -----------------------------
  var contentContainers = document.querySelectorAll(
    '.tag-page-container, .taxonomy-unified-page, .archive, .post-page, .post'
  );

  contentContainers.forEach(function(el) {
    if (!el.classList.contains('animated')) {
      el.classList.add('animated', 'fadeInDown');
    }
  });

  // -----------------------------
  // 4️⃣ Navbar burger 动画（可选）
  // -----------------------------
  var burger = document.querySelector('.navbar-burger');
  if (burger) {
    burger.addEventListener('click', function() {
      var targetId = burger.dataset.target;
      var target = document.getElementById(targetId);
      if (target) {
        target.classList.toggle('is-active');
      }
      burger.classList.toggle('is-active');
    });
  }
});