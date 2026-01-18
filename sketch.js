/**
 * Echo Universe - V0.2 (时光机版)
 * 包含：打捞、记忆面板、本地存档 + 【时间轴回溯】
 */

let stars = [];
let sectors = ["家庭", "职场", "朋友", "兴趣"];
let colors = ["#FF6B6B", "#4D96FF", "#6BCB77", "#FFD93D"];

let isPanelOpen = false;
let selectedStarId = null;

// 时间轴变量
let timeSlider;
let timeLabel;
let minDate, maxDate;
let currentViewDate;

const STORAGE_KEY = "echo_universe_final_v1";

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 1. 初始化样式和界面
  initPanelStyles();
  createMemoryPanelUI();
  createTimeSliderUI();

  // 2. 加载存档
  loadStarsFromLocalStorage();
  
  // 3. 初始化时间范围
  updateTimeBounds();
}

function draw() {
  background(0, 0, 15); // 深空背景

  drawSectors();
  drawMe();
  
  // 实时计算当前视图时间
  updateCurrentViewDate();

  // 遍历所有星星
  for (let s of stars) {
    // --- 核心逻辑：如果星星诞生于未来，则隐藏 ---
    if (s.createdAt > currentViewDate) continue;

    if (isPanelOpen) {
      // 面板打开时变慢
      s.angle += s.orbitSpeed * 0.2;
      s.currentR = lerp(s.currentR, s.targetR, 0.03);
    } else {
      s.update();
    }
    s.display();
  }

  // 打捞准星 (仅在“现在”时刻允许打捞)
  let isAtPresent = (timeSlider.value() >= 100);
  if (!isPanelOpen && mouseIsPressed && isAtPresent && mouseY < height - 80) {
    drawFishingUI();
  }
}

// --- 交互事件 ---

function mousePressed() {
  if (isPanelOpen) return;
  if (mouseY > height - 80) return; // 避开底部滑块

  const hit = getStarUnderMouse();
  // 只有当前显示的星星才能点击
  if (hit && hit.createdAt <= currentViewDate) {
    openPanel(hit);
  }
}

function mouseReleased() {
  if (isPanelOpen) return;
  if (mouseY > height - 80) return;

  // 只有在“现在”才能打捞
  let isAtPresent = (timeSlider.value() >= 100);
  if (!isAtPresent) return;

  const hit = getStarUnderMouse();
  if (hit) return;

  let d = dist(mouseX, mouseY, width / 2, height / 2);
  if (d <= 30) return;

  // 生成逻辑
  let radius = constrain(d, 50, width / 2);
  let ang = atan2(mouseY - height / 2, mouseX - width / 2);
  if (ang < 0) ang += TWO_PI;
  
  let sectorIndex = floor(map(ang, 0, TWO_PI, 0, sectors.length));
  sectorIndex = constrain(sectorIndex, 0, sectors.length - 1);

  let name = prompt("这颗星星叫什么名字？", "某人");
  if (!name) return;

  const star = new Star({
    id: cryptoRandomId(),
    name: name,
    sectorIndex: sectorIndex,
    targetR: radius,
    angle: ang,
    orbitSpeed: random(0.002, 0.005) * (random() > 0.5 ? 1 : -1) * map(radius, 50, width / 2, 1.2, 0.6),
    size: random(5, 8),
    memories: [],
    createdAt: Date.now() // 记录诞生时间
  });

  stars.push(star);
  updateTimeBounds();
  saveStarsToLocalStorage();
}

// --- 时间轴 UI 逻辑 ---

function createTimeSliderUI() {
  timeSlider = createSlider(0, 100, 100);
  timeSlider.position(40, height - 60);
  timeSlider.style('width', (width - 80) + 'px');
  timeSlider.addClass('time-slider');

  timeLabel = createDiv("现在");
  timeLabel.position(width/2, height - 90);
  timeLabel.id('time-label');
  timeLabel.style('pointer-events', 'none');
  timeLabel.style('text-align', 'center');
  timeLabel.style('transform', 'translateX(-50%)');
}

function updateTimeBounds() {
  if (stars.length === 0) {
    minDate = Date.now();
    maxDate = Date.now();
  } else {
    let timestamps = stars.map(s => s.createdAt);
    minDate = min(timestamps);
    maxDate = Date.now();
  }
  // 起点往前推7天，确保能回溯到空状态
  minDate = minDate - 1000 * 60 * 60 * 24 * 7;
}

function updateCurrentViewDate() {
  maxDate = Date.now(); // 终点始终是现在
  let val = timeSlider.value();
  currentViewDate = map(val, 0, 100, minDate, maxDate);
  
  let dateObj = new Date(currentViewDate);
  let dateStr = dateObj.getFullYear() + "/" + (dateObj.getMonth()+1) + "/" + dateObj.getDate();
  
  if (val >= 100) {
    timeLabel.html("现在");
    timeLabel.style('color', '#4D96FF');
    timeLabel.style('font-size', '16px');
  } else {
    timeLabel.html("回溯: " + dateStr);
    timeLabel.style('color', '#FF6B6B');
    timeLabel.style('font-size', '20px');
  }
}

// --- 基础类与函数 ---

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
  isMouseOver() {
    let p = this.getPos();
    return dist(mouseX, mouseY, p.x, p.y) < 14;
  }
  display() {
    push();
    translate(width / 2, height / 2);
    // 轨道
    noFill(); stroke(red(this.color), green(this.color), blue(this.color), 30); ellipse(0, 0, this.targetR * 2);
    // 坐标
    let x = cos(this.angle) * this.currentR;
    let y = sin(this.angle) * this.currentR;
    let hover = dist(mouseX - width / 2, mouseY - height / 2, x, y) < 14;
    
    // 悬停交互
    if (hover && !isPanelOpen) {
      fill(255); noStroke(); textAlign(LEFT, CENTER); text(this.name, x + 14, y);
      noFill(); stroke(this.color); ellipse(0, 0, this.targetR * 2);
    }
    // 选中光圈
    if (this.id === selectedStarId) {
      noFill(); stroke(255); strokeWeight(2); ellipse(x, y, 22); strokeWeight(1);
    }
    // 星体
    fill(this.color); noStroke();
    drawingContext.shadowBlur = hover ? 18 : 10;
    drawingContext.shadowColor = this.color;
    ellipse(x, y, hover ? this.size * 1.2 : this.size);
    pop();
  }
}

function getStarUnderMouse() {
  for (let i = stars.length - 1; i >= 0; i--) {
    // 必须也是当前时间可见的星星
    if (stars[i].createdAt <= currentViewDate && stars[i].isMouseOver()) return stars[i];
  }
  return null;
}

function drawSectors() {
  push();
  translate(width / 2, height / 2);
  stroke(255, 15);
  for (let i = 0; i < sectors.length; i++) {
    let a = (TWO_PI / sectors.length) * i;
    line(0, 0, cos(a) * width, sin(a) * width);
    fill(255, 40); noStroke(); textSize(14); textAlign(CENTER, CENTER);
    let labelA = a + (TWO_PI / sectors.length) / 2;
    text(sectors[i], cos(labelA) * (width / 3), sin(labelA) * (width / 3));
  }
  pop();
}

function drawMe() {
  push(); translate(width / 2, height / 2); noStroke();
  for (let i = 6; i > 0; i--) { fill(255, 204, 0, 22 - i * 3); ellipse(0, 0, i * 8); }
  fill(255, 204, 0); ellipse(0, 0, 10, 10); pop();
}

function drawFishingUI() {
  push(); noFill(); stroke(255, 150); ellipse(mouseX, mouseY, 20, 20);
  line(mouseX - 15, mouseY, mouseX + 15, mouseY); line(mouseX, mouseY - 15, mouseX, mouseY + 15);
  stroke(255, 50); line(mouseX, mouseY, width / 2, height / 2); pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (timeSlider) timeSlider.style('width', (width - 80) + 'px');
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

// --- 存储逻辑 ---
function saveStarsToLocalStorage() {
  const data = stars.map(s => ({
    id: s.id, name: s.name, sectorIndex: s.sectorIndex, targetR: s.targetR, currentR: s.currentR, angle: s.angle, orbitSpeed: s.orbitSpeed, size: s.size, memories: s.memories, createdAt: s.createdAt
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadStarsFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    stars = data.map(item => new Star({
      id: item.id, name: item.name, sectorIndex: item.sectorIndex, targetR: item.targetR, angle: item.angle, orbitSpeed: item.orbitSpeed, size: item.size, memories: item.memories, createdAt: item.createdAt
    }));
  } catch (e) { console.warn(e); }
}

// --- 记忆面板逻辑 ---
function createMemoryPanelUI() {
  const backdrop = createDiv(""); backdrop.id("backdrop"); backdrop.hide();
  backdrop.mousePressed(() => closePanel());
  const panel = createDiv(`
    <div id="panel-header"><h2 id="panel-title">星星名字</h2><span id="panel-sector" class="tag">扇区</span></div>
    <div id="memory-list"></div>
    <div id="panel-input-area"><textarea id="memory-input" placeholder="写下记忆..."></textarea><button id="save-btn">记录</button></div>
    <button id="close-btn">×</button>
  `);
  panel.id("memory-panel"); panel.hide();
  panel.elt.addEventListener("mousedown", (e) => e.stopPropagation());
  select("#save-btn").mousePressed(saveNewMemory);
  select("#close-btn").mousePressed(closePanel);
}

function openPanel(star) {
  isPanelOpen = true; selectedStarId = star.id;
  select("#panel-title").html(star.name);
  select("#panel-sector").html(sectors[star.sectorIndex]);
  const list = select("#memory-list"); list.html("");
  (star.memories || []).forEach(mem => addMemoryToDOM(mem));
  select("#backdrop").show(); select("#memory-panel").show();
}

function closePanel() {
  isPanelOpen = false; selectedStarId = null;
  select("#memory-panel").hide(); select("#backdrop").hide();
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
  const item = createDiv(""); item.addClass("memory-item");
  createDiv(mem.date).addClass("memory-date").parent(item);
  createDiv(mem.content).addClass("memory-content").parent(item);
  item.parent(list);
  list.elt.scrollTop = list.elt.scrollHeight;
}

// --- 样式表 ---
function initPanelStyles() {
  const css = `
    input[type=range].time-slider { -webkit-appearance: none; background: transparent; }
    input[type=range].time-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #4D96FF; cursor: pointer; margin-top: -6px; box-shadow: 0 0 10px #4D96FF; }
    input[type=range].time-slider::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
    #backdrop{ display:none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 999; pointer-events: auto; }
    #memory-panel{ display:none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 340px; height: 480px; background: rgba(20, 20, 30, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: #fff; font-family: sans-serif; z-index: 1000; overflow: hidden; display: flex; flex-direction: column; pointer-events: auto; }
    #panel-header{ padding: 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    #panel-title{ margin: 0; font-size: 22px; }
    .tag{ display:inline-block; margin-top: 8px; font-size: 12px; background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 10px; color: #aaa; }
    #memory-list{ flex: 1; overflow-y: auto; padding: 14px 18px; }
    .memory-item{ margin-bottom: 14px; padding-left: 10px; border-left: 2px solid #FFCC00; }
    .memory-date{ font-size: 11px; color: #888; margin-bottom: 2px; }
    .memory-content{ font-size: 14px; color: #eee; }
    #panel-input-area{ display:flex; gap: 10px; padding: 14px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1); }
    #memory-input{ flex: 1; height: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 8px; resize: none; }
    #save-btn{ background: #4D96FF; color: white; border: none; border-radius: 8px; padding: 0 12px; cursor: pointer; }
    #close-btn{ position:absolute; top: 10px; right: 12px; background: none; border: none; color: #aaa; font-size: 24px; cursor: pointer; }
  `;
  createElement("style", css);
}