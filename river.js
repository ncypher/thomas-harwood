/* River confluence: two currents (Grand = cyan, Red Cedar = amber) merge into one.
   Drag through the water to stir an eddy. Pauses off-screen; still frame for reduced motion. */
(function(){
  "use strict";
  var cv = document.getElementById("hero-river");
  if (!cv || !cv.getContext) return;
  var hero = cv.parentElement;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var COLORS = ["rgba(78,230,239,0.5)", "rgba(240,165,60,0.5)"];
  var W = 0, H = 0, band = 0, mergeX = 0, parts = [], running = false, visible = true, t = 0;
  var ptr = {x: -9999, y: -9999, power: 0};

  function smooth(a){ a = Math.max(0, Math.min(1, a)); return a*a*(3-2*a); }
  function center(x, river){
    var bh = H - band;
    var merged = band + bh*0.55 + Math.sin(x*0.005 + t*0.0007)*bh*0.07;
    var start = river === 0 ? band + bh*0.08 : H + bh*0.05;
    return start + (merged - start)*smooth(x / mergeX);
  }
  function lane(x){ var bh = H - band; return x < mergeX ? bh*(0.08 - 0.02*smooth(x/mergeX)) : bh*0.1; }
  function spawn(p, anywhere){
    p.river = Math.random() < 0.5 ? 0 : 1;
    p.lane = Math.random()*2 - 1;
    p.speed = 0.8 + Math.random()*1.1;
    p.x = anywhere ? Math.random()*W : -Math.random()*60;
    p.y = center(p.x, p.river) + p.lane*lane(p.x);
    p.px = p.x; p.py = p.y; p.vx = p.speed*1.6; p.vy = 0;
  }
  function size(){
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* the river runs in the space below the hero content */
    var lowest = 0;
    Array.prototype.forEach.call(hero.children, function(el){
      if (el === cv || el.getAttribute("aria-hidden") === "true") return;
      var b = el.getBoundingClientRect().bottom - r.top; if (b > lowest) lowest = b;
    });
    band = Math.min(Math.max(lowest + 16, H*0.45), H - 120);
    mergeX = W*0.5;
    parts = [];
    var n = W < 700 ? 340 : 850;
    for (var i = 0; i < n; i++){ var p = {}; spawn(p, true); parts.push(p); }
    ctx.clearRect(0, 0, W, H);
  }
  function eddy(p, ex, ey, radius, strength){
    var dx = p.x - ex, dy = p.y - ey, d = Math.sqrt(dx*dx + dy*dy);
    if (d < radius && d > 1){
      var f = strength*(1 - d/radius);
      p.vx += (-dy/d)*f - (dx/d)*f*0.15;
      p.vy += ( dx/d)*f - (dy/d)*f*0.15;
    }
  }
  function step(){
    t += 16;
    var bh = H - band;
    for (var i = 0; i < parts.length; i++){
      var p = parts[i];
      p.px = p.x; p.py = p.y;
      var target = center(p.x, p.river) + p.lane*lane(p.x);
      p.vx += (p.speed*1.6 - p.vx)*0.05;
      p.vy += ((target - p.y)*0.035 - p.vy)*0.12;
      eddy(p, mergeX*1.08, band + bh*0.6, bh*0.25, 0.1);
      if (ptr.power > 0.01) eddy(p, ptr.x, ptr.y, 130, 0.9*ptr.power);
      p.x += p.vx; p.y += p.vy;
      if (p.x > W + 20 || p.y < band - 80 || p.y > H + 120 || p.x < -200) spawn(p, false);
    }
    ptr.power *= 0.985;
  }
  function draw(){
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1.3; ctx.lineCap = "round";
    for (var c = 0; c < 2; c++){
      ctx.strokeStyle = COLORS[c]; ctx.beginPath();
      for (var i = 0; i < parts.length; i++){
        var p = parts[i]; if (p.river !== c) continue;
        ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }
  function loop(){ if (!running) return; step(); draw(); requestAnimationFrame(loop); }
  function start(){ if (!running && visible && !reduce && !document.hidden){ running = true; requestAnimationFrame(loop); } }
  function stop(){ running = false; }
  function still(){ for (var k = 0; k < 160; k++){ step(); draw(); } }

  size(); still(); start();
  var rt;
  window.addEventListener("resize", function(){ clearTimeout(rt); rt = setTimeout(function(){ stop(); size(); still(); start(); }, 150); });
  if ("IntersectionObserver" in window){
    new IntersectionObserver(function(es){ visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
  }
  document.addEventListener("visibilitychange", function(){ document.hidden ? stop() : start(); });
  hero.addEventListener("pointermove", function(e){
    var r = cv.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    if (ptr.y > band - 40) ptr.power = 1;
    if (reduce){ for (var k = 0; k < 30; k++){ step(); draw(); } }
  });
})();
