// Shared runtime from CardScape HTML export.
export const mountBackground = function mountBackground(canvas, template, params, options) {
  options = options || {};
  // 模版画在离屏缓冲上，再整体平移贴到画布上，这样位置偏移对所有模版都生效
  var out = canvas.getContext('2d');
  var buf = document.createElement('canvas'), ctx = buf.getContext('2d');
  var reduce = !options.ignoreReducedMotion && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var p = Object.assign({}, params);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgb(hex) {
    var h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h.slice(0, 6), 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // 循环周期（毫秒）：导出无缝循环视频时设为视频时长，平时为 0。
  // 模版用 env.ph(速度) 代替"时间 × 速度"来算相位：周期为 0 时两者完全相同；
  // 周期不为 0 时，速度会微调到在一个周期内正好走完整数圈（period 默认 2π，平移类动画传入平移一圈的长度），
  // 周期结束时画面精确回到起点。慢到一圈都走不完的，改为在周期内以原速往返一次，不强行加速；
  // 但像滚动这种"往回走"会很怪的，传 whole = true，至少走满一圈。
  var TAU = 6.283185307179586;
  function ph(rate, period, whole) {
    var P = period || TAU, L = env.loop;
    if (!L || !rate) return rate * env.time;
    var x = rate * L / P, n = Math.round(x);
    if (!n && whole) n = x > 0 ? 1 : -1;
    if (n) return n * P / L * env.time;
    return rate * L / TAU * Math.sin(TAU * env.time / L);
  }
  var env = {
    W: 1, H: 1, dpr: 1, time: options.startTime || 0, reduced: reduce, loop: options.loop || 0,
    pointer: { x: -9999, y: -9999, active: false },
    clamp: clamp, rgb: rgb, rgba: rgba, ph: ph
  };
  var inst = template(ctx, env, p);

  // 内容避让：只在指定区域保留装饰，其余区域擦成透明（露出容器自己的背景）或填色
  // 覆盖度渐变：避让区域为 1，装饰区域为 0
  function maskGradient(c2, col, m, size, soft) {
    var W = env.W, H = env.H, D = Math.hypot(W, H), g, c = function (a) { return rgba(col, a); };
    if (m.indexOf('corner-') === 0) {           // 装饰保留在某个角
      var cx = m.charAt(8) === 'r' ? W : 0, cy = m.charAt(7) === 'b' ? H : 0, r0 = size * D, r1 = r0 + soft * D * 0.6;
      g = c2.createRadialGradient(cx, cy, r0, cx, cy, r1);
      g.addColorStop(0, c(0)); g.addColorStop(1, c(1));
    } else if (m.indexOf('edge-') === 0) {      // 装饰保留在某条边
      var e = m.slice(5), x0 = e === 'right' ? W : 0, y0 = e === 'bottom' ? H : 0, x1 = e === 'left' ? W : 0, y1 = e === 'top' ? H : 0;
      if (e === 'top' || e === 'bottom') { x0 = x1 = 0; } else { y0 = y1 = 0; }
      g = c2.createLinearGradient(x0, y0, x1, y1);
      var a = clamp(size, 0, 1), b = clamp(size + soft * 0.6, 0, 1);
      g.addColorStop(0, c(0)); g.addColorStop(a, c(0)); g.addColorStop(Math.max(a, b), c(1)); g.addColorStop(1, c(1));
    } else if (m === 'band') {                  // 中间横带留白
      var half = size / 2, sb = soft * 0.5;
      var a1 = clamp(0.5 - half - sb, 0, 1), b1 = clamp(0.5 - half, 0, 1), c1 = clamp(0.5 + half, 0, 1), d1 = clamp(0.5 + half + sb, 0, 1);
      g = c2.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, c(0)); g.addColorStop(a1, c(0)); g.addColorStop(Math.max(a1, b1), c(1));
      g.addColorStop(Math.max(b1, c1), c(1)); g.addColorStop(Math.max(c1, d1), c(0)); g.addColorStop(1, c(0));
    } else {                                    // vignette 中心留白 / edges 四周淡出
      var R = D / 2, inner = size * R, outer = inner + Math.max(1, soft * R), inside = m === 'vignette' ? 1 : 0;
      g = c2.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, outer);
      g.addColorStop(0, c(inside)); g.addColorStop(1, c(1 - inside));
    }
    return g;
  }

  // 避让区的渐进模糊（像 backdrop-filter 盖在装饰上面）：内容区最模糊，往装饰区方向逐渐变清晰。
  // 每一档模糊的做法：先逐级对半缩小（类似 mipmap，防止细小的点在缩小时忽隐忽现），
  // 在缩小后的画面上做真正的高斯模糊（ctx.filter），再放大回来——模糊后的画面没有高频细节，放大不会出现方块感。
  // 模糊半径按 2 倍递增（2、4、8、16、32px…），人眼对模糊的感知接近对数，这样过渡才显得均匀自然。
  // 各档模糊都在半分辨率上合成（模糊后的画面没有细节，半分辨率足够），最后只放大叠回一次，性能开销小很多
  var levels = [], work = [], bFull = document.createElement('canvas'), bAcc = document.createElement('canvas'), BLUR_STEPS = 5, hasFilter = null;
  function cnv(arr, i, w, h) {
    var c = arr[i] || (arr[i] = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.clearRect(0, 0, w, h);
    return c;
  }
  function filterOK() {
    if (hasFilter === null) { var t = document.createElement('canvas').getContext('2d'); t.filter = 'blur(2px)'; hasFilter = t.filter === 'blur(2px)'; }
    return hasFilter;
  }
  // 第 i 档模糊（1..L）对应的遮罩：把整段过渡平均切成 L 段，第 i 档从第 i 段开始出现
  function levelMask(m, size, soft, i, L) {
    if (m.indexOf('corner-') === 0 || m.indexOf('edge-') === 0) return [size + (i - 1) / L * soft * 0.6, soft / L];
    if (m === 'edges') return [size + (i - 1) / L * soft, soft / L];
    return [size + soft * (1 - i / L), soft / L];      // band / vignette：覆盖区在内侧
  }
  function blurAvoided(m, size, soft) {
    var px = clamp(p.maskBlur || 0, 0, 80); if (px < 0.5) return;
    // 模糊范围：模糊从多深入装饰区的地方开始渐入（0 = 只在淡出过渡带里，1 = 从装饰中心附近就开始）
    var reach = clamp(p.maskBlurRange == null ? .35 : p.maskBlurRange, 0, 1);
    if (m.indexOf('corner-') === 0 || m.indexOf('edge-') === 0) { soft = soft + size * reach / 0.6; size = size * (1 - reach); }
    else if (m === 'edges') { soft = soft + size * reach; size = size * (1 - reach); }
    else { soft = Math.min(2, soft * (1 + 2 * reach)); }
    var BW = buf.width, BH = buf.height, D = env.dpr, L = BLUR_STEPS, useF = filterOK();
    var HW = Math.max(1, Math.ceil(BW / 2)), HH = Math.max(1, Math.ceil(BH / 2)), HD = D / 2;
    if (bFull.width !== HW || bFull.height !== HH) { bFull.width = HW; bFull.height = HH; }
    if (bAcc.width !== HW || bAcc.height !== HH) { bAcc.width = HW; bAcc.height = HH; }
    var ac = bAcc.getContext('2d'); ac.setTransform(1, 0, 0, 1, 0, 0); ac.globalCompositeOperation = 'source-over'; ac.clearRect(0, 0, HW, HH);
    ac.imageSmoothingEnabled = true; ac.imageSmoothingQuality = 'high';
    // mip 链：levels[k] 是 1/2^(k+1) 尺寸
    var maxK = Math.max(1, Math.min(6, Math.floor(Math.log2(Math.max(2, px * D / 2)))));
    var w = BW, h = BH, cur = buf;
    for (var k = 0; k < maxK; k++) {
      w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2));
      var c = cnv(levels, k, w, h); c.getContext('2d').drawImage(cur, 0, 0, w, h); cur = c;
    }
    var fc = bFull.getContext('2d');
    for (var i = 1; i <= L; i++) {
      var r = px * Math.pow(2, i - L) * D;                  // 这一档的模糊半径（设备像素）
      var src;
      if (useF) {
        // 缩小到让模糊半径约为 2~4 个像素的那一级，再在这一级上做高斯模糊
        var kk = Math.max(0, Math.min(maxK, Math.floor(Math.log2(Math.max(1, r / 2.5)))));
        var base = kk === 0 ? buf : levels[kk - 1], scale = Math.pow(2, kk), pad = Math.ceil(r / scale * 2) + 2;
        var wc = cnv(work, i, base.width + pad * 2, base.height + pad * 2), wx = wc.getContext('2d');
        wx.filter = 'blur(' + (r / scale).toFixed(2) + 'px)';
        wx.drawImage(base, pad, pad); wx.filter = 'none';
        src = wc;
        fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalCompositeOperation = 'source-over'; fc.filter = 'none';
        fc.imageSmoothingEnabled = true; fc.imageSmoothingQuality = 'high'; fc.clearRect(0, 0, HW, HH);
        fc.drawImage(src, pad, pad, base.width, base.height, 0, 0, HW, HH);
      } else {
        // 不支持 ctx.filter 时：退回为 mip 链逐级放大近似模糊
        var steps = Math.max(1, Math.min(maxK, Math.round(Math.log2(Math.max(2, r / 1.6)))));
        src = levels[steps - 1];
        for (var k2 = steps - 2; k2 >= 0; k2--) {
          var u = cnv(work, 10 + k2, levels[k2].width, levels[k2].height); u.getContext('2d').drawImage(src, 0, 0, u.width, u.height); src = u;
        }
        fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalCompositeOperation = 'source-over';
        fc.imageSmoothingEnabled = true; fc.imageSmoothingQuality = 'high'; fc.clearRect(0, 0, HW, HH);
        fc.drawImage(src, 0, 0, HW, HH);
      }
      var lm = levelMask(m, size, soft, i, L);
      fc.setTransform(HD, 0, 0, HD, 0, 0); fc.globalCompositeOperation = 'destination-in';
      fc.fillStyle = maskGradient(fc, '#000000', m, lm[0], Math.max(0.001, lm[1])); fc.fillRect(0, 0, env.W, env.H);
      ac.drawImage(bFull, 0, 0);
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bAcc, 0, 0, BW, BH); ctx.restore();
  }

  function drawMask() {
    var m = p.mask;
    if (!m || m === 'none') return;
    var style = p.maskStyle || 'blur', size = clamp(p.maskSize, 0, 1), soft = Math.max(0.001, clamp(p.maskSoftness, 0, 1));
    blurAvoided(m, size, soft);
    var fade = style === 'blur' ? clamp(p.maskFade == null ? .4 : p.maskFade, 0, 1) : 1;
    if (fade <= 0) return;
    ctx.save();
    if (style !== 'color') ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = fade;
    ctx.fillStyle = maskGradient(ctx, style === 'color' ? (p.maskColor || '#ffffff') : '#000000', m, size, soft); ctx.fillRect(0, 0, env.W, env.H);
    ctx.restore();
  }

  // 图案平移后，缓冲的边缘会露在画布里；把这些边缘淡出，避免出现一刀切的硬边
  function fadeSeams(ox, oy) {
    var W = env.W, H = env.H;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    function band(x0, y0, x1, y1, rx, ry, rw, rh) {
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    }
    var fx = Math.min(W * .45, Math.max(24, Math.abs(ox) * .9 + W * .08));
    var fy = Math.min(H * .45, Math.max(24, Math.abs(oy) * .9 + H * .08));
    if (ox < 0) band(W, 0, W - fx, 0, W - fx, 0, fx, H);
    if (ox > 0) band(0, 0, fx, 0, 0, 0, fx, H);
    if (oy < 0) band(0, H, 0, H - fy, 0, H - fy, W, fy);
    if (oy > 0) band(0, 0, 0, fy, 0, 0, W, fy);
    ctx.restore();
  }

  // 翻转：模版画完后把整张缓冲镜像一次（在内容避让之前，所以避让区不受影响）。
  // 不在模版绘制时套变换，因为有的模版内部会重置变换（比如 WebGL 结果贴回画布）
  var flipC = document.createElement('canvas');
  function flipBuffer() {
    if (flipC.width !== buf.width || flipC.height !== buf.height) { flipC.width = buf.width; flipC.height = buf.height; }
    var f = flipC.getContext('2d'); f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, flipC.width, flipC.height); f.drawImage(buf, 0, 0);
    ctx.save();
    ctx.setTransform(p.flipX ? -1 : 1, 0, 0, p.flipY ? -1 : 1, p.flipX ? buf.width : 0, p.flipY ? buf.height : 0);
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(flipC, 0, 0);
    ctx.restore();
  }

  function frame(dt) {
    env.time += dt;
    ctx.save(); inst.render(dt); ctx.restore();
    if (p.flipX || p.flipY) flipBuffer();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    drawMask();
    var ox = (p.offsetX || 0) / 100 * env.W, oy = (p.offsetY || 0) / 100 * env.H;
    if (ox || oy) fadeSeams(ox, oy);
    out.setTransform(1, 0, 0, 1, 0, 0); out.clearRect(0, 0, canvas.width, canvas.height);
    out.drawImage(buf, Math.round(ox * env.dpr), Math.round(oy * env.dpr));
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    env.dpr = options.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
    env.W = Math.max(1, r.width); env.H = Math.max(1, r.height);
    canvas.width = buf.width = Math.round(env.W * env.dpr); canvas.height = buf.height = Math.round(env.H * env.dpr);
    ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    if (inst.resize) inst.resize();
    if (still()) frame(0);
  }

  function onMove(e) {
    if (!visible || document.hidden || reduce) return;
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    env.pointer.active = px >= 0 && py >= 0 && px <= r.width && py <= r.height;
    // 换算到偏移前的坐标，交互跟着图案走
    env.pointer.x = px - (p.offsetX || 0) / 100 * r.width; env.pointer.y = py - (p.offsetY || 0) / 100 * r.height;
    if (p.flipX) env.pointer.x = r.width - env.pointer.x;          // 图案翻转了，指针也镜像过去
    if (p.flipY) env.pointer.y = r.height - env.pointer.y;
    if (still()) frame(0);
  }
  function onLeave() { env.pointer.active = false; env.pointer.x = env.pointer.y = -9999; }

  var raf = 0, last = performance.now(), ro = null, io = null, visible = true;
  function still() { return reduce || p.animate === false; }
  function loop(now) {
    if (now - last >= 40) {
      var dt = Math.min(now - last, 100); last = now; frame(dt);
    }
    raf = (visible && !still()) ? requestAnimationFrame(loop) : 0;
  }
  // 卡片滚出视口时暂停，页面上放很多张卡片也不会浪费性能
  if (window.IntersectionObserver && !reduce) {
    io = new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf && !still()) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    io.observe(canvas);
  }

  window.addEventListener('pointermove', onMove);
  document.addEventListener('pointerleave', onLeave);
  if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(canvas); }
  else window.addEventListener('resize', resize);
  resize();
  if (!still()) raf = requestAnimationFrame(loop); else frame(0);

  return {
    update: function (next) {
      Object.assign(p, next); if (inst.update) inst.update();
      if (still()) { cancelAnimationFrame(raf); raf = 0; frame(0); }        // 关闭动态效果：停在当前画面
      else if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
    },
    time: function () { return env.time; },
    // 模版是否支持精确循环：true 表示按 env.loop 周期严格重复；'warm' 表示需要先预跑一个周期才进入重复状态
    loop: inst.loop || false,
    // 手动推进一帧（导出视频时逐帧离线渲染用）
    step: function (dt) { frame(dt); },
    destroy: function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      if (inst.destroy) inst.destroy();
    }
  };
};

