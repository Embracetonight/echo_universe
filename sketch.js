/**
 * Echo Universe - Prototype V0.2 (Full Expanded Version)
 * 包含：星系、打捞、记忆面板、时间轴回溯、本地存储
 */

let stars = [];
let sectors = ["家庭", "职场", "朋友", "兴趣"];
let colors = ["#FF6B6B", "#4D96FF", "#6BCB77", "#FFD93D"];

let isPanelOpen = false;
let selectedStarId = null;

// 时间轴相关
let timeSlider;
let timeLabel;
let minDate, maxDate;
let currentViewDate;

const STORAGE_KEY = "echoUniverse_V5_Safe"; // 换个Key防止旧数据冲突

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 1. 初始化样式
  initPanelStyles();
  
  // 2. 创建界面元素
  createMemoryPanelUI();
  createTimeSliderUI();
  
  // 3. 加载数据
  loadStarsFromLocalStorage();
  
  // 4. 初始化时间边界
  updateTimeBounds();
}

function draw() {
  background(0, 0, 15);

  drawSectors();
  drawMe();
  
  // 实时更新当前时间视图
  updateCurrentViewDate();

  for (let s of stars) {
    // --- 时间过滤核心逻辑 ---
    // 如果星星的诞生时间晚于滑块选择的时间，就不画它
    if (s.createdAt > currentViewDate) continue;

    if (isPanelOpen) {
      // 面板打开时，星星变慢
      s.angle += s.orbitSpeed * 0.2;
      s.currentR = lerp(s.currentR, s.targetR, 0.03);
    } else {
      // 正常运转
      s.update();
    }
    s.display();
  }

  // 打捞准星逻辑
  let isAtPresent = (timeSlider.value() >= 100);
  // 只有在：面板关闭 + 处于“现在”时间 + 鼠标按下时，才显示打捞UI
    // 兼容鼠标按压 和 手指按压
  let isInputActive = mouseIsPressed || (touches.length > 0);
  
  if (!isPanelOpen && isInputActive && isAtPresent && mouseY < height - 80) {
    drawFishingUI();
  }
}

// --- 交互逻辑 ---

// ==========================================
//   新的通用交互逻辑 (同时支持鼠标和触摸)
// ==========================================

// 1. 处理“按下” (无论是鼠标点还是手指按)
function handleInputStart(x, y) {
  if (isPanelOpen) return;
  if (y > height - 80) return; // 避开底部滑块

  // 修正触摸坐标 (p5.js 的 touch 有时是个数组)
  let inputX = x;
  let inputY = y;

  const hit = getStarUnderMouse(inputX, inputY);
  
  // 只有当前显示的星星才能点击
  if (hit && hit.createdAt <= currentViewDate) {
    openPanel(hit);
    return; // 如果点中星星，就不要触发打捞
  }
  
  // 记录打捞开始
  // (p5.js 的 mouseIsPressed 在触摸模式下反应较慢，我们手动标记)
  window.isInteracting = true; 
}

// 2. 处理“松开”
function handleInputEnd(x, y) {
  window.isInteracting = false;
  
  if (isPanelOpen) return;
  if (y > height - 80) return;

  // 只有在“现在”才能打捞
  let isAtPresent = (timeSlider.value() >= 100);
  if (!isAtPresent) return;

  const hit = getStarUnderMouse(x, y);
  if (hit) return;

  let d = dist(x, y, width / 2, height / 2);
  if (d <= 30) return;

  // 生成逻辑
  let radius = constrain(d, 50, width / 2);
  let ang = atan2(y - height / 2, x - width / 2);
  if (ang < 0) ang += TWO_PI;
  
  let sectorIndex = floor(map(ang, 0, TWO_PI, 0, sectors.length));
  sectorIndex = constrain(sectorIndex, 0, sectors.length - 1);

  let name = prompt("这颗星星叫什么名字？", "某人");
  // 注意：手机上 prompt 可能会打断全屏体验，后期可以用自定义模态框代替
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
    createdAt: Date.now()
  });

  stars.push(star);
  updateTimeBounds();
  saveStarsToLocalStorage();
}

// ==========================================
//   p5.js 事件绑定
// ==========================================

// 鼠标事件
function mousePressed() {
  handleInputStart(mouseX, mouseY);
  // 返回 false 防止默认浏览器行为 (如选中文字)
  return false; 
}

function mouseReleased() {
  handleInputEnd(mouseX, mouseY);
  return false;
}

// 触摸事件 (关键！)
function touchStarted() {
  // touches[0] 是第一根手指
  if (touches.length > 0) {
    handleInputStart(touches[0].x, touches[0].y);
  }
  // 必须返回 false，否则手机会触发滚动或缩放
  return false; 
}

function touchEnded() {
  // 注意：touchEnded 时 touches 数组可能已经空了，我们用 p5 的 mouseX/Y 近似最后位置
  // 或者直接不传参，依靠 handleInputEnd 里的逻辑
  handleInputEnd(mouseX, mouseY);
  return false;
}

// 还要修改一下 draw() 里绘制准星的判断条件
// 把 mouseIsPressed 改成 (mouseIsPressed || (touches.length > 0))

// --- 时间轴 UI ---

function createTimeSliderUI() {
  timeSlider = createSlider(0, 100, 100);
  timeSlider.position(40, height - 60);
  timeSlider.style('width', (width - 80) + 'px');
  timeSlider.addClass('time-slider');

  timeLabel = createDiv("现在");
  timeLabel.position(width/2, height - 90);
  timeLabel.id('time-label');
  timeLabel.style('color', '#4D96FF');
  timeLabel.style('font-family', 'sans-serif');
  timeLabel.style('text-align', 'center');
  timeLabel.style('transform', 'translateX(-50%)');
  timeLabel.style('pointer-events', 'none');
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
  // 起点往前推7天，保证能回溯到空状态
  minDate = minDate - 1000 * 60 * 60 * 24 * 7;
}

function updateCurrentViewDate() {
  maxDate = Date.now();
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

// --- 星星类 ---

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

  get color() {
    return colors[this.sectorIndex];
  }

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
    noFill();
    stroke(red(this.color), green(this.color), blue(this.color), 30);
    ellipse(0, 0, this.targetR * 2);

    let x = cos(this.angle) * this.currentR;
    let y = sin(this.angle) * this.currentR;

    let hover = dist(mouseX - width / 2, mouseY - height / 2, x, y) < 14;

    // 悬停显示名字
    if (hover && !isPanelOpen) {
      fill(255);
      noStroke();
      textAlign(LEFT, CENTER);
      text(this.name, x + 14, y);
      
      // 轨道高亮
      noFill();
      stroke(this.color);
      ellipse(0, 0, this.targetR * 2);
    }

    // 选中光圈
    if (this.id === selectedStarId) {
      noFill();
      stroke(255);
      strokeWeight(2);
      ellipse(x, y, 22);
      strokeWeight(1);
    }

    // 星星本体
    fill(this.color);
    noStroke();
    drawingContext.shadowBlur = hover ? 18 : 10;
    drawingContext.shadowColor = this.color;
    ellipse(x, y, hover ? this.size * 1.2 : this.size);

    pop();
  }
}

// --- 辅助功能函数 ---

function getStarUnderMouse(x, y) {
  // 如果没传参数，默认用鼠标位置
  let tx = x || mouseX;
  let ty = y || mouseY;
  
  for (let i = stars.length - 1; i >= 0; i--) {
    // 也要修改 isMouseOver 方法，或者直接在这里算距离
    let p = stars[i].getPos();
    // 手机上判定范围要大一点 (把 14 改成 30)，因为手指比较粗
    if (dist(tx, ty, p.x, p.y) < 30 && stars[i].createdAt <= currentViewDate) {
      return stars[i];
    }
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
    fill(255, 40);
    noStroke();
    textSize(14);
    textAlign(CENTER, CENTER);
    let labelA = a + (TWO_PI / sectors.length) / 2;
    text(sectors[i], cos(labelA) * (width / 3), sin(labelA) * (width / 3));
  }
  pop();
}

function drawMe() {
  push();
  translate(width / 2, height / 2);
  noStroke();
  for (let i = 6; i > 0; i--) {
    fill(255, 204, 0, 22 - i * 3);
    ellipse(0, 0, i * 8);
  }
  fill(255, 204, 0);
  ellipse(0, 0, 10, 10);
  pop();
}

function drawFishingUI() {
  push();
  noFill();
  stroke(255, 150);
  ellipse(mouseX, mouseY, 20, 20);
  line(mouseX - 15, mouseY, mouseX + 15, mouseY);
  line(mouseX, mouseY - 15, mouseX, mouseY + 15);
  stroke(255, 50);
  line(mouseX, mouseY, width / 2, height / 2);
  pop();
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
    id: s.id,
    name: s.name,
    sectorIndex: s.sectorIndex,
    targetR: s.targetR,
    currentR: s.currentR,
    angle: s.angle,
    orbitSpeed: s.orbitSpeed,
    size: s.size,
    memories: s.memories || [],
    createdAt: s.createdAt
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadStarsFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    stars = data.map(item => new Star({
      id: item.id,
      name: item.name,
      sectorIndex: item.sectorIndex,
      targetR: item.targetR,
      angle: item.angle,
      orbitSpeed: item.orbitSpeed,
      size: item.size,
      memories: item.memories,
      createdAt: item.createdAt
    }));
  } catch (e) {
    console.warn("Load failed", e);
  }
}

// --- DOM 面板与样式 ---

function createMemoryPanelUI() {
  const backdrop = createDiv("");
  backdrop.id("backdrop");
  backdrop.hide();
  
  // --- 修复 1: 同时监听鼠标点击和手指触摸 ---
  // 电脑端
  backdrop.mousePressed(() => closePanel());
  // 手机端 (p5.js 的 touchStarted 有时会穿透，我们用原生事件更稳)
  backdrop.elt.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 防止穿透
    closePanel();
  }, {passive: false});

  const panel = createDiv(`
    <div id="panel-header">
      <h2 id="panel-title">星星名字</h2>
      <span id="panel-sector" class="tag">扇区</span>
    </div>
    <div id="memory-list"></div>
    <div id="panel-input-area">
      <textarea id="memory-input" placeholder="写下关于 ta 的记忆..."></textarea>
      <button id="save-btn">记录</button>
    </div>
    <!-- 修复 2: 增大关闭按钮的热区 -->
    <div id="close-btn-area">×</div> 
  `);
  panel.id("memory-panel");
  panel.hide();

  // --- 修复 3: 防止面板内部的触摸穿透到画布 ---
  const stopProp = (e) => e.stopPropagation();
  panel.elt.addEventListener("mousedown", stopProp);
  panel.elt.addEventListener("touchstart", stopProp, {passive: true});
  panel.elt.addEventListener("click", stopProp);

  // 绑定保存按钮
  const saveBtn = select("#save-btn");
  saveBtn.mousePressed(saveNewMemory);
  saveBtn.touchStarted(saveNewMemory); // 手机适配

  // 绑定关闭按钮 (使用新的热区 div)
  const closeBtn = select("#close-btn-area");
  // 电脑
  closeBtn.mousePressed(() => closePanel());
  // 手机
  closeBtn.touchStarted((e) => {
    // e.preventDefault(); 
    closePanel();
    return false; // p5 way to stop propagation
  });
}

function openPanel(star) {
  isPanelOpen = true;
  selectedStarId = star.id;

  select("#panel-title").html(star.name);
  select("#panel-sector").html(sectors[star.sectorIndex]);
  const list = select("#memory-list");
  list.html("");
  (star.memories || []).forEach(mem => addMemoryToDOM(mem));

  select("#backdrop").show();
  select("#memory-panel").show();
}

function closePanel() {
  isPanelOpen = false;
  selectedStarId = null;
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
  const item = createDiv("");
  item.addClass("memory-item");
  
  const dateDiv = createDiv(mem.date);
  dateDiv.addClass("memory-date");
  dateDiv.parent(item);
  
  const contentDiv = createDiv(mem.content);
  contentDiv.addClass("memory-content");
  contentDiv.parent(item);
  
  item.parent(list);
  list.elt.scrollTop = list.elt.scrollHeight;
}

function initPanelStyles() {
  const css = `
    /* ... 之前的样式保持不变 ... */
    
    /* --- 修复 4: 专门为手机优化的关闭按钮 --- */
    #close-btn-area {
      position: absolute;
      top: 0;
      right: 0;
      width: 60px;   /* 够大，好点 */
      height: 60px;
      line-height: 60px;
      text-align: center;
      color: rgba(255,255,255,0.6);
      font-size: 32px;
      font-weight: 200;
      cursor: pointer;
      z-index: 1001; /* 确保在最上层 */
    }
    #close-btn-area:active {
      color: #fff;
      background: rgba(255,255,255,0.1);
    }
    
    /* 优化输入框在手机上的体验 */
    #memory-input {
      font-size: 16px; /* 防止 iOS 输入时自动放大页面 */
    }
  `;
  createElement("style", css);
}