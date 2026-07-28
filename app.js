/* ==========================================================================
   EDH ライフカウンター  (Chromebook タブレット向け PWA)
   ゲーム中の全ての数値操作をメイン画面の1タップで完結させる。
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   定数
   -------------------------------------------------------------------------- */

const STORAGE_KEY = 'edh_life_counter_v1';
const MAX_PLAYERS = 6;
const MAX_COMMANDERS = 2;
const HISTORY_LIMIT = 300;

const COLORS = [
  { id: 'w', name: '白', hex: '#e0d5a8' },
  { id: 'u', name: '青', hex: '#4a90d9' },
  { id: 'b', name: '黒', hex: '#9d8fc0' },
  { id: 'r', name: '赤', hex: '#e0604f' },
  { id: 'g', name: '緑', hex: '#4fa86f' },
  { id: 'm', name: '金', hex: '#e0b04a' },
];

/* メイン画面に並べるカウンター群 */
const COUNTERS = [
  { key: 'poison',  label: '☠ 毒',     min: 0, max: 99,  hotAt: 10 },
  { key: 'energy',  label: '⚡ エネ',   min: 0, max: 999 },
  { key: 'exp',     label: '✦ 経験',   min: 0, max: 99 },
  { key: 'speed',   label: '≫ 速度',   min: 0, max: 4 },
  { key: 'ring',    label: '◎ 指輪',   min: 0, max: 4 },
];

const COMMANDER_MARK = ['A', 'B'];

/* --------------------------------------------------------------------------
   レイアウト定義
   seats: [行開始, 列開始, 行終了, 列終了, 回転角] — プレイヤー番号順に着席
   -------------------------------------------------------------------------- */

const LAYOUTS = {
  2: [
    { id: 'face2',  name: '上下 対面', cols: '1fr', rows: '1fr 1fr',
      seats: [[2,1,3,2,0], [1,1,2,2,180]] },
    { id: 'side2',  name: '左右 対面', cols: '1fr 1fr', rows: '1fr',
      seats: [[1,1,2,2,90], [1,2,2,3,270]] },
    { id: 'row2',   name: '横並び',    cols: '1fr 1fr', rows: '1fr',
      seats: [[1,1,2,2,0], [1,2,2,3,0]] },
  ],
  3: [
    { id: 'side3l', name: '左1人 / 右2人', cols: '1fr 2.6fr', rows: '1fr 1fr',
      seats: [[2,2,3,3,0], [1,1,3,2,90], [1,2,2,3,180]] },
    { id: 'side3r', name: '右1人 / 左2人', cols: '2.6fr 1fr', rows: '1fr 1fr',
      seats: [[2,1,3,2,0], [1,2,3,3,270], [1,1,2,2,180]] },
    { id: 'fan3',   name: '手前1人 / 奥2人', cols: '1fr 1fr', rows: '1fr 1fr',
      seats: [[2,1,3,3,0], [1,1,2,2,180], [1,2,2,3,180]] },
    { id: 'fan3f',  name: '奥1人 / 手前2人', cols: '1fr 1fr', rows: '1fr 1fr',
      seats: [[1,1,2,3,180], [2,1,3,2,0], [2,2,3,3,0]] },
  ],
  4: [
    { id: 'cross4', name: '手前2 / 奥2', cols: '1fr 1fr', rows: '1fr 1fr',
      seats: [[2,1,3,2,0], [1,1,2,2,180], [1,2,2,3,180], [2,2,3,3,0]] },
    { id: 'around4',name: '囲み (4方向)', cols: '1.25fr 2fr 1.25fr', rows: '1fr 1fr',
      seats: [[2,2,3,3,0], [1,1,3,2,90], [1,2,2,3,180], [1,3,3,4,270]] },
    { id: 'grid4',  name: '格子 (同じ向き)', cols: '1fr 1fr', rows: '1fr 1fr',
      seats: [[1,1,2,2,0], [1,2,2,3,0], [2,1,3,2,0], [2,2,3,3,0]] },
  ],
  5: [
    { id: 'side5l', name: '左1人 / 右4人', cols: '1fr 1.38fr 1.38fr', rows: '1fr 1fr',
      seats: [[2,2,3,3,0], [1,1,3,2,90], [1,2,2,3,180], [1,3,2,4,180], [2,3,3,4,0]] },
    { id: 'side5r', name: '右1人 / 左4人', cols: '1.38fr 1.38fr 1fr', rows: '1fr 1fr',
      seats: [[2,2,3,3,0], [1,3,3,4,270], [1,2,2,3,180], [1,1,2,2,180], [2,1,3,2,0]] },
  ],
  6: [
    { id: 'fan6',   name: '手前3 / 奥3', cols: '1fr 1fr 1fr', rows: '1fr 1fr',
      seats: [[2,1,3,2,0], [1,1,2,2,180], [1,2,2,3,180], [1,3,2,4,180], [2,3,3,4,0], [2,2,3,3,0]] },
    { id: 'around6',name: '囲み (6方向)', cols: '1.15fr 1.35fr 1.35fr 1.15fr', rows: '1fr 1fr',
      seats: [[2,2,3,3,0], [1,1,3,2,90], [1,2,2,3,180], [1,3,2,4,180], [1,4,3,5,270], [2,3,3,4,0]] },
    { id: 'grid6',  name: '格子 (同じ向き)', cols: '1fr 1fr 1fr', rows: '1fr 1fr',
      seats: [[1,1,2,2,0], [1,2,2,3,0], [1,3,2,4,0], [2,1,3,2,0], [2,2,3,3,0], [2,3,3,4,0]] },
  ],
};

/* --------------------------------------------------------------------------
   小道具
   -------------------------------------------------------------------------- */

const $ = sel => document.querySelector(sel);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const activePlayers = () => S.players.slice(0, S.settings.playerCount);
const colorOf = p => COLORS[clamp(p.color, 0, COLORS.length - 1)].hex;
const currentLayout = () => {
  const list = LAYOUTS[S.settings.playerCount];
  return list.find(l => l.id === S.settings.layout[S.settings.playerCount]) || list[0];
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

const toastEl = el('div', '', '');
toastEl.id = 'toast';
document.body.appendChild(toastEl);
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

/* --------------------------------------------------------------------------
   状態
   -------------------------------------------------------------------------- */

function newPlayer(i) {
  return {
    name: `プレイヤー${i + 1}`,
    color: i % COLORS.length,
    commanders: 1,
    life: 40,
    poison: 0,
    energy: 0,
    exp: 0,
    speed: 0,
    ring: 0,
    ascend: false,
    tax: [0, 0],
    // dmg[攻撃元playerのindex][その統率者index]
    // 自分のindexは「自分の統率者を奪われて殴られた」ぶんに使う
    dmg: Array.from({ length: MAX_PLAYERS }, () => [0, 0]),
    showSelfDmg: false,
  };
}

function defaultState() {
  return {
    settings: {
      playerCount: 4,
      startingLife: 40,
      layout: { 2: 'face2', 3: 'side3l', 4: 'cross4', 5: 'side5l', 6: 'fan6' },
      keepAwake: true,
      linkCommanderDamage: true,
      showBig5: true,
      showTax: true,
      showMonarch: true,
      showAscend: true,
      visibleCounters: { poison: true, energy: true, exp: true, speed: true, ring: true },
    },
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => newPlayer(i)),
    monarch: null,
    timer: { running: false, base: 0, startedAt: 0 },
    history: [],
  };
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(defaultState(), JSON.parse(raw));
  } catch (err) {
    // 途中まで書き換わった state を返さないよう、必ず作り直す
    console.warn('保存データを読み込めませんでした', err);
    return defaultState();
  }
}

/* 保存データの欠損・旧形式を既定値で補う */
function migrate(base, saved) {
  const s = base;
  // base は s と同じオブジェクトなので、上書きされる前に既定値を控えておく
  const defaults = {
    layout: Object.assign({}, base.settings.layout),
    visibleCounters: Object.assign({}, base.settings.visibleCounters),
  };
  if (saved.settings) {
    Object.assign(s.settings, saved.settings);
    s.settings.layout = Object.assign({}, defaults.layout, saved.settings.layout);
    // 廃止されたレイアウト ID が残っていたら既定値に戻す
    Object.keys(LAYOUTS).forEach(n => {
      if (!LAYOUTS[n].some(l => l.id === s.settings.layout[n])) {
        s.settings.layout[n] = defaults.layout[n];
      }
    });
    s.settings.visibleCounters = Object.assign({}, defaults.visibleCounters, saved.settings.visibleCounters);
    s.settings.playerCount = clamp(s.settings.playerCount | 0, 2, MAX_PLAYERS);
  }
  if (Array.isArray(saved.players)) {
    saved.players.slice(0, MAX_PLAYERS).forEach((p, i) => {
      const t = s.players[i];
      if (!p) return;
      t.name = typeof p.name === 'string' && p.name ? p.name : t.name;
      t.color = clamp(p.color | 0, 0, COLORS.length - 1);
      t.commanders = clamp(p.commanders | 0 || 1, 1, MAX_COMMANDERS);
      ['life', 'poison', 'energy', 'exp', 'speed', 'ring'].forEach(k => {
        if (Number.isFinite(p[k])) t[k] = p[k];
      });
      t.ascend = !!p.ascend;
      t.showSelfDmg = !!p.showSelfDmg;
      if (Array.isArray(p.tax)) t.tax = [p.tax[0] | 0, p.tax[1] | 0];
      if (Array.isArray(p.dmg)) {
        p.dmg.slice(0, MAX_PLAYERS).forEach((arr, j) => {
          if (Array.isArray(arr)) t.dmg[j] = [arr[0] | 0, arr[1] | 0];
        });
      }
    });
  }
  if (Number.isInteger(saved.monarch) || saved.monarch === null) s.monarch = saved.monarch;
  if (saved.timer) Object.assign(s.timer, saved.timer);
  if (Array.isArray(saved.history)) s.history = saved.history.slice(0, HISTORY_LIMIT);
  return s;
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch (err) {
      console.warn('保存に失敗しました', err);
    }
  }, 150);
}

/* --------------------------------------------------------------------------
   盤面の構築
   -------------------------------------------------------------------------- */

const board = $('#board');
/** プレイヤーごとの DOM 参照 */
let refs = [];

function buildBoard() {
  const layout = currentLayout();
  clearLifeDeltas();
  seatObserver.disconnect();
  cmdObserver.disconnect();
  lifeObserver.disconnect();
  board.style.gridTemplateColumns = layout.cols;
  board.style.gridTemplateRows = layout.rows;
  board.textContent = '';
  refs = [];

  activePlayers().forEach((p, i) => {
    const [r1, c1, r2, c2, rot] = layout.seats[i];
    const seat = el('div', 'seat');
    seat.style.gridArea = `${r1} / ${c1} / ${r2} / ${c2}`;
    seat.dataset.rot = String(rot);

    const panel = el('div', 'panel');
    panel.style.setProperty('--accent', colorOf(p));
    panel.dataset.p = String(i);

    const ref = { seat, panel, rot };
    const inner = el('div', 'p-inner');
    inner.append(buildHead(i, ref), buildLife(i, ref), buildCounters(i, ref), buildCmd(i, ref));
    panel.appendChild(inner);
    seat.appendChild(panel);
    board.appendChild(seat);
    refs.push(ref);

    cmdObserver.observe(panel.querySelector('.p-cmd'));
    lifeObserver.observe(panel);
    if (rot === 90 || rot === 270) observeSeat(seat);
  });

  update();
  fitAllLifeNumbers();
}

function buildHead(i, ref) {
  const head = el('div', 'p-head');

  const name = el('button', 'p-name');
  name.dataset.act = 'name';
  name.dataset.p = String(i);
  name.dataset.rep = '0';
  ref.name = name;
  head.appendChild(name);

  if (S.settings.showMonarch) {
    const b = el('button', 'flag');
    b.dataset.act = 'monarch';
    b.dataset.p = String(i);
    b.dataset.rep = '0';
    b.innerHTML = '<span class="ico">♛</span>統治者';
    ref.monarch = b;
    head.appendChild(b);
  }
  if (S.settings.showAscend) {
    const b = el('button', 'flag');
    b.dataset.act = 'ascend';
    b.dataset.p = String(i);
    b.dataset.rep = '0';
    b.innerHTML = '<span class="ico">⛰</span>昇殿';
    ref.ascend = b;
    head.appendChild(b);
  }
  return head;
}

function buildLife(i, ref) {
  const row = el('div', 'p-life');
  const mk = (d, cls, label) => {
    const b = el('button', `life-btn ${cls}`, label);
    b.dataset.act = 'life';
    b.dataset.p = String(i);
    b.dataset.d = String(d);
    return b;
  };
  const big5 = S.settings.showBig5;
  const minus5 = mk(-5, 'small', '−5');
  const plus5 = mk(5, 'small', '+5');
  if (!big5) { minus5.style.visibility = 'hidden'; plus5.style.visibility = 'hidden'; }

  const val = el('div', 'life-val');
  const num = el('span', 'life-num', '40');
  const delta = el('div', 'life-delta');   // 直近の増減量のポップアップ
  val.append(num, delta);
  ref.life = val;
  ref.lifeNum = num;
  ref.delta = delta;
  row.append(minus5, mk(-1, 'big', '−'), val, mk(1, 'big', '＋'), plus5);
  return row;
}

/* --------------------------------------------------------------------------
   ライフの数字を枠に合わせて自動縮小

   CSS の font-size は「最大サイズ」で、3 桁 (100 や -12) になって入りきらないときだけ
   実測した比率で縮める。枠の大きさは grid が決めていて文字サイズに依存しないので、
   縮小がさらに縮小を呼ぶことはない。
   -------------------------------------------------------------------------- */

function fitLifeNumber(ref) {
  const box = ref.life, num = ref.lifeNum;
  if (!box || !num) return;
  num.style.fontSize = '';
  const base = parseFloat(getComputedStyle(box).fontSize);
  const availW = box.clientWidth, availH = box.clientHeight;
  if (!base || !availW || !availH) return;

  // 90/270 度回転したパネルでは getBoundingClientRect() が画面座標 (回転後) を返して
  // clientWidth と軸が食い違うため、レイアウト座標の offsetWidth で測る
  const needW = num.offsetWidth;
  let size = base;
  if (needW > availW) size = Math.min(size, base * (availW / needW));
  const needH = base * 0.95;   // line-height 0.9 + 余裕
  if (needH > availH) size = Math.min(size, base * (availH / needH));
  if (size < base) num.style.fontSize = Math.floor(size) + 'px';
}

function fitAllLifeNumbers() { refs.forEach(r => r && fitLifeNumber(r)); }

/* パネルの寸法が変わったら測り直す */
const lifeObserver = new ResizeObserver(entries => {
  for (const e of entries) {
    const i = Number(e.target.dataset.p);
    if (refs[i]) fitLifeNumber(refs[i]);
  }
});

/* --------------------------------------------------------------------------
   ライフ増減量のポップアップ
   数秒以内に続けて操作した分を合算して表示し、手が止まったら消える。
   -------------------------------------------------------------------------- */

const DELTA_HOLD_MS = 3000;
let lifeDeltas = [];

function noteLifeChange(i, d) {
  if (!d) return;
  const ref = refs[i];
  if (!ref || !ref.delta) return;

  const acc = lifeDeltas[i] || (lifeDeltas[i] = { sum: 0, timer: 0 });
  acc.sum += d;
  clearTimeout(acc.timer);

  const node = ref.delta;
  node.textContent = acc.sum > 0 ? `+${acc.sum}` : acc.sum < 0 ? String(acc.sum) : '±0';
  node.classList.toggle('plus', acc.sum > 0);
  node.classList.toggle('minus', acc.sum < 0);
  node.classList.toggle('zero', acc.sum === 0);
  node.classList.add('show');

  // 押すたびに軽く弾ませて、加算されたことを分かるようにする
  node.animate(
    [{ transform: 'translateX(-50%) scale(1.22)' }, { transform: 'translateX(-50%) scale(1)' }],
    { duration: 170, easing: 'ease-out' }
  );

  acc.timer = setTimeout(() => {
    node.classList.remove('show');
    acc.sum = 0;
  }, DELTA_HOLD_MS);
}

function clearLifeDeltas() {
  lifeDeltas.forEach(a => a && clearTimeout(a.timer));
  lifeDeltas = [];
  refs.forEach(r => r && r.delta && r.delta.classList.remove('show'));
}

/* ±ボタン付きチップ */
function stepper(label, dataset, opts = {}) {
  const wrap = el('div', 'stepper');
  const step = opts.step || 1;

  const dec = el('button', 'st-btn', '−');
  const inc = el('button', 'st-btn', '＋');
  Object.assign(dec.dataset, dataset, { d: String(-step) });
  Object.assign(inc.dataset, dataset, { d: String(step) });

  const core = el('div', 'st-core');
  const lab = el('div', 'st-label');
  if (opts.dotColor) {
    const dot = el('span', 'st-dot');
    dot.style.background = opts.dotColor;
    lab.appendChild(dot);
  }
  // 名前は幅が足りなければ省略するが、共闘の A / B は必ず残す
  lab.appendChild(el('span', 'st-name', label));
  if (opts.short) lab.appendChild(el('span', 'st-short', opts.short));
  if (opts.mark) lab.appendChild(el('span', 'st-mark', opts.mark));
  const val = el('div', 'st-value', '0');
  core.append(lab, val);

  wrap.append(dec, core, inc);
  return { wrap, val };
}

function buildCounters(i, ref) {
  const row = el('div', 'p-counters');
  ref.counters = {};
  COUNTERS.forEach(c => {
    if (!S.settings.visibleCounters[c.key]) return;
    const st = stepper(c.label, { act: 'ctr', p: String(i), key: c.key });
    ref.counters[c.key] = st;
    row.appendChild(st.wrap);
  });
  return row;
}

/* --------------------------------------------------------------------------
   統率者ダメージ欄 = 座席のミニマップ

   パネルは席の向きに合わせて回転しているので、盤面の配置をそのまま置くと
   一緒に回ってしまい、左隣の相手が右側に出てしまう。
   パネルの回転を打ち消す向き (-rot) に盤面を回してから配置すると、
   どの席のプレイヤーから見ても「左隣の人は左」に並ぶ。
   -------------------------------------------------------------------------- */

function rotatedSeatMap(layout, rot) {
  const R = layout.rows.trim().split(/\s+/).length;
  const C = layout.cols.trim().split(/\s+/).length;
  const seats = layout.seats;

  let cells, cols, rows;
  switch (rot) {
    case 180:
      cols = C; rows = R;
      cells = seats.map(([r1, c1, r2, c2]) => [R + 2 - r2, C + 2 - c2, R + 2 - r1, C + 2 - c1]);
      break;
    case 90:  // 盤面を反時計回りに 90°
      cols = R; rows = C;
      cells = seats.map(([r1, c1, r2, c2]) => [C + 2 - c2, r1, C + 2 - c1, r2]);
      break;
    case 270: // 盤面を時計回りに 90°
      cols = R; rows = C;
      cells = seats.map(([r1, c1, r2, c2]) => [c1, R + 2 - r2, c2, R + 2 - r1]);
      break;
    default:
      cols = C; rows = R;
      cells = seats.map(s => s.slice(0, 4));
  }

  // 席の広さの比 (1fr : 2.6fr など) までは真似しない。
  // そのまま使うと細いマスのチップが潰れてしまうため、マスは等幅にして
  // 「誰がどの位置か」だけを再現する。高さは中身なりに詰める。
  return {
    cols: `repeat(${cols}, 1fr)`,
    rows: `repeat(${rows}, auto)`,
    colCount: cols,
    seats: cells,
  };
}

function buildCmd(i, ref) {
  const map = rotatedSeatMap(currentLayout(), ref.rot);
  const wrap = el('div', 'p-cmd');
  wrap.style.gridTemplateColumns = map.cols;
  wrap.style.gridTemplateRows = map.rows;
  // 1 マスの実寸に応じて詰め方を切り替える (cmdObserver 参照)
  wrap.dataset.cols = String(map.colCount);

  ref.dmg = Array.from({ length: MAX_PLAYERS }, () => []);
  ref.tax = [];

  let chips = 0;

  activePlayers().forEach((op, j) => {
    const [r1, c1, r2, c2] = map.seats[j];
    const cell = el('div', 'cmd-cell');
    cell.style.gridArea = `${r1} / ${c1} / ${r2} / ${c2}`;

    if (j === i) {
      // 自分の席 → 統率者税と、長押しで出る「自分の統率者ダメージ」
      cell.classList.add('own');
      Object.assign(cell.dataset, { act: 'selfdmg', p: String(i), hold: '1', rep: '0' });
      ref.ownCell = cell;

      if (S.settings.showTax) {
        for (let c = 0; c < op.commanders; c++) {
          const st = stepper('統率者税', { act: 'tax', p: String(i), c: String(c) },
            { step: 2, short: '税', mark: op.commanders > 1 ? COMMANDER_MARK[c] : null });
          ref.tax[c] = st;
          cell.appendChild(st.wrap);
          chips++;
        }
      }

      // 自分の統率者を奪われて殴られた場合。稀なので既定では隠しておく
      for (let c = 0; c < op.commanders; c++) {
        const st = stepper('自分の統率者', { act: 'dmg', p: String(i), s: String(i), c: String(c) },
          { dotColor: colorOf(op), short: '自分', mark: op.commanders > 1 ? COMMANDER_MARK[c] : null });
        st.wrap.classList.add('self-dmg');
        ref.dmg[i][c] = st;
        cell.appendChild(st.wrap);
      }
    } else {
      // 相手の席 → その相手の統率者から受けたダメージ
      for (let c = 0; c < op.commanders; c++) {
        const st = stepper(op.name, { act: 'dmg', p: String(i), s: String(j), c: String(c) },
          { dotColor: colorOf(op), mark: op.commanders > 1 ? COMMANDER_MARK[c] : null });
        ref.dmg[j][c] = st;
        cell.appendChild(st.wrap);
        chips++;
      }
    }

    wrap.appendChild(cell);
  });

  // チップが多い席は一回り小さくして収める
  if (chips >= 8) wrap.classList.add('dense');
  return wrap;
}

/* 90/270度回転したパネルへ、セルの実寸を渡す */
const seatObserver = new ResizeObserver(entries => {
  for (const e of entries) {
    const r = e.contentRect;
    e.target.style.setProperty('--sw', r.width + 'px');
    e.target.style.setProperty('--sh', r.height + 'px');
  }
});
function observeSeat(seat) { seatObserver.observe(seat); }

/* 座席マップの実寸に応じて、チップの詰め方を段階的に切り替える。
   狭いマスに無理やり名前を出して、文字が ± ボタンに重なるのを防ぐ。

   判定に使う need / avail は tight クラスの有無で変わらない値だけで組み立てている
   (tight は名前の max-width を 0 にするだけ)。付け外しが交互に繰り返されるのを防ぐため。 */
const cmdObserver = new ResizeObserver(entries => {
  for (const e of entries) {
    const wrap = e.target;
    const cols = Number(wrap.dataset.cols) || 1;
    const cellWidth = (e.contentRect.width - (cols - 1) * 6) / cols;

    // まず極端に狭いときはボタンと数値ごと一段小さくする
    wrap.classList.toggle('xtight', cellWidth < 104);
    // 自分の席だけチップが増える (統率者税 + 自分の統率者ダメージ) ので、
    // 横に余裕があれば 2 列に並べて縦のはみ出しを防ぐ。
    // 自分の席は複数列にまたがることがあるので、均等割りではなく実寸で測る。
    const ownCell = wrap.querySelector('.cmd-cell.own');
    wrap.classList.toggle('own2col', !!ownCell && ownCell.offsetWidth >= 260);

    // 名前が実際に入りきるかを測って決める
    let need = 0, avail = Infinity;
    wrap.querySelectorAll('.stepper').forEach(st => {
      if (!st.offsetParent) return;   // 隠れているチップ (自分の統率者ダメージ) は測らない
      const core = st.querySelector('.st-core');
      const name = st.querySelector('.st-name');
      if (!core || !name) return;
      const extras = [...st.querySelectorAll('.st-dot, .st-mark')]
        .reduce((sum, x) => sum + x.offsetWidth + 4, 0);
      need = Math.max(need, name.scrollWidth);
      avail = Math.min(avail, core.clientWidth - extras);
    });
    if (avail !== Infinity) wrap.classList.toggle('tight', need > avail);
  }
});

/* --------------------------------------------------------------------------
   表示更新
   -------------------------------------------------------------------------- */

function update() {
  activePlayers().forEach((p, i) => {
    const r = refs[i];
    if (!r) return;

    r.name.textContent = p.name;
    r.panel.style.setProperty('--accent', colorOf(p));

    const text = String(p.life);
    if (r.lifeNum.textContent !== text) {
      r.lifeNum.textContent = text;
      // 桁数が変わったときだけ測り直す (毎タップの再計測を避ける)
      if (r.lifeLen !== text.length) { r.lifeLen = text.length; fitLifeNumber(r); }
    }
    r.life.classList.toggle('low', p.life > 0 && p.life <= 5);
    r.life.classList.toggle('out', p.life <= 0);

    if (r.monarch) r.monarch.classList.toggle('on', S.monarch === i);
    if (r.ascend) r.ascend.classList.toggle('on', p.ascend);

    let lethal = p.life <= 0;

    COUNTERS.forEach(c => {
      const st = r.counters[c.key];
      if (!st) return;
      const v = p[c.key];
      st.val.textContent = String(v);
      st.wrap.classList.toggle('zero', v === 0);
      const hot = c.hotAt != null && v >= c.hotAt;
      st.wrap.classList.toggle('hot', hot);
      if (hot) lethal = true;
    });

    activePlayers().forEach((op, j) => {
      for (let c = 0; c < op.commanders; c++) {
        const st = r.dmg[j][c];
        if (!st) continue;
        const v = p.dmg[j][c];
        st.val.textContent = String(v);
        st.wrap.classList.toggle('zero', v === 0);
        const hot = v >= 21;
        st.wrap.classList.toggle('hot', hot);
        if (hot) lethal = true;
      }
    });

    r.tax.forEach((st, c) => {
      if (!st) return;
      st.val.textContent = String(p.tax[c]);
      st.wrap.classList.toggle('zero', p.tax[c] === 0);
    });

    // 自分の統率者ダメージは、長押しで出したときか 1 以上あるときだけ見せる
    if (r.ownCell) {
      const selfTotal = p.dmg[i].slice(0, p.commanders).reduce((a, b) => a + b, 0);
      r.ownCell.classList.toggle('reveal', p.showSelfDmg || selfTotal > 0);
    }

    r.panel.classList.toggle('dead', lethal);
  });
}

/* --------------------------------------------------------------------------
   値の操作 + 履歴
   -------------------------------------------------------------------------- */

function pushHistory(entry) {
  entry.t = Date.now();
  S.history.unshift(entry);
  if (S.history.length > HISTORY_LIMIT) S.history.length = HISTORY_LIMIT;
}

function doAction(node) {
  const d = node.dataset;
  const i = Number(d.p);
  const p = S.players[i];
  if (!p) return;
  const delta = Number(d.d || 0);

  switch (d.act) {
    case 'life': {
      const from = p.life;
      p.life = clamp(from + delta, -999, 9999);
      if (p.life !== from) {
        pushHistory({ act: 'life', p: i, from, to: p.life });
        noteLifeChange(i, p.life - from);
      }
      break;
    }
    case 'ctr': {
      const cfg = COUNTERS.find(c => c.key === d.key);
      const from = p[d.key];
      p[d.key] = clamp(from + delta, cfg.min, cfg.max);
      if (p[d.key] !== from) pushHistory({ act: 'ctr', p: i, key: d.key, from, to: p[d.key] });
      break;
    }
    case 'dmg': {
      const s = Number(d.s), c = Number(d.c);
      const from = p.dmg[s][c];
      const to = clamp(from + delta, 0, 99);
      if (to === from) break;
      p.dmg[s][c] = to;
      const entry = { act: 'dmg', p: i, s, c, from, to };
      if (S.settings.linkCommanderDamage) {
        entry.lifeFrom = p.life;
        p.life = clamp(p.life - (to - from), -999, 9999);
        entry.lifeTo = p.life;
        noteLifeChange(i, entry.lifeTo - entry.lifeFrom);
      }
      pushHistory(entry);
      break;
    }
    case 'tax': {
      const c = Number(d.c);
      const from = p.tax[c];
      p.tax[c] = clamp(from + delta, 0, 99);
      if (p.tax[c] !== from) pushHistory({ act: 'tax', p: i, c, from, to: p.tax[c] });
      break;
    }
    case 'monarch': {
      const from = S.monarch;
      const to = from === i ? null : i;
      S.monarch = to;
      pushHistory({ act: 'monarch', from, to });
      break;
    }
    case 'ascend': {
      const from = p.ascend;
      p.ascend = !from;
      pushHistory({ act: 'ascend', p: i, from, to: p.ascend });
      break;
    }
    case 'selfdmg': {
      // 統率者税欄の長押し → 自分の統率者ダメージ欄の表示切り替え
      const selfTotal = p.dmg[i].slice(0, p.commanders).reduce((a, b) => a + b, 0);
      p.showSelfDmg = !p.showSelfDmg;
      update();
      save();
      toast(p.showSelfDmg ? '自分の統率者ダメージを表示しました'
        : selfTotal > 0 ? '0 になるまでは表示したままになります'
        : '自分の統率者ダメージを隠しました');
      return;
    }
    case 'name':
      renamePlayer(i);
      return;
    default:
      return;
  }

  update();
  save();
}

function undo() {
  const e = S.history.shift();
  if (!e) { toast('取り消せる操作がありません'); return; }
  const p = S.players[e.p];
  switch (e.act) {
    case 'life':
      p.life = e.from;
      noteLifeChange(e.p, e.from - e.to);
      break;
    case 'ctr': p[e.key] = e.from; break;
    case 'dmg':
      p.dmg[e.s][e.c] = e.from;
      if (e.lifeFrom != null) {
        p.life = e.lifeFrom;
        noteLifeChange(e.p, e.lifeFrom - e.lifeTo);
      }
      break;
    case 'tax': p.tax[e.c] = e.from; break;
    case 'monarch': S.monarch = e.from; break;
    case 'ascend': p.ascend = e.from; break;
  }
  update();
  save();
  toast('1つ戻しました');
}

/* 履歴 1 件の説明文 */
function describe(e) {
  const nameOf = i => (S.players[i] ? S.players[i].name : `P${i + 1}`);
  switch (e.act) {
    case 'life': return { who: nameOf(e.p), what: 'ライフ', delta: e.to - e.from, tail: `${e.from} → ${e.to}` };
    case 'ctr': {
      const cfg = COUNTERS.find(c => c.key === e.key);
      return { who: nameOf(e.p), what: cfg ? cfg.label : e.key, delta: e.to - e.from, tail: `${e.from} → ${e.to}` };
    }
    case 'dmg': {
      const src = S.players[e.s];
      const mark = src && src.commanders > 1 ? ` ${COMMANDER_MARK[e.c]}` : '';
      const life = e.lifeFrom != null ? ` / ライフ ${e.lifeFrom} → ${e.lifeTo}` : '';
      const from = e.s === e.p ? '自分の統率者' : nameOf(e.s);
      return {
        who: nameOf(e.p),
        what: `統率者ダメージ (${from}${mark})`,
        delta: e.to - e.from,
        tail: `${e.from} → ${e.to}${life}`,
      };
    }
    case 'tax': return { who: nameOf(e.p), what: '統率者税', delta: e.to - e.from, tail: `${e.from} → ${e.to}` };
    case 'monarch': return { who: e.to == null ? '—' : nameOf(e.to), what: '統治者', delta: 0, tail: e.to == null ? '解除' : '獲得' };
    case 'ascend': return { who: nameOf(e.p), what: '昇殿', delta: 0, tail: e.to ? 'ON' : 'OFF' };
    default: return { who: '', what: e.act, delta: 0, tail: '' };
  }
}

/* --------------------------------------------------------------------------
   入力: 1タップ即反映 + 長押しリピート
   -------------------------------------------------------------------------- */

let repeatTimer = 0, repeatDelay = 0, repeatNode = null;

function stopRepeat() {
  clearTimeout(repeatDelay);
  clearInterval(repeatTimer);
  repeatDelay = repeatTimer = 0;
  repeatNode = null;
}

const HOLD_MS = 550;

board.addEventListener('pointerdown', e => {
  const node = e.target.closest('[data-act]');
  if (!node) return;
  e.preventDefault();

  // 長押しでのみ発火する操作 (滅多に使わないので誤爆させない)
  if (node.dataset.hold === '1') {
    repeatDelay = setTimeout(() => { doAction(node); stopRepeat(); }, HOLD_MS);
    return;
  }

  doAction(node);
  if (node.dataset.rep === '0') return;
  repeatNode = node;
  repeatDelay = setTimeout(() => {
    repeatTimer = setInterval(() => {
      if (repeatNode) doAction(repeatNode);
    }, 90);
  }, 420);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
  window.addEventListener(t, stopRepeat));
board.addEventListener('contextmenu', e => e.preventDefault());

/* --------------------------------------------------------------------------
   ダイアログ
   -------------------------------------------------------------------------- */

function dialog({ title, message, input = false, value = '', okText = 'OK' }) {
  const ov = $('#dialogOverlay');
  $('#dlgTitle').textContent = title;
  $('#dlgMessage').textContent = message || '';
  $('#dlgMessage').hidden = !message;
  const inp = $('#dlgInput');
  inp.hidden = !input;
  inp.className = 'text-input';
  inp.value = value;
  $('#dlgOk').textContent = okText;
  ov.hidden = false;
  if (input) setTimeout(() => { inp.focus(); inp.select(); }, 30);

  return new Promise(resolve => {
    const done = result => {
      ov.hidden = true;
      $('#dlgOk').removeEventListener('click', onOk);
      $('#dlgCancel').removeEventListener('click', onCancel);
      inp.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onOk = () => done(input ? inp.value.trim() : true);
    const onCancel = () => done(null);
    const onKey = ev => { if (ev.key === 'Enter') onOk(); if (ev.key === 'Escape') onCancel(); };
    $('#dlgOk').addEventListener('click', onOk);
    $('#dlgCancel').addEventListener('click', onCancel);
    inp.addEventListener('keydown', onKey);
  });
}

async function renamePlayer(i) {
  const name = await dialog({
    title: 'プレイヤー名',
    input: true,
    value: S.players[i].name,
  });
  if (name == null) return;
  S.players[i].name = name || `プレイヤー${i + 1}`;
  buildBoard();
  save();
}

/* --------------------------------------------------------------------------
   タイマー / 時計
   -------------------------------------------------------------------------- */

function elapsedMs() {
  const t = S.timer;
  return t.base + (t.running ? Date.now() - t.startedAt : 0);
}

function fmtElapsed(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function toggleTimer() {
  const t = S.timer;
  if (t.running) {
    t.base = elapsedMs();
    t.running = false;
  } else {
    t.startedAt = Date.now();
    t.running = true;
  }
  renderClock();
  save();
}

function renderClock() {
  const now = new Date();
  $('#clock').textContent =
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tEl = $('#timer');
  tEl.textContent = fmtElapsed(elapsedMs());
  tEl.classList.toggle('running', S.timer.running);
  $('#btnTimerIcon').textContent = S.timer.running ? '❚❚' : '▶';
}

setInterval(renderClock, 500);

/* --------------------------------------------------------------------------
   画面を常にオン (Screen Wake Lock)
   -------------------------------------------------------------------------- */

let wakeLock = null;

async function refreshWakeLock() {
  const want = S.settings.keepAwake && document.visibilityState === 'visible';
  if (want && !wakeLock) {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      console.warn('Wake Lock を取得できませんでした', err);
    }
  } else if (!want && wakeLock) {
    try { await wakeLock.release(); } catch (_) { /* 解放済み */ }
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', refreshWakeLock);

/* --------------------------------------------------------------------------
   ゲームリセット
   -------------------------------------------------------------------------- */

async function resetGame() {
  const ok = await dialog({
    title: 'ゲームをリセット',
    message: 'ライフ・各カウンター・統率者ダメージ・経過時間・履歴をすべて初期化します。プレイヤー名と設定は残ります。',
    okText: 'リセット',
  });
  if (!ok) return;

  S.players.forEach(p => {
    p.life = S.settings.startingLife;
    p.poison = p.energy = p.exp = p.speed = p.ring = 0;
    p.ascend = false;
    p.tax = [0, 0];
    p.dmg = Array.from({ length: MAX_PLAYERS }, () => [0, 0]);
    p.showSelfDmg = false;
  });
  S.monarch = null;
  S.timer = { running: false, base: 0, startedAt: 0 };
  S.history = [];
  clearLifeDeltas();
  update();
  renderClock();
  save();
  toast('リセットしました');
}

/* --------------------------------------------------------------------------
   履歴画面
   -------------------------------------------------------------------------- */

function renderHistory() {
  const list = $('#historyList');
  list.textContent = '';
  if (!S.history.length) {
    const li = el('li', '');
    li.appendChild(el('div', 'empty', 'まだ履歴はありません'));
    list.appendChild(li);
    return;
  }
  S.history.forEach(e => {
    const d = describe(e);
    const li = el('li');
    const time = new Date(e.t);
    li.appendChild(el('span', 'h-time',
      `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`));
    const who = el('span', 'h-who', d.who);
    if (e.p != null && S.players[e.p]) who.style.color = colorOf(S.players[e.p]);
    li.appendChild(who);
    li.appendChild(el('span', 'h-what', `${d.what}  ${d.tail}`));
    const delta = el('span', 'h-delta', d.delta ? (d.delta > 0 ? `+${d.delta}` : `${d.delta}`) : '');
    delta.classList.add(d.delta > 0 ? 'plus' : 'minus');
    li.appendChild(delta);
    list.appendChild(li);
  });
}

/* --------------------------------------------------------------------------
   設定画面
   -------------------------------------------------------------------------- */

function field(title) {
  const f = el('div', 'field');
  const l = el('label', 'title', title);
  f.appendChild(l);
  return f;
}

function chipGroup(values, current, onPick, fmt = v => v) {
  const wrap = el('div', 'chips');
  values.forEach(v => {
    const b = el('button', 'chip', fmt(v));
    b.setAttribute('aria-pressed', String(v === current));
    b.addEventListener('click', () => onPick(v));
    wrap.appendChild(b);
  });
  return wrap;
}

function toggleRow(label, desc, get, set) {
  const row = el('div', 'toggle-row');
  const left = el('div');
  left.appendChild(el('div', '', label));
  if (desc) left.appendChild(el('div', 'desc', desc));
  const sw = el('button', 'switch');
  sw.setAttribute('aria-pressed', String(get()));
  sw.addEventListener('click', () => {
    set(!get());
    sw.setAttribute('aria-pressed', String(get()));
  });
  row.append(left, sw);
  return row;
}

function layoutPreview(layout) {
  const lp = el('div', 'lp');
  lp.style.gridTemplateColumns = layout.cols;
  lp.style.gridTemplateRows = layout.rows;
  layout.seats.forEach(([r1, c1, r2, c2, rot]) => {
    const s = el('span');
    s.style.gridArea = `${r1} / ${c1} / ${r2} / ${c2}`;
    s.dataset.r = String(rot);
    lp.appendChild(s);
  });
  return lp;
}

function renderSettings() {
  const body = $('#settingsBody');
  body.textContent = '';
  const st = S.settings;

  // --- プレイヤー人数 ---
  const fCount = field('プレイヤー人数');
  fCount.appendChild(chipGroup([2, 3, 4, 5, 6], st.playerCount, n => {
    st.playerCount = n;
    if (S.monarch != null && S.monarch >= n) S.monarch = null;
    buildBoard();
    save();
    renderSettings();
  }, n => `${n}人`));
  body.appendChild(fCount);

  // --- 初期ライフ ---
  const fLife = field('初期ライフ');
  const lifeChips = chipGroup([20, 25, 30, 40, 50], st.startingLife, v => applyStartingLife(v));
  const custom = el('input', 'num-input');
  custom.type = 'number';
  custom.value = st.startingLife;
  custom.min = '1';
  custom.max = '999';
  custom.addEventListener('change', () => {
    const v = clamp(parseInt(custom.value, 10) || 40, 1, 999);
    applyStartingLife(v);
  });
  lifeChips.appendChild(custom);
  fLife.appendChild(lifeChips);
  body.appendChild(fLife);

  // --- レイアウト ---
  const fLayout = field(`メイン画面レイアウト (${st.playerCount}人用)`);
  const opts = el('div', 'layouts');
  LAYOUTS[st.playerCount].forEach(l => {
    const b = el('button', 'layout-opt');
    b.setAttribute('aria-pressed', String(l.id === currentLayout().id));
    b.appendChild(layoutPreview(l));
    b.appendChild(el('div', 'cap', l.name));
    b.addEventListener('click', () => {
      st.layout[st.playerCount] = l.id;
      buildBoard();
      save();
      renderSettings();
    });
    opts.appendChild(b);
  });
  fLayout.appendChild(opts);
  fLayout.appendChild(el('div', 'note', 'プレビューの帯は、その席のプレイヤーが座る側 (画面の下向き = 手前) を表します。'));
  body.appendChild(fLayout);

  // --- プレイヤー ---
  const fPlayers = field('プレイヤー');
  const table = el('div', 'ptable');
  activePlayers().forEach((p, i) => {
    const row = el('div', 'prow');

    const dot = el('span', 'pdot');
    dot.style.background = colorOf(p);
    row.appendChild(dot);

    const nameInput = el('input', 'text-input');
    nameInput.type = 'text';
    nameInput.value = p.name;
    nameInput.maxLength = 16;
    nameInput.addEventListener('change', () => {
      p.name = nameInput.value.trim() || `プレイヤー${i + 1}`;
      buildBoard();
      save();
    });
    row.appendChild(nameInput);

    const colors = el('div', 'pcolors');
    COLORS.forEach((c, ci) => {
      const b = el('button', 'pcolor');
      b.style.background = c.hex;
      b.title = c.name;
      b.setAttribute('aria-pressed', String(ci === p.color));
      b.addEventListener('click', () => {
        p.color = ci;
        dot.style.background = c.hex;
        colors.querySelectorAll('.pcolor').forEach((x, xi) =>
          x.setAttribute('aria-pressed', String(xi === ci)));
        buildBoard();
        save();
      });
      colors.appendChild(b);
    });
    row.appendChild(colors);

    const seg = el('div', 'seg');
    [1, 2].forEach(n => {
      const b = el('button', '', n === 1 ? '統率者1' : '共闘2');
      b.setAttribute('aria-pressed', String(p.commanders === n));
      b.addEventListener('click', () => {
        p.commanders = n;
        buildBoard();
        save();
        renderSettings();
      });
      seg.appendChild(b);
    });
    row.appendChild(seg);

    table.appendChild(row);
  });
  fPlayers.appendChild(table);
  fPlayers.appendChild(el('div', 'note', '「共闘2」にすると、そのプレイヤーの統率者ダメージ枠と統率者税が A / B の2つに分かれます。'));
  body.appendChild(fPlayers);

  // --- 表示するカウンター ---
  const fVis = field('メイン画面に表示するカウンター');
  COUNTERS.forEach(c => {
    fVis.appendChild(toggleRow(c.label.replace(/^\S+\s/, ''), null,
      () => st.visibleCounters[c.key],
      v => { st.visibleCounters[c.key] = v; buildBoard(); save(); }));
  });
  fVis.appendChild(toggleRow('統率者税', null, () => st.showTax,
    v => { st.showTax = v; buildBoard(); save(); }));
  fVis.appendChild(toggleRow('統治者', null, () => st.showMonarch,
    v => { st.showMonarch = v; buildBoard(); save(); }));
  fVis.appendChild(toggleRow('昇殿', null, () => st.showAscend,
    v => { st.showAscend = v; buildBoard(); save(); }));
  fVis.appendChild(el('div', 'note', '使わないカウンターを隠すと、1つあたりのボタンが大きくなり押しやすくなります。'));
  body.appendChild(fVis);

  // --- 動作 ---
  const fMisc = field('動作');
  fMisc.appendChild(toggleRow('統率者ダメージでライフを自動増減',
    '統率者ダメージを +1 すると、そのプレイヤーのライフが自動で −1 されます。',
    () => st.linkCommanderDamage,
    v => { st.linkCommanderDamage = v; save(); }));
  fMisc.appendChild(toggleRow('ライフの ±5 ボタンを表示', null,
    () => st.showBig5,
    v => { st.showBig5 = v; buildBoard(); save(); }));
  fMisc.appendChild(toggleRow('画面を常にオンにする',
    'wakeLock' in navigator ? 'ゲーム中に画面が消灯しなくなります。' : 'この端末のブラウザは未対応です。',
    () => st.keepAwake,
    v => { st.keepAwake = v; save(); refreshWakeLock(); }));
  body.appendChild(fMisc);

  // --- データ ---
  const fData = field('データ');
  const wipe = el('button', 'btn', 'すべての設定とデータを初期化');
  wipe.addEventListener('click', async () => {
    const ok = await dialog({
      title: 'すべて初期化',
      message: 'プレイヤー名・色・設定を含め、保存内容をすべて消去して初期状態に戻します。',
      okText: '初期化',
    });
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    S = defaultState();
    buildBoard();
    renderSettings();
    renderClock();
    save();
    toast('初期化しました');
  });
  fData.appendChild(wipe);
  body.appendChild(fData);
}

async function applyStartingLife(v) {
  S.settings.startingLife = v;
  save();
  const ok = await dialog({
    title: '初期ライフを変更',
    message: `初期ライフを ${v} にしました。現在のライフも全員 ${v} にしますか？`,
    okText: '今すぐ反映',
  });
  if (ok) {
    S.players.forEach(p => { p.life = v; });
    update();
    save();
  }
  renderSettings();
}

/* --------------------------------------------------------------------------
   画面まわりの配線
   -------------------------------------------------------------------------- */

function openOverlay(id) { $('#' + id).hidden = false; }
function closeOverlay(id) { $('#' + id).hidden = true; }

document.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => closeOverlay(b.dataset.close)));

$('#btnSettings').addEventListener('click', () => { renderSettings(); openOverlay('settingsOverlay'); });
$('#btnHistory').addEventListener('click', () => { renderHistory(); openOverlay('historyOverlay'); });
$('#btnUndo').addEventListener('click', undo);
$('#btnUndo2').addEventListener('click', () => { undo(); renderHistory(); });
$('#btnClearHistory').addEventListener('click', async () => {
  const ok = await dialog({ title: '履歴を消去', message: '入力履歴をすべて消去します。盤面の数値は変わりません。', okText: '消去' });
  if (!ok) return;
  S.history = [];
  renderHistory();
  save();
});
$('#btnReset').addEventListener('click', resetGame);
$('#btnTimer').addEventListener('click', toggleTimer);
$('#btnTimerReset').addEventListener('click', async () => {
  const ok = await dialog({ title: '経過時間をリセット', message: '経過時間を 00:00 に戻します。', okText: 'リセット' });
  if (!ok) return;
  S.timer = { running: false, base: 0, startedAt: 0 };
  renderClock();
  save();
});

// 連打時の意図しないズーム・選択を抑止 (設定画面の入力欄には影響させない)
document.addEventListener('gesturestart', e => e.preventDefault());
board.addEventListener('dblclick', e => e.preventDefault());

/* --------------------------------------------------------------------------
   起動
   -------------------------------------------------------------------------- */

buildBoard();
renderClock();
refreshWakeLock();

// オフライン動作用の Service Worker (http/https で配信した場合のみ)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err =>
      console.warn('Service Worker を登録できませんでした', err));
  });
}
