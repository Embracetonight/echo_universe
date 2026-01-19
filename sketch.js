/**
 * Echo Universe - V0.3 (Mobile & Desktop Unified)
 * 包含：星系、呼吸感、时光机、玻璃面板、多模态记忆、本地存档
 */

let stars = [];
let bgStars = [];
let sectors = ["家庭", "职场", "朋友", "兴趣"];
let colors = ["#FF6B6B", "#4D96FF", "#6BCB77", "#FFD93D"];

let isPanelOpen = false;
let selectedStarId = null;

// 时光机
let timeSlider;
let timeLabel;
let minDate, maxDate;
let currentViewDate;

const STORAGE_KEY = "echo_universe_final_v3";

function setup() {
  createCanvas(windowWidth, windowHeight);

  initPanelStyles();
  createMemoryPanelUI();
  createTimeSliderUI();

  loadStarsFromLocalStorage();
  updateTimeBounds();

  // 背景星尘
  for (let i = 0; i < 150; i++) {
    bgStars.push({
      x: random(width),
      y: random(height),
      size: random(0.5, 2),
      alpha: random(30, 120),
      speed: random(0.05, 0.2)
    });
  }
}

function draw() {
  background(10, 10, 20);

  // 1. 绘制背景星尘
  noStroke();
  for (let b of bgStars) {
    fill(255, b.alpha);
    ellipse(b.x, b.y, b.size);
    b.y -= b.speed;
    if (b.y < 0) b.y = height;
  }

  drawSectors();
  drawMe();
  updateCurrentViewDate();

  // 2. 绘制星星
  for (let s of stars) {
    if (s.createdAt > currentViewDate) continue;
    if (isPanelOpen) {
      s.angle += s.orbitSpeed * 0.1;
    } else {
      s.update();
    }
    s.display();
  }

  // 3. 打捞准星
  let isAtPresent = (timeSlider.value() >= 100);
  let isInputActive = mouseIsPressed || (touches.length > 0);
  if (!isPanelOpen && isInputActive && isAtPresent && mouseY < height - 80) {
    drawFishingUI();
  }
}

// ==========================================
//   交互逻辑 (统一鼠标与触摸)
// ==========================================

function handleInputStart(x, y) {
  // 如果面板是开着的，canvas 层面的所有点击直接拦截
  if (isPanelOpen) return;
  if (y > height - 80) return;

  // 手机端判定范围调大到 35
  const hit = getStarAt(x, y, 35);
  if (hit && hit.createdAt <= currentViewDate) {
    openPanel(hit);
  }
}

function handleInputEnd(x, y) {
  if (isPanelOpen) return;
  if (y > height - 80) return;

  let isAtPresent = (timeSlider.value() >= 100);
  if (!isAtPresent) return;

  const hit = getStarAt(x, y, 35);
  if (hit) return;

  let d = dist(x, y, width / 2, height / 2);
  if (d <= 35) return;

  let radius = constrain(d, 50, width / 2);
  let ang = atan2(y - height / 2, x - width / 2);
  if (ang < 0) ang += TWO_PI;
  let sectorIndex = floor(map(ang, 0, TWO_PI, 0, sectors.length));
  
  // 手机上 prompt 依然是最简单有效的方式
  setTimeout(() => {
    let name = prompt("这颗星星叫什么名字？", "");
    if (name) {
      const star = new Star({
        id: cryptoRandomId(),
        name: name,
        sectorIndex: sectorIndex,
        targetR: radius,
        angle: ang,
        orbitSpeed: random(0.002, 0.005) * (random() > 0.5 ? 1 : -1),
        size: random(5, 8),
        memories: [],
        createdAt: Date.now()
      });
      stars.push(star);
      updateTimeBounds();
      saveStarsToLocalStorage();
    }
  }, 100);
}

// p5 事件监听
function mousePressed() { handleInputStart(mouseX, mouseY); return false; }
function mouseReleased() { handleInputEnd(mouseX, mouseY); return false; }
function touchStarted() {
  // 如果点在了面板上，直接返回，不执行 handleInputStart
  // 这样就不会干扰输入框获取焦点
  if (isPanelOpen) return; 

  if (touches.length > 0) {
    handleInputStart(touches[0].x, touches[0].y);
  }
  return false; 
}
function touchEnded() { handleInputEnd(mouseX, mouseY); return false; }

function getStarAt(x, y, threshold) {
  for (let i = stars.length - 1; i >= 0; i--) {
    let p = stars[i].getPos();
    if (dist(x, y, p.x, p.y) < threshold) return stars[i];
  }
  return null;
}

// ==========================================
//   核心类：Star
// ==========================================

class Star {
  constructor({ id, name, sectorIndex, targetR, angle, orbitSpeed, size, memories, createdAt }) {
    this.id = id;
    this.name = name;
    this.sectorIndex = sectorIndex;
    this.targetR = targetR;
    this.currentR = targetR;
    this.angle = angle;
    this.orbitSpeed = orbitSpeed;
    this.size = size;
    this.memories = memories || [];
    this.createdAt = createdAt || Date.now();
  }

  get color() { return colors[this.sectorIndex]; }

  update() {
    this.currentR = lerp(this.currentR, this.targetR, 0.05);
    this.angle += this.orbitSpeed;
  }

  getPos() {
    let x = cos(this.angle) * this.currentR + width / 2;
    let y = sin(this.angle) * this.currentR + height / 2;
    return { x, y };
  }

  display() {
    push();
    translate(width / 2, height / 2);
    let x = cos(this.angle) * this.currentR;
    let y = sin(this.angle) * this.currentR;

    // 轨道
    noFill(); stroke(red(this.color), green(this.color), blue(this.color), 20);
    ellipse(0, 0, this.targetR * 2);

    // 呼吸效果
    let breath = sin(frameCount * 0.05 + (this.id.charCodeAt(0)||0)) * 2;
    let currentSize = this.size + breath;

    // 绘制
    fill(this.color); noStroke();
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = this.color;
    ellipse(x, y, currentSize);
    
    // 选中光圈
    if (this.id === selectedStarId) {
      noFill(); stroke(255); strokeWeight(2);
      ellipse(x, y, currentSize + 10);
    }
    pop();
  }
}

// ==========================================
//   面板与 UI 逻辑 (关键适配)
// ==========================================

function createMemoryPanelUI() {
  const backdrop = createDiv("");
  backdrop.id("backdrop");
  backdrop.hide();
  
  // 遮罩点击关闭
  backdrop.elt.onclick = (e) => {
    closePanel();
  };

  const panel = createDiv(`
    <div id="panel-header">
      <h2 id="panel-title">星星</h2>
      <span id="panel-sector" class="tag">扇区</span>
    </div>
    <div id="memory-list"></div>
    <div id="panel-input-area">
      <textarea id="memory-input" placeholder="输入记忆..."></textarea>
      <button id="save-btn">记录</button>
    </div>
    <button id="close-btn">×</button>
  `);
  panel.id("memory-panel");
  panel.hide();

  // 关键修复：阻止面板上的所有触摸事件传给下面的 Canvas
  panel.elt.ontouchstart = (e) => e.stopPropagation();
  panel.elt.ontouchend = (e) => e.stopPropagation();
  panel.elt.onclick = (e) => e.stopPropagation();

  // 绑定原生按钮事件
  document.getElementById('save-btn').onclick = (e) => {
    e.stopPropagation();
    saveNewMemory();
  };

  document.getElementById('close-btn').onclick = (e) => {
    e.stopPropagation();
    closePanel();
  };
}

function openPanel(star) {
  isPanelOpen = true;
  selectedStarId = star.id;
  
  // 核心修复：当面板打开时，让 Canvas 彻底“隐身”，不再接收任何点击
  select('canvas').style('pointer-events', 'none'); 

  select("#panel-title").html(star.name);
  select("#panel-sector").html(sectors[star.sectorIndex]);
  const list = select("#memory-list"); list.html("");
  (star.memories || []).forEach(mem => addMemoryToDOM(mem));
  
  select("#backdrop").show();
  select("#memory-panel").style("display", "flex");
}

function closePanel() {
  isPanelOpen = false;
  selectedStarId = null;

  // 核心修复：面板关闭，Canvas 恢复交互
  select('canvas').style('pointer-events', 'auto'); 

  select("#memory-panel").hide();
  select("#backdrop").hide();
}

function saveNewMemory() {
  const star = stars.find(s => s.id === selectedStarId);
  if (!star) return;
  const ta = document.getElementById("memory-input");
  const text = ta.value.trim();
  if (!text) return;
  const mem = { date: new Date().toLocaleString(), content: text };
  star.memories.push(mem);
  addMemoryToDOM(mem);
  ta.value = "";
  saveStarsToLocalStorage();
}

function addMemoryToDOM(mem) {
  const list = select("#memory-list");
  const item = createDiv(`<div class="memory-date">${mem.date}</div><div class="memory-content">${mem.content}</div>`);
  item.addClass("memory-item");
  item.parent(list);
  list.elt.scrollTop = list.elt.scrollHeight;
}

// ==========================================
//   时光机与存储
// ==========================================

function createTimeSliderUI() {
  timeSlider = createSlider(0, 100, 100);
  timeSlider.position(40, height - 60);
  timeSlider.style('width', (width - 80) + 'px');
  timeSlider.addClass('time-slider');
  timeLabel = createDiv("现在");
  timeLabel.position(width/2, height - 90);
  timeLabel.id('time-label');
}

function updateTimeBounds() {
  if (stars.length === 0) { minDate = Date.now(); maxDate = Date.now(); }
  else { minDate = min(stars.map(s => s.createdAt)) - 86400000; maxDate = Date.now(); }
}

function updateCurrentViewDate() {
  maxDate = Date.now();
  currentViewDate = map(timeSlider.value(), 0, 100, minDate, maxDate);
  let d = new Date(currentViewDate);
  timeLabel.html(timeSlider.value() >= 100 ? "现在" : `回溯: ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`);
  timeLabel.style('color', timeSlider.value() >= 100 ? '#4D96FF' : '#FF6B6B');
}

function saveStarsToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
}

function loadStarsFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    stars = data.map(s => new Star(s));
  }
}

function initPanelStyles() {
  const css = `
    #backdrop { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; }
    #memory-panel { display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:90%; max-width:350px; height:70%; background:rgba(25,25,35,0.95); backdrop-filter:blur(15px); border-radius:20px; color:#fff; font-family:sans-serif; z-index:1001; flex-direction:column; overflow:hidden; border:1px solid rgba(255,255,255,0.1); }
    #panel-header { padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); }
    #memory-list { flex:1; overflow-y:auto; padding:20px; }
    #panel-input-area { padding:15px; background:rgba(0,0,0,0.3); display:flex; gap:10px; }
    #memory-input { flex:1; height:45px; background:rgba(255,255,255,0.1); border:none; border-radius:10px; color:#fff; padding:10px; }
    #save-btn { background:#4D96FF; border:none; border-radius:10px; padding:0 15px; color:#fff; }
    #close-btn { position:absolute; top:10px; right:10px; width:44px; height:44px; background:rgba(255,255,255,0.1); border:none; border-radius:22px; color:#fff; font-size:24px; }
    .memory-item { margin-bottom:15px; border-left:2px solid #FFCC00; padding-left:10px; }
    .memory-date { font-size:10px; color:#888; }
    .tag { font-size:11px; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:5px; }
    input[type=range].time-slider { -webkit-appearance:none; width:100%; background:transparent; }
    input[type=range].time-slider::-webkit-slider-thumb { -webkit-appearance:none; height:20px; width:20px; border-radius:50%; background:#4D96FF; cursor:pointer; margin-top:-8px; }
    input[type=range].time-slider::-webkit-slider-runnable-track { height:4px; background:rgba(255,255,255,0.2); }
    #time-label { color:#4D96FF; font-family:sans-serif; transform:translateX(-50%); }
  `;
  createElement("style", css);
}

function drawSectors() {
  push(); translate(width/2, height/2); stroke(255, 10);
  for (let i = 0; i < sectors.length; i++) {
    let a = (TWO_PI / sectors.length) * i;
    line(0, 0, cos(a) * width, sin(a) * width);
    fill(255, 30); noStroke(); textAlign(CENTER);
    let la = a + (TWO_PI / sectors.length) / 2;
    text(sectors[i], cos(la) * (width/3.5), sin(la) * (width/3.5));
  }
  pop();
}

function drawMe() {
  push(); translate(width/2, height/2); fill(255, 204, 0); noStroke();
  ellipse(0, 0, 10, 10); pop();
}

function drawFishingUI() {
  push(); noFill(); stroke(255, 150); ellipse(mouseX, mouseY, 30, 30);
  line(mouseX-20, mouseY, mouseX+20, mouseY); line(mouseX, mouseY-20, mouseX, mouseY+20);
  stroke(255, 50); line(mouseX, mouseY, width/2, height/2); pop();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); timeSlider.style('width', (width - 80) + 'px'); }
function cryptoRandomId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }