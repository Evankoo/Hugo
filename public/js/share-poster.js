(function () {
  function isMobile() {
    const ua = navigator.userAgent || '';
    const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const narrow = Math.min(screen.width, screen.height) <= 1024;
    const flagUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    return (touch && narrow) || flagUA;
  }

  function lockBody(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function ensureOverlayInBody() {
    const ov = document.getElementById('poster-overlay');
    if (ov && ov.parentElement !== document.body) {
      document.body.appendChild(ov); // 避免被有 transform 的祖先影响
    }
  }

  async function copyLink(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert('链接已复制');
    } catch {
      prompt('复制失败，请手动复制：', text);
    }
  }

  async function loadImage(src) {
    if (!src) return null;
    let u; try { u = new URL(src, location.href); } catch {}
    const same = !u || u.origin === location.origin;
    if (same) {
      return await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('图片加载失败: ' + src));
        img.crossOrigin = 'anonymous';
        img.src = src;
      });
    } else {
      try {
        const r = await fetch(src, { mode: 'cors', credentials: 'omit' });
        if (!r.ok) throw new Error('CORS 非 2xx');
        const b = await r.blob();
        const url = URL.createObjectURL(b);
        return await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片加载失败: ' + src)); };
          img.src = url;
        });
      } catch (e) {
        console.warn('外链封面未允许 CORS，已跳过封面：', src, e);
        return null;
      }
    }
  }

  async function makeQrCanvas(text, size) {
    if (typeof QRCode === 'undefined') return null;
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    document.body.appendChild(holder);
    const qr = new QRCode(holder, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    await new Promise(r => setTimeout(r, 0));
    const cvs = holder.querySelector('canvas');
    document.body.removeChild(holder);
    return cvs || null;
  }

  async function generatePoster({ title, url, cover }) {
    const W = 720, pad = 32, gap = 20, qrSize = 180;
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = 'bold 34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif';

    const wrap = (text, maxWidth) => {
      const arr = (text || '').trim().split('');
      let line = '', lines = [];
      arr.forEach(ch => {
        const t = line + ch;
        if (ctx.measureText(t).width > maxWidth) { lines.push(line); line = ch; }
        else { line = t; }
      });
      if (line) lines.push(line);
      return lines.slice(0, 3);
    };

    const titleLines = wrap(title, W - pad * 2);
    const titleH = titleLines.length * 44;

    const coverImg = await loadImage(cover).catch(() => null);
    const coverH = coverImg ? Math.round(W * 9 / 16) : 0;

    const site = (location.hostname || '').replace(/^www\./, '');
    const siteH = 26;

    const H = pad + coverH + (coverH ? gap : 0) + titleH + gap + qrSize + 12 + siteH + pad;

    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const c = cvs.getContext('2d');

    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    let y = pad;

    if (coverImg) {
      const targetW = W - pad * 2, targetH = coverH;
      const rImg = coverImg.width / coverImg.height, rBox = targetW / targetH;
      let sx = 0, sy = 0, sw = coverImg.width, sh = coverImg.height;
      if (rImg > rBox) { sw = Math.round(sh * rBox); sx = Math.round((coverImg.width - sw) / 2); }
      else { sh = Math.round(sw / rBox); sy = Math.round((coverImg.height - sh) / 2); }
      c.save();
      const rx = pad, ry = y, rw = targetW, rh = targetH, r = 12;
      c.beginPath();
      c.moveTo(rx + r, ry);
      c.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
      c.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
      c.arcTo(rx, ry + rh, rx, ry, r);
      c.arcTo(rx, ry, rx + rw, ry, r);
      c.closePath();
      c.clip();
      c.drawImage(coverImg, sx, sy, sw, sh, rx, ry, rw, rh);
      c.restore();
      y += coverH + gap;
    }

    c.fillStyle = '#111';
    c.font = 'bold 34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif';
    titleLines.forEach((ln, i) => { c.fillText(ln, pad, y + 38 * i); });
    y += titleH + gap;

    let qrDrawn = false;
    let qrY = y;
    try {
      const qrCvs = await makeQrCanvas(url, qrSize);
      if (qrCvs) { c.drawImage(qrCvs, pad, qrY, qrSize, qrSize); qrDrawn = true; }
    } catch (e) { console.warn('二维码生成失败', e); }

    c.fillStyle = '#666';
    c.font = '24px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif';
    const tip = qrDrawn ? `扫描二维码阅读：${site}` : site;
    c.fillText(tip, pad + (qrDrawn ? (qrSize + 16) : 0), qrY + 30);

    return cvs.toDataURL('image/png');
  }

  async function openPoster(data) {
    ensureOverlayInBody();
    const img = document.getElementById('poster-image');
    const overlay = document.getElementById('poster-overlay');
    img.src = ''; overlay.style.display = 'block'; lockBody(true);
    try {
      img.src = await generatePoster(data);
    } catch (e) {
      overlay.style.display = 'none'; lockBody(false);
      throw e;
    }
  }

  function closePoster() {
    const overlay = document.getElementById('poster-overlay');
    overlay.style.display = 'none';
    lockBody(false);
  }

  window.shareArticle = async function (ev, el) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const data = {
      title: document.querySelector('meta[property="og:title"]')?.content || document.title,
      url: location.href.split('#')[0],
      cover: document.querySelector('meta[property="og:image"]')?.content || el?.dataset?.cover || ''
    };
    const forcePoster = el?.dataset?.forcePoster === '1' || isMobile();
    if (forcePoster) {
      try { await openPoster(data); }
      catch (e) { console.error('生成海报失败：', e); await copyLink(data.url); }
    } else {
      await copyLink(data.url);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureOverlayInBody();
    const mask = document.getElementById('poster-mask');
    const btnClose = document.getElementById('poster-close');
    const btnDL = document.getElementById('poster-download');
    mask && mask.addEventListener('click', closePoster);
    btnClose && btnClose.addEventListener('click', closePoster);
    btnDL && btnDL.addEventListener('click', () => {
      const img = document.getElementById('poster-image');
      if (!img || !img.src) return;
      const a = document.createElement('a');
      a.download = 'poster.png';
      a.href = img.src;
      document.body.appendChild(a); a.click(); a.remove();
    });
  });
})();
