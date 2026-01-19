let stars = [];
let bgStars = [];
let sectors = ["家庭", "职场", "朋友", "兴趣"];
let colors = ["#FF6B6B", "#4D96FF", "#6BCB77", "#FFD93D"];

let isPanelOpen = false;
let selectedStarId = null;

let timeSlider;
let timeLabel;
let minDate, maxDate;
let currentViewDate;

const STORAGE_KEY = "echo_universe_final_v3.5";

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.id('defaultCanvas0');

  initPanelStyles();
  createMemoryPanelUI();
  createTimeSliderUI();

  loadStarsFromLocalStorage();
  updateTimeBounds();

  for (let i = 0; i < 150; i++) {
    bgStars.push({
      x: random(width), y: random(height),
      size: random(0.5, 2), alpha: random(30, 120), speed: random(0.05, 0.2)
    });
  }
}

function draw() {
  background(10, 10, 20);

  // 背景星尘
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

  for (let s of stars) {
    if (s.createdAt > currentViewDate) continue;
    if (isPanelOpen) s.angle += s.orbitSpeed * 0.1;
    else s.update();
    s.display();
  }

  let isAtPresent = (timeSlider.value() >= 100);
  let isInputActive = mouseIsPressed || (touches.length > 0);
  if (!isPanelOpen && isInputActive && isAtPresent && mouseY < height - 100) {
    drawFishingUI();
  }
}

// ==========================================
//   交互逻辑 (终极兼容版)
// ==========================================

function touchStarted() {
  // 如果点在了 HTML 面板或按钮上，直接放行，不让 p5.js 干预
  if (event.target.tagName === 'TEXTAREA' || 
      event.target.tagName === 'BUTTON' || 
      event.target.id === 'memory-panel') {
    return true; 
  }

  // 面板打开时，点击遮罩关闭面板
  if (isPanelOpen) {
    if (event.target.id === 'backdrop') closePanel();
    return false;
  }

  // 正常打捞/选中逻辑
  if (touches.length > 0) {
    handleInputStart(touches[0].x, touches[0].y);
  }
  return false;
}

function mousePressed() {
  if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'BUTTON') return true;
  if (isPanelOpen) return false;
  handleInputStart(mouseX, mouseY);
  return false;
}

function handleInputStart(x, y) {
  if (y > height - 100) return;
  const hit = getStarAt(x, y, 35);
  if (hit && hit.createdAt <= currentViewDate) {
    openPanel(hit);
  }
}

function touchEnded() {
  if (!isPanelOpen) handleInputEnd(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  if (!isPanelOpen) handleInputEnd(mouseX, mouseY);
  return false;
}

function handleInputEnd(x, y) {
  if (y > height - 100 || isPanelOpen) return;
  if (timeSlider.value() < 100) return;

  const hit = getStarAt(x, y, 35);
  if (hit) return;

  let d = dist(x, y, width / 2, height / 2);
  if (d <= 35) return;

  let radius = constrain(d, 50, width / 2);
  let ang = atan2(y - height / 2, x - width / 2);
  if (ang < 0) ang += TWO_PI;
  let sectorIndex = floor(map(ang, 0, TWO_PI, 0, sectors.length));
  
  setTimeout(() => {
    let name = prompt("这颗星星叫什么名字？", "");
    if (name) {
      stars.push(new Star({
        id: "id_" + Date.now(),
        name, sectorIndex, targetR: radius, angle: ang,
        orbitSpeed: random(0.002, 0.005) * (random() > 0.5 ? 1 : -1),
        size: random(5, 8), memories: [], createdAt: Date.now()
      }));
      updateTimeBounds();
      saveStarsToLocalStorage();
    }
  }, 100);
}

function getStarAt(x, y, threshold) {
  for (let i = stars.length - 1; i >= 0; i--) {
    let p = stars[i].getPos();
    if (dist(x, y, p.x, p.y) < threshold) return stars[i];
  }
  return null;
}

// ==========================================
//   UI 与 面板
// ==========================================

function createMemoryPanelUI() {
  const backdrop = createDiv("");
  backdrop.id("backdrop");

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

  document.getElementById('save-btn').onclick = (e) => { e.stopPropagation(); saveNewMemory(); };
  document.getElementById('close-btn').onclick = (e) => { e.stopPropagation(); closePanel(); };
  
  // 核心：强制输入框在触摸时聚焦
  const input = document.getElementById('memory-input');
  input.ontouchstart = (e) => { e.stopPropagation(); input.focus(); };
}

function openPanel(star) {
  isPanelOpen = true;
  selectedStarId = star.id;
  // 禁用画布交互
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
  // 恢复画布交互
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
  star.memories.push({ date: new Date().toLocaleString(), content: text });
  addMemoryToDOM(star.memories[star.memories.length-1]);
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
//   其他支撑代码
// ==========================================

class Star {
  constructor(o) {
    Object.assign(this, o);
    this.currentR = this.targetR;
  }
  get color() { return colors[this.sectorIndex]; }
  update() { this.angle += this.orbitSpeed; }
  getPos() {
    return {
      x: cos(this.angle) * this.currentR + width/2,
      y: sin(this.angle) * this.currentR + height/2
    };
  }
  display() {
    push(); translate(width/2, height/2);
    let x = cos(this.angle) * this.currentR;
    let y = sin(this.angle) * this.currentR;
    noFill(); stroke(red(this.color), green(this.color), blue(this.color), 20);
    ellipse(0, 0, this.targetR * 2);
    let b = sin(frameCount * 0.05 + (this.id.length)) * 2;
    fill(this.color); noStroke();
    drawingContext.shadowBlur = 15; drawingContext.shadowColor = this.color;
    ellipse(x, y, this.size + b);
    if (this.id === selectedStarId) { noFill(); stroke(255); ellipse(x, y, this.size + 12); }
    pop();
  }
}

function createTimeSliderUI() {
  let container = createDiv("");
  container.addClass("time-slider-container");
  timeLabel = createDiv("现在");
  timeLabel.id("time-label");
  timeLabel.parent(container);
  timeSlider = createSlider(0, 100, 100);
  timeSlider.addClass("time-slider");
  timeSlider.parent(container);
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

function saveStarsToLocalStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(stars)); }
function loadStarsFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) stars = JSON.parse(saved).map(s => new Star(s));
}

function drawSectors() {
  push(); translate(width/2, height/2); stroke(255, 10);
  for (let i = 0; i < sectors.length; i++) {
    let a = (TWO_PI / sectors.length) * i;
    line(0, 0, cos(a) * width, sin(a) * width);
    fill(255, 30); textAlign(CENTER);
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

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
function initPanelStyles() { /* 已整合至 style.css */ }