/* Static-safe fallback: reveal all content and keep a lightweight network background. */
(function () {
  var root = document.documentElement;
  var media = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.remove('js');
  document.querySelectorAll('.nav,.eyebrow,h1,.ln,.lede,.actions,.scroll,.card,.services,.foot > *').forEach(function (el) {
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
  if ((media && media.matches) || window.gsap) return;
  var canvas = document.getElementById('net');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var page = canvas.parentElement, W = 1536, H = 1024;
  var nodes = { A:[1350,486,5.5], B:[1044,619,5], C:[1124,417,4.6], D:[922,535,4.8], E:[777,538,6], F:[836,654,4], G:[636,698,5], H:[1185,707,9], J:[1391,367,4], K:[1398,698,8], I:[1414,289,9] };
  var edges = [['A','B'],['A','H'],['A','C'],['A','J'],['A',[1536,418]],['A',[1536,512]],['A',[1480,610]],['A','K'],['A',[1250,790]],['B','D'],['B','C'],['B','F'],['B','G'],['B','H'],['B',[1330,760]],['B',[1000,760]],['C','D'],['C',[1062,300]],['C',[1180,300]],['C','J'],['D','E'],['D','F'],['D','G'],['D',[860,430]],['E',[560,470]],['E',[640,610]],['F','G'],['F','H'],['G',[520,742]],['G',[690,760]],['H',[1100,800]],['H',[1290,770]],['J','I'],['J',[1500,330]],['I',[1480,230]]];
  var orbs = [[1358,172,26],[1510,202,30],[967,380,18],[1040,402,11],[835,430,16],[556,489,22],[693,508,17],[313,586,20],[519,654,16],[608,638,13],[220,681,24],[950,918,28],[1030,858,20],[430,730,10],[1296,252,12],[1465,640,14],[880,300,9],[740,770,12]];
  var cw=0,ch=0,dpr=1,scale=1,ox=0,oy=0;
  function pt(p){return typeof p==='string'?nodes[p]:p;}
  function size(){var r=page.getBoundingClientRect();cw=r.width;ch=r.height;dpr=Math.min(window.devicePixelRatio||1,2);if(!cw||!ch)return;canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);scale=Math.max(cw/W,ch/H);if(cw/ch<W/H){ox=cw-W*scale*.78;oy=(ch-H*scale)*.55;}else{ox=(cw-W*scale)/2;oy=(ch-H*scale)/2;}}
  function X(x){return ox+x*scale;} function Y(y){return oy+y*scale;}
  function draw(t){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
    orbs.forEach(function(o,i){var x=X(o[0]+Math.sin(t/5200+i)*3),y=Y(o[1]+Math.cos(t/6100+i*1.7)*3),r=o[2]*scale*1.6,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,190,120,.30)');g.addColorStop(.55,'rgba(255,170,100,.12)');g.addColorStop(1,'rgba(255,170,100,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();});
    ctx.lineWidth=Math.max(.8,scale*.9);
    edges.forEach(function(e){var a=pt(e[0]),b=pt(e[1]),ax=X(a[0]),ay=Y(a[1]),bx=X(b[0]),by=Y(b[1]),far=typeof e[1]!=='string',g=ctx.createLinearGradient(ax,ay,bx,by);g.addColorStop(0,'rgba(214,224,248,.50)');g.addColorStop(far?.7:1,far?'rgba(170,190,235,.14)':'rgba(214,224,248,.40)');if(far)g.addColorStop(1,'rgba(170,190,235,0)');ctx.strokeStyle=g;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();});
    Object.keys(nodes).forEach(function(k){var n=nodes[k],x=X(n[0]),y=Y(n[1]),r=n[2]*scale,g=ctx.createRadialGradient(x,y,0,x,y,r*7);g.addColorStop(0,'rgba(255,224,180,.55)');g.addColorStop(.25,'rgba(255,176,100,.22)');g.addColorStop(1,'rgba(255,160,90,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*7,0,Math.PI*2);ctx.fill();});
  }
  size();draw(0);
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var raf,begin=performance.now();
  function animate(now){draw(now-begin);raf=requestAnimationFrame(animate);}raf=requestAnimationFrame(animate);
  var timer;window.addEventListener('resize',function(){clearTimeout(timer);timer=setTimeout(function(){size();draw(performance.now()-begin);},80);},{passive:true});
  if(window.ResizeObserver)new ResizeObserver(function(){clearTimeout(timer);timer=setTimeout(function(){size();draw(performance.now()-begin);},80);}).observe(page);
}());
