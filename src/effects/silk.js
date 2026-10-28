// Silk ribbon effect from the user-supplied CardScape HTML export.
export const silk = function silk(ctx, env, p) {
  return {
    loop: true,   // 所有动画都通过 env.ph 计算，导出循环视频时能精确回到起点
    render: function () {
      var W = env.W, H = env.H, K = p.speed * .00012, t1 = env.ph(K), t2 = env.ph(K * .7), t3 = env.ph(K * .5), N = Math.max(2, Math.round(p.lines));
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      var ang = p.angle * Math.PI / 180, cos = Math.cos(ang), sin = Math.sin(ang);
      var L = Math.hypot(W, H) * 1.2, cx = W / 2, cy = H / 2 + p.position * H / 2;
      var A = p.amplitude * H * .5, S = p.spread * H * .5, fq = p.frequency * 4 * Math.PI / L;
      var pt = env.pointer, push = p.cursor && pt.active, R = 110;
      // 渐变沿丝带方向铺开
      var g = ctx.createLinearGradient(cx - cos * L / 2, cy - sin * L / 2, cx + cos * L / 2, cy + sin * L / 2);
      var cs = p.colors.length ? p.colors : ['#888888'];
      cs.forEach(function (c, i) { g.addColorStop(cs.length > 1 ? i / (cs.length - 1) : 0, c); });
      ctx.save();
      ctx.globalCompositeOperation = p.blend; ctx.strokeStyle = g; ctx.lineWidth = p.lineWidth; ctx.lineJoin = 'round';
      var step = 7;
      for (var i = 0; i < N; i++) {
        var k = i / (N - 1) - .5, ph = k * p.twist;
        ctx.globalAlpha = p.opacity * (.35 + .65 * (1 - Math.abs(k) * 2));   // 中间的线更亮，边缘渐隐
        ctx.beginPath();
        for (var s = -L / 2, first = true; s <= L / 2 + step; s += step) {
          var e = .35 + .65 * Math.cos(s / L * Math.PI);                  // 两端收窄
          // 主波 × 随相位变化的振幅（线与线交叉，形成扭转）+ 沿丝带缓慢起伏的横向展开
          var off = (Math.sin(s * fq + t1) * A * Math.cos(ph + t2) + k * S * (.4 + .6 * Math.sin(s * fq * .5 - t3 + 1.7))) * e;
          var x = cx + cos * s - sin * off, y = cy + sin * s + cos * off;
          if (push) {
            var dx = x - pt.x, dy = y - pt.y, d = Math.hypot(dx, dy);
            if (d < R && d > .1) { var f = 1 - d / R; f = f * f * 22; x += dx / d * f; y += dy / d * f; }
          }
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  };
};


export const silkConfig = {
  "animate": true,
  "colors": [
    "#a855f7",
    "#ec4899",
    "#f59e0b"
  ],
  "bg": "#f5f5f6",
  "opacity": 0.6,
  "blend": "source-over",
  "lines": 36,
  "amplitude": 0.45,
  "spread": 0.5,
  "twist": 3,
  "angle": -14,
  "position": 0.35,
  "frequency": 1,
  "lineWidth": 0.8,
  "speed": 8,
  "cursor": true,
  "offsetX": 0,
  "offsetY": 0,
  "mask": "corner-br",
  "maskSize": 0.5,
  "maskSoftness": 0.7,
  "maskStyle": "fade",
  "maskBlur": 0,
  "maskBlurRange": 0.35,
  "maskFade": 1,
  "maskColor": "#ffffff",
  "flipX": false,
  "flipY": false
};
