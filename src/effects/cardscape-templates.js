// Effects exported by CardScape (https://cardscape.jony.host/), adapted for service cards.
export const mosaic = function glassMosaic(ctx, env, p) {
  var LAYOUTS = { // x, y, 半径, 颜色序号, 浓度系数
    corner:   [[1, 1.05, .75, 0, 1], [.62, 1.18, .5, 1, .6], [.95, .7, .35, 2, .45], [.08, -.15, .45, 2, .5], [.7, -.2, .3, 1, .4]],
    bottom:   [[.15, 1.1, .6, 0, .9], [.85, 1.1, .6, 1, .8], [.5, 1.25, .5, 2, .6]],
    top:      [[.15, -.1, .6, 0, .9], [.85, -.1, .6, 1, .8], [.5, -.25, .5, 2, .6]],
    center:   [[.5, .5, .5, 0, .9], [.3, .62, .38, 1, .6], [.72, .38, .38, 2, .6]],
    diagonal: [[1, 1, .7, 0, 1], [0, 0, .55, 1, .7], [.5, .5, .3, 2, .35]]
  };
  var sampler = document.createElement('canvas');
  var sctx = sampler.getContext('2d', { willReadFrequently: true });
  var cols = 0, rows = 0, cells = [], tilePath = null, gloss = null, px = null, gridKey = '', spriteKey = '';

  function pickM() {
    var v = p.variance, r = Math.random();
    if (r < 0.18 * v) return 0.15 + Math.random() * 0.3;
    if (r > 1 - 0.15 * v) return 1.15 + Math.random() * 0.35;
    return 1 + (Math.random() - 0.5) * v;
  }
  function newCell() {
    var m = pickM(), j = (Math.random() - 0.5) * 0.3 * p.variance;
    return { a: 0, dir: 0, peak: 0, hold: 0, quick: false, c: 0, m: m, mt: m, j: j, jt: j, h: 0 };
  }
  function buildSprite() {
    var s = p.cellSize, sh = p.cellHeight > 0 ? p.cellHeight : p.cellSize, m = Math.min(s, sh);
    var g = Math.min(p.gap, m * 0.4), rad = Math.max(0, Math.min((m - g) / 2, m * p.radius / 100));
    tilePath = new Path2D(); tilePath.roundRect(g / 2, g / 2, s - g, sh - g, rad);
    var c = document.createElement('canvas'); c.width = Math.ceil(s * env.dpr); c.height = Math.ceil(sh * env.dpr);
    var x = c.getContext('2d'); x.scale(env.dpr, env.dpr);
    var k = p.gloss;
    x.save(); x.clip(tilePath);
    var lg = x.createLinearGradient(0, 0, s * .9, s * .9);
    lg.addColorStop(0, 'rgba(255,255,255,' + .55 * k + ')');
    lg.addColorStop(.35, 'rgba(255,255,255,' + .12 * k + ')');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg; x.fillRect(0, 0, s, sh); x.restore();
    var sg = x.createLinearGradient(0, 0, s, sh);
    sg.addColorStop(0, 'rgba(255,255,255,' + .8 * k + ')');
    sg.addColorStop(.5, 'rgba(255,255,255,' + .15 * k + ')');
    sg.addColorStop(1, 'rgba(255,255,255,' + .35 * k + ')');
    x.strokeStyle = sg; x.lineWidth = 1; x.stroke(tilePath);
    gloss = c;
  }
  function ensure() {
    var cw = p.cellSize, chh = p.cellHeight > 0 ? p.cellHeight : p.cellSize;
    var gk = [cw, chh, env.W, env.H].join();
    if (gk !== gridKey) {
      gridKey = gk;
      cols = Math.ceil(env.W / cw) + 1; rows = Math.ceil(env.H / chh) + 1;
      cells = []; for (var i = 0; i < cols * rows; i++) cells.push(newCell());
      sampler.width = cols; sampler.height = rows; px = null;
    }
    var sk = [cw, chh, p.gap, p.radius, p.gloss, env.dpr].join();
    if (sk !== spriteKey) { spriteKey = sk; buildSprite(); }
  }
  function paint(c, w, h, sf) {
    c.fillStyle = p.bg; c.fillRect(0, 0, w, h);
    var L = LAYOUTS[p.layout] || LAYOUTS.corner, M = Math.max(w, h);
    for (var i = 0; i < L.length; i++) {
      var b = L[i], col = p.colors[b[3] % p.colors.length], a = Math.min(1, p.intensity * b[4]);
      var ph = i * 1.7, sp = (0.00009 + i * 0.00001) * sf;   // sf 是速度系数；相位用 env.ph 算，循环视频能精确回到起点
      var cx = (b[0] + Math.sin(env.ph(sp) + ph) * .07) * w, cy = (b[1] + Math.cos(env.ph(sp * .8) + ph) * .05) * h;
      var r = b[2] * M * (1 + Math.sin(env.ph(sp * 1.3) + ph) * .07);
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, env.rgba(col, a)); g.addColorStop(.35, env.rgba(col, a * .6));
      g.addColorStop(.7, env.rgba(col, a * .18)); g.addColorStop(1, env.rgba(col, 0));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  }
  function intensityAt(k) {
    if (!px) return 0;
    var B = env.rgb(p.bg), lb = (B[0] + B[1] + B[2]) / 3, l = (px[k * 4] + px[k * 4 + 1] + px[k * 4 + 2]) / 3;
    return Math.min(1, Math.abs(lb - l) / 55);
  }
  function ignite(idx, quick) {
    if (idx === undefined) { // 取 3 个候选，挑颜色最浓的，闪烁自然集中在有颜色的地方
      var best = -1, bi = 0;
      for (var n = 0; n < 3; n++) { var k = (Math.random() * cells.length) | 0, v = intensityAt(k) + Math.random() * .15; if (v > best) { best = v; bi = k; } }
      idx = bi;
    }
    var c = cells[idx]; if (!c || c.dir !== 0) return;
    c.dir = 1; c.quick = !!quick; c.c = (Math.random() * p.colors.length) | 0;
    c.peak = quick ? .35 + Math.random() * .5 : .35 + Math.random() * .55;
  }

  // 循环视频：闪烁不再随机触发，而是按周期预先排好一张事件表（固定种子），
  // 每个事件在周期内的时刻、格子、颜色、亮度都固定；超过周期长度的事件按周期绕回，首尾无缝
  var sched = null, schedKey = '';
  function buildSchedule() {
    var L = env.loop, sp = p.speed; sched = [];
    schedKey = [L, cells.length, p.activity, p.speed, p.colors.length].join();
    if (!(sp > 0) || !(p.activity > 0)) return;
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var rate = sp * 6e-5, hk = .06 * sp / 10;                                  // 和平时一致：亮起 / 熄灭速度、停留时长
    var avg = .63 / rate + 80 / hk + .63 / (rate * .7), n = Math.max(1, Math.round(p.activity * L / avg));
    for (var i = 0; i < n; i++) {
      var best = -1, bi = 0;
      for (var k = 0; k < 3; k++) { var c = (rnd() * cells.length) | 0, v = intensityAt(c) + rnd() * .15; if (v > best) { best = v; bi = c; } }
      var peak = .35 + rnd() * .55, rise = peak / rate, hold = (40 + rnd() * 80) / hk, fall = peak / (rate * .7);
      sched.push({ k: bi, c: (rnd() * p.colors.length) | 0, start: rnd() * L, peak: peak, rise: rise, hold: hold, fall: fall, dur: rise + hold + fall });
    }
  }
  function applySchedule() {
    var L = env.loop, i, e, tau, a, c;
    for (i = 0; i < cells.length; i++) cells[i].a = 0;
    for (i = 0; i < sched.length; i++) {
      e = sched[i]; c = cells[e.k]; if (!c) continue;
      for (tau = (((env.time - e.start) % L) + L) % L; tau < e.dur; tau += L) {
        a = tau < e.rise ? e.peak * tau / e.rise : tau < e.rise + e.hold ? e.peak : e.peak * (1 - (tau - e.rise - e.hold) / e.fall);
        if (a > c.a) { c.a = a; c.c = e.c; }
      }
    }
  }

  return {
    loop: true,   // 背景光斑用 env.ph 计算，闪烁按周期事件表，导出循环视频时能精确回到起点
    resize: ensure,
    update: ensure,
    render: function (dt) {
      ensure();
      var W = env.W, H = env.H, s = p.cellSize, sh = p.cellHeight > 0 ? p.cellHeight : p.cellSize, sf = p.speed / 10;
      var offX = (W % s) / 2 - s / 2, offY = (H % sh) / 2 - sh / 2;
      // 只铺纯底色：渐变完全由每个格子的采样色组成，缝隙露出的是底色
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      // 先按原始坐标整张铺满底色：缩放平移后的 fillRect 边缘差半个像素盖不住，会残留上一帧的颜色
      sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.fillStyle = p.bg; sctx.fillRect(0, 0, cols, rows);
      sctx.setTransform(1 / s, 0, 0, 1 / sh, -offX / s, -offY / sh); paint(sctx, W, H, sf);
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      px = sctx.getImageData(0, 0, cols, rows).data;

      var step = (p.speed / 1000) * dt * .06, f = dt * .06 * sf, active = 0, loopMode = !!env.loop;
      if (loopMode) {
        if (!sched || schedKey !== [env.loop, cells.length, p.activity, p.speed, p.colors.length].join()) buildSchedule();
        applySchedule();
      }
      for (var i = 0; i < cells.length; i++) if (cells[i].dir !== 0) active++;
      if (!loopMode && active < p.activity && Math.random() < .15) ignite();
      var pt = env.pointer;
      var cr = Math.max(4.5, 260 / Math.min(s, sh)), tries = Math.max(1, Math.round(68 / Math.min(s, sh) * .6));
      for (var tr = 0; tr < tries; tr++) if (p.cursor && pt.active && Math.random() < .045 * dt * .06) {
        var ang = Math.random() * Math.PI * 2, dist = Math.sqrt(Math.random()) * cr;
        var q0 = Math.floor((pt.x - offX) / s + Math.cos(ang) * dist), r0 = Math.floor((pt.y - offY) / sh + Math.sin(ang) * dist);
        if (q0 >= 0 && r0 >= 0 && q0 < cols && r0 < rows) ignite(r0 * cols + q0, true);
      }
      var hc = pt.active ? Math.floor((pt.x - offX) / s) : -1, hr = pt.active ? Math.floor((pt.y - offY) / sh) : -1;
      var B = env.rgb(p.bg), ease = 1 - Math.pow(.98, Math.max(f, .01));
      for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) {
        var k = r * cols + q, c = cells[k];
        if (!loopMode) {                                    // 循环视频模式下深浅固定，亮度由事件表决定
        if (Math.random() < .006 * f) { c.mt = pickM(); c.jt = (Math.random() - .5) * .3 * p.variance; }
        c.m += (c.mt - c.m) * ease; c.j += (c.jt - c.j) * ease;
        if (c.dir === 1) { c.a += step * (c.quick ? 1.6 : 1); if (c.a >= c.peak) { c.a = c.peak; c.dir = -1; c.hold = c.quick ? 15 + Math.random() * 40 : 40 + Math.random() * 80; } }
        else if (c.dir === -1) { if (c.hold > 0) c.hold -= f; else { c.a -= step * (c.quick ? 1.1 : .7); if (c.a <= 0) { c.a = 0; c.dir = 0; c.quick = false; } } }
        }
        c.h += (((q === hc && r === hr) ? 1 : 0) - c.h) * .1;

        var R = env.clamp(B[0] + (px[k * 4] - B[0]) * c.m, 0, 255) | 0;
        var G = env.clamp(B[1] + (px[k * 4 + 1] - B[1]) * c.m, 0, 255) | 0;
        var Bl = env.clamp(B[2] + (px[k * 4 + 2] - B[2]) * c.m, 0, 255) | 0;
        var inten = Math.min(1, Math.abs((B[0] + B[1] + B[2]) / 3 - (R + G + Bl) / 3) / 55), vis = .12 + inten * .88;
        ctx.save(); ctx.translate(offX + q * s, offY + r * sh);
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgb(' + R + ',' + G + ',' + Bl + ')'; ctx.fill(tilePath);
        ctx.globalAlpha = Math.abs(c.j) * vis; ctx.fillStyle = c.j > 0 ? '#fff' : 'rgb(40,20,80)'; ctx.fill(tilePath);
        var lit = c.a + c.h * .25;
        if (lit > .01) {
          ctx.globalAlpha = Math.min(.55, lit * (.3 + inten * .25)); ctx.fillStyle = p.colors[c.c % p.colors.length]; ctx.fill(tilePath);
          ctx.globalAlpha = lit * .25; ctx.fillStyle = '#fff'; ctx.fill(tilePath);
        }
        ctx.globalAlpha = .08 + inten * .72; ctx.drawImage(gloss, 0, 0, s, sh);
        ctx.restore();
      }
    }
  };
};


export const gradient = function aurora(ctx, env, p) {
  var off = document.createElement('canvas'), o = off.getContext('2d');
  var blobs = [], countKey = -1, SCALE = 8;
  function build() {
    countKey = p.count; blobs = [];
    for (var i = 0; i < p.count; i++) blobs.push({
      bx: Math.random(), by: Math.random(), ph: Math.random() * 6.28, ph2: Math.random() * 6.28,
      sx: .6 + Math.random() * .8, sy: .6 + Math.random() * .8, fx: 0, fy: 0
    });
  }
  function resize() { off.width = Math.max(2, Math.ceil(env.W / SCALE)); off.height = Math.max(2, Math.ceil(env.H / SCALE)); }
  build();
  return {
    loop: true,   // 所有动画都通过 env.ph 计算，导出循环视频时能精确回到起点
    resize: resize,
    update: function () { if (p.count !== countKey) build(); },
    render: function () {
      var w = off.width, h = off.height, K = p.speed * .00005, M = Math.max(w, h), pt = env.pointer;
      o.globalCompositeOperation = 'source-over'; o.fillStyle = p.bg; o.fillRect(0, 0, w, h);
      o.globalCompositeOperation = p.blend;
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var x = (b.bx + Math.sin(env.ph(K * b.sx) + b.ph) * .35) * w, y = (b.by + Math.cos(env.ph(K * b.sy) + b.ph2) * .3) * h;
        var tx = 0, ty = 0;
        if (pt.active && p.follow > 0 && i < 2) { tx = (pt.x / SCALE - x) * p.follow * (i ? .4 : .8); ty = (pt.y / SCALE - y) * p.follow * (i ? .4 : .8); }
        b.fx += (tx - b.fx) * .04; b.fy += (ty - b.fy) * .04; x += b.fx; y += b.fy;
        var r = p.size * M * (.8 + .2 * Math.sin(env.ph(K * 1.7) + b.ph));
        var col = p.colors[i % p.colors.length], g = o.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, env.rgba(col, p.intensity)); g.addColorStop(.5, env.rgba(col, p.intensity * .45)); g.addColorStop(1, env.rgba(col, 0));
        o.fillStyle = g; o.fillRect(0, 0, w, h);
      }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, env.W, env.H);
    }
  };
};


export const network = function constellation(ctx, env, p) {
  var pts = [], W0 = 0, H0 = 0;
  function sync() {
    var W = env.W, H = env.H, n = Math.max(6, Math.min(420, Math.round(W * H / 10000 * p.density)));
    // 尺寸变化时按比例搬动已有节点，数量变化时只增减，避免整体重新随机导致画面跳变
    if (W0 && (W0 !== W || H0 !== H)) pts.forEach(function (q) { q.x *= W / W0; q.y *= H / H0; q.hx *= W / W0; q.hy *= H / H0; });
    W0 = W; H0 = H;
    while (pts.length < n) {
      var a = Math.random() * 6.2832, s = .4 + Math.random() * .6, x0 = Math.random() * W, y0 = Math.random() * H;
      pts.push({ x: x0, y: y0, hx: x0, hy: y0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: .6 + Math.random() * .8, ph: Math.random() * 6.2832 });
    }
    pts.length = n;
  }
  return {
    loop: true,   // 所有动画都通过 env.ph 计算（或按周期绕圈），导出循环视频时能精确回到起点
    resize: sync, update: sync,
    render: function (dt) {
      sync();
      var W = env.W, H = env.H, pt = env.pointer, sp = p.speed * .004 * dt;
      var cur = p.cursor && pt.active, R = p.cursorRadius, D = p.linkDistance, D2 = D * D;
      var cols = (p.colors.length ? p.colors : ['#888888']).map(function (c) { return env.rgb(c).join(','); }), nc = cols.length;
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);

      // 移动：匀速漂移，出界后从对边绕回（留出连线距离的余量，边缘的线不会突然消失）
      // 导出循环视频时：每个点绕自己出生位置附近的一个小圆漂移（速度和平时一样），周期结束正好转回原处
      var i, j, q, dx, dy, d, L = env.loop, TAU = 6.283185307179586, R0 = p.speed * .004 * L / TAU, SW = W + 2 * D, SH = H + 2 * D;
      for (i = 0; i < pts.length; i++) {
        q = pts[i];
        if (L) {
          var th = TAU * env.time / L + q.ph;
          q.x = q.hx + R0 * (q.vx * Math.sin(th) + q.vy * Math.cos(th)); q.y = q.hy + R0 * (q.vy * Math.sin(th) - q.vx * Math.cos(th));
          q.x = ((q.x + D) % SW + SW) % SW - D; q.y = ((q.y + D) % SH + SH) % SH - D;
          continue;
        }
        q.x += q.vx * sp; q.y += q.vy * sp;
        if (cur && dt) {
          dx = pt.x - q.x; dy = pt.y - q.y; d = Math.hypot(dx, dy);
          if (d < R && d > 1) { var f = (1 - d / R) * p.pull * .6 * dt / 16; q.x += dx / d * f; q.y += dy / d * f; }
        }
        if (q.x < -D) q.x += W + 2 * D; else if (q.x > W + D) q.x -= W + 2 * D;
        if (q.y < -D) q.y += H + 2 * D; else if (q.y > H + D) q.y -= H + 2 * D;
      }

      // 连线：按颜色和透明度分桶，每桶只描一次，几百个点也不卡
      var LV = 6, paths = [];
      for (i = 0; i < nc * LV; i++) paths.push([]);
      for (i = 0; i < pts.length; i++) {
        var a = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          var b = pts[j]; dx = a.x - b.x; dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < D2) paths[(i % nc) * LV + Math.min(LV - 1, ((1 - Math.sqrt(d2) / D) * LV) | 0)].push(a.x, a.y, b.x, b.y);
        }
      }
      ctx.lineWidth = p.lineWidth; ctx.lineCap = 'round';
      for (i = 0; i < paths.length; i++) {
        var arr = paths[i]; if (!arr.length) continue;
        ctx.strokeStyle = 'rgba(' + cols[(i / LV) | 0] + ',' + ((i % LV + 1) / LV * p.lineOpacity) + ')';
        ctx.beginPath();
        for (j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); }
        ctx.stroke();
      }

      // 光标连线：光标本身像一个节点，和范围内的点连起来
      if (cur) {
        for (i = 0; i < pts.length; i++) {
          q = pts[i]; d = Math.hypot(q.x - pt.x, q.y - pt.y);
          if (d >= R) continue;
          ctx.strokeStyle = 'rgba(' + cols[i % nc] + ',' + Math.min(1, (1 - d / R) * p.lineOpacity * 1.6) + ')';
          ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }

      // 节点：一圈柔光 + 实心点，轻微闪烁；光标附近的点稍微放大
      for (i = 0; i < pts.length; i++) {
        q = pts[i];
        var s = p.nodeSize * q.r * (1 + p.twinkle * .5 * Math.sin(env.ph(.002) + q.ph));
        if (cur) { d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < R) s *= 1 + (1 - d / R) * .8; }
        if (p.glow > 0) {
          ctx.fillStyle = 'rgba(' + cols[i % nc] + ',' + (.14 * p.glow) + ')';
          ctx.beginPath(); ctx.arc(q.x, q.y, s * 3.5, 0, 6.2832); ctx.fill();
        }
        ctx.fillStyle = 'rgba(' + cols[i % nc] + ',.9)';
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(.3, s), 0, 6.2832); ctx.fill();
      }
    }
  };
};


export const contour = function topography(ctx, env, p) {
  var field = null;
  function hash(i, j) { var s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {                                   // 平滑插值的值噪声，输出 0–1
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return {
    loop: true,   // 所有动画都通过 env.ph 计算（或按周期绕圈），导出循环视频时能精确回到起点
    render: function () {
      var W = env.W, H = env.H, cs = Math.max(3, p.resolution), cols = Math.ceil(W / cs) + 1, rows = Math.ceil(H / cs) + 1;
      if (!field || field.length < cols * rows) field = new Float32Array(cols * rows);
      var t = env.time * p.speed * .00002, f = p.scale / 160, pt = env.pointer, bump = p.cursor && pt.active, R2 = p.cursorRadius * p.cursorRadius;
      var q, r, x, y;
      // 两层噪声的平移量。平时沿直线一直漂；导出循环视频时改成在噪声空间里沿圆绕一圈（速度不变），
      // 周期结束时正好回到原位。两层绕圈方向相反，和平时"朝相反方向漂移"的观感一致
      var ax = t, ay = -t * .6, bx = -t * .8, by = t, L = env.loop;
      if (L) {
        var th = 6.283185307179586 * env.time / L, rr = p.speed * .00002 * L / 6.283185307179586;
        ax = rr * 1.17 * Math.cos(th); ay = rr * 1.17 * Math.sin(th); bx = rr * 1.28 * Math.cos(-th + 2); by = rr * 1.28 * Math.sin(-th + 2);
      }
      // 高度场：两层噪声朝相反方向漂移，形状会持续缓慢变化；光标处加一个高斯隆起
      for (r = 0; r < rows; r++) for (q = 0; q < cols; q++) {
        x = q * cs; y = r * cs;
        var v = noise(x * f + ax, y * f + ay) * .65 + noise(x * f * 2.1 + bx + 5.2, y * f * 2.1 + by + 1.3) * .35;
        if (bump) { var dx = x - pt.x, dy = y - pt.y; v += Math.exp(-(dx * dx + dy * dy) / R2) * .25; }
        field[r * cols + q] = v;
      }
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      var n = Math.max(2, Math.round(p.lines)), stops = (p.colors.length ? p.colors : ['#888888']).map(env.rgb);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (var k = 0; k < n; k++) {
        // 高度大多落在 0.2–0.95，等高线均匀铺在这一段，每条都切得到地形
        var lvl = .2 + (k + .5) / n * .75, pos = k / (n - 1) * (stops.length - 1), si = Math.min(stops.length - 2, Math.floor(pos)), mix = pos - Math.max(0, si);
        var A = stops[Math.max(0, si)], B = stops[Math.min(stops.length - 1, si + 1)];
        var major = p.major && k % 5 === 4;
        ctx.strokeStyle = 'rgba(' + [0, 1, 2].map(function (c) { return Math.round(A[c] + (B[c] - A[c]) * mix); }).join(',') + ',' + Math.min(1, p.opacity * (major ? 1.3 : 1)) + ')';
        ctx.lineWidth = p.lineWidth * (major ? 2 : 1);
        ctx.beginPath();
        // marching squares：每个格子四个角和当前高度比较，得到 16 种情况之一，查表连出线段
        for (r = 0; r < rows - 1; r++) for (q = 0; q < cols - 1; q++) {
          var o = r * cols + q, a = field[o], b = field[o + 1], c = field[o + cols + 1], d = field[o + cols];
          var idx = (a > lvl ? 8 : 0) | (b > lvl ? 4 : 0) | (c > lvl ? 2 : 0) | (d > lvl ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          var x0 = q * cs, y0 = r * cs, x1 = x0 + cs, y1 = y0 + cs;
          var T = [x0 + cs * (lvl - a) / (b - a), y0], Rt = [x1, y0 + cs * (lvl - b) / (c - b)];
          var Bt = [x0 + cs * (lvl - d) / (c - d), y1], L = [x0, y0 + cs * (lvl - a) / (d - a)];
          var segs = idx === 1 || idx === 14 ? [L, Bt] : idx === 2 || idx === 13 ? [Bt, Rt] : idx === 3 || idx === 12 ? [L, Rt]
            : idx === 4 || idx === 11 ? [T, Rt] : idx === 6 || idx === 9 ? [T, Bt] : idx === 7 || idx === 8 ? [T, L]
            : idx === 5 ? [T, Rt, L, Bt] : [T, L, Bt, Rt];   // 5 / 10 是鞍点，连两段
          for (var s = 0; s < segs.length; s += 2) { ctx.moveTo(segs[s][0], segs[s][1]); ctx.lineTo(segs[s + 1][0], segs[s + 1][1]); }
        }
        ctx.stroke();
      }
    }
  };
};



export const configurations = {
  "mosaic": {
    "animate": true,
    "colors": [
      "#b9db7b",
      "#7eaa66",
      "#dfedab"
    ],
    "bg": "#111111",
    "intensity": 0.6,
    "layout": "corner",
    "cellSize": 18,
    "cellHeight": 0,
    "gap": 1.5,
    "radius": 14,
    "gloss": 0.7,
    "variance": 0.7,
    "activity": 70,
    "speed": 10,
    "cursor": true,
    "offsetX": 0,
    "offsetY": 0,
    "mask": "corner-br",
    "maskSize": 0.48,
    "maskSoftness": 0.7,
    "maskStyle": "fade",
    "maskBlur": 0,
    "maskBlurRange": 0.35,
    "maskFade": 1,
    "maskColor": "#ffffff",
    "flipX": false,
    "flipY": false
  },
  "gradient": {
    "animate": true,
    "colors": [
      "#cbbbed",
      "#b7d4ef",
      "#e0c8eb",
      "#b8dfd7"
    ],
    "bg": "#f5f5f6",
    "intensity": 0.72,
    "blend": "source-over",
    "count": 5,
    "size": 0.55,
    "speed": 9,
    "follow": 0.3,
    "offsetX": 0,
    "offsetY": 0,
    "mask": "corner-br",
    "maskSize": 0.48,
    "maskSoftness": 0.7,
    "maskStyle": "fade",
    "maskBlur": 0,
    "maskBlurRange": 0.35,
    "maskFade": 1,
    "maskColor": "#ffffff",
    "flipX": false,
    "flipY": false
  },
  "network": {
    "animate": true,
    "colors": [
      "#6f81a0",
      "#a092c2",
      "#79a9a0"
    ],
    "bg": "#f5f5f6",
    "lineOpacity": 0.4,
    "density": 5,
    "linkDistance": 120,
    "nodeSize": 2.2,
    "lineWidth": 0.8,
    "glow": 0.3,
    "speed": 8,
    "twinkle": 0.4,
    "cursor": true,
    "cursorRadius": 150,
    "pull": 0.3,
    "offsetX": 0,
    "offsetY": 0,
    "mask": "corner-br",
    "maskSize": 0.48,
    "maskSoftness": 0.7,
    "maskStyle": "fade",
    "maskBlur": 0,
    "maskBlurRange": 0.35,
    "maskFade": 1,
    "maskColor": "#ffffff",
    "flipX": false,
    "flipY": false
  },
  "contour": {
    "animate": true,
    "colors": [
      "#b1bcaa",
      "#83957a"
    ],
    "bg": "#f5f5f6",
    "opacity": 0.6,
    "lines": 14,
    "lineWidth": 1,
    "scale": 1,
    "major": true,
    "resolution": 8,
    "speed": 6,
    "cursor": true,
    "cursorRadius": 90,
    "offsetX": 0,
    "offsetY": 0,
    "mask": "corner-br",
    "maskSize": 0.48,
    "maskSoftness": 0.7,
    "maskStyle": "fade",
    "maskBlur": 0,
    "maskBlurRange": 0.35,
    "maskFade": 1,
    "maskColor": "#ffffff",
    "flipX": false,
    "flipY": false
  }
};
