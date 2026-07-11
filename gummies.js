/* gummies.js — 夜空に浮かぶサワーグミ & ぷにサウンド 🍬🌙
   使い方: 各ページの </body> の直前に
   <script src="gummies.js"></script> を入れるだけ */
(function () {
  const SHAPES = {
    star:   '<path d="M50 4 L61 37 L96 37 L68 58 L78 92 L50 72 L22 92 L32 58 L4 37 L39 37 Z"/>',
    bolt:   '<path d="M58 3 L22 55 L44 55 L38 97 L78 40 L54 40 Z"/>',
    square: '<rect x="14" y="14" width="72" height="72" rx="14"/>',
    sword:  '<path d="M50 2 L59 16 L59 54 L41 54 L41 16 Z"/><rect x="28" y="54" width="44" height="9" rx="4"/><rect x="45" y="63" width="10" height="22" rx="4"/><circle cx="50" cy="90" r="8"/>',
    heart:  '<path d="M50 88 C20 65 6 45 12 28 C17 13 36 10 50 26 C64 10 83 13 88 28 C94 45 80 65 50 88 Z"/>',
    ring:   '<path d="M50 8 A42 42 0 1 0 50 92 A42 42 0 1 0 50 8 Z M50 30 A20 20 0 1 1 50 70 A20 20 0 1 1 50 30 Z" fill-rule="evenodd"/>'
  };
  const COLORS = ["#ff5f7e", "#ff9f43", "#ffd93a", "#57d95e", "#45c8ff", "#b06bff"];
  const COUNT = 14;              // グミの数(好みで増減OK)
  const RESPAWN_MS = 5000;       // ポップ後に新しいグミが生えるまでの時間
  const HOVER_COOLDOWN = 150;    // ホバー音の全体クールダウン(ms)
  const HOVER_SELF_COOLDOWN = 600; // 同じグミの連続ホバー音防止(ms)

  // ===== 🔊 「ぷに」サウンド(Web Audio APIで合成、音声ファイル不要) =====
  let audioCtx = null;
  let lastHoverSound = 0;

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function blip(ctx, start, f1, f2, dur, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f1, start);
    osc.frequency.exponentialRampToValueAtTime(f2, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
  // クリック用:「ぷ」↘ + 「に」↗
  function puniSound() {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      const wobble = 0.9 + Math.random() * 0.25;
      blip(ctx, t,        300 * wobble, 170 * wobble, 0.09, 0.22);
      blip(ctx, t + 0.08, 480 * wobble, 700 * wobble, 0.13, 0.20);
    } catch (e) { /* 音が出せない環境では黙ってスキップ */ }
  }
  // ホバー用: 短くて控えめな1音「ぷに♪」
  function hoverPuni() {
    try {
      const ctx = getCtx();
      // 最初のクリック前はブラウザが音を止めるので鳴らさない
      if (ctx.state !== "running") return;
      const now = performance.now();
      if (now - lastHoverSound < HOVER_COOLDOWN) return;
      lastHoverSound = now;
      const t = ctx.currentTime;
      const wobble = 0.85 + Math.random() * 0.35;
      blip(ctx, t, 350 * wobble, 560 * wobble, 0.08, 0.09);
    } catch (e) { /* 音が出せない環境では黙ってスキップ */ }
  }

  // 砂糖コーティング用フィルター(1回だけ定義)
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.style.position = "absolute";
  defs.innerHTML = `
    <filter id="sugar-coat" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise"/>
      <feColorMatrix in="noise" type="matrix"
        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" result="grain"/>
      <feComposite in="grain" in2="SourceGraphic" operator="in" result="sugar"/>
      <feMerge>
        <feMergeNode in="SourceGraphic"/>
        <feMergeNode in="sugar"/>
      </feMerge>
    </filter>`;
  document.body.appendChild(defs);

  // ===== スタイル(グミのアニメーションのみ — 背景はサイトのまま) =====
  const style = document.createElement("style");
  style.textContent = `
    .gummy-layer { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .gummy {
      position: absolute;
      opacity: 0.85;
      pointer-events: auto;
      cursor: pointer;
      animation: gummyFloat ease-in-out infinite alternate;
    }
    .gummy svg { display: block; }
    .gummy:hover svg { animation: gummyJiggle 0.45s ease-in-out infinite; }

    .gummy.popping { animation: none; pointer-events: none; }
    .gummy.popping svg { animation: gummyPop 0.35s ease-out forwards; }

    .gummy.spawning svg { animation: gummySpawn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }

    .sugar-bit {
      position: fixed;
      width: 7px; height: 7px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 4;
      animation: sugarFly 0.6s ease-out forwards;
    }

    @keyframes gummyFloat {
      from { transform: translateY(0) rotate(var(--rot)); }
      to   { transform: translateY(-14px) rotate(calc(var(--rot) + 8deg)); }
    }
    @keyframes gummyJiggle {
      0%   { transform: scale(1, 1) rotate(0deg); }
      25%  { transform: scale(1.15, 0.85) rotate(-6deg); }
      50%  { transform: scale(0.88, 1.12) rotate(5deg); }
      75%  { transform: scale(1.08, 0.92) rotate(-3deg); }
      100% { transform: scale(1, 1) rotate(0deg); }
    }
    @keyframes gummyPop {
      0%   { transform: scale(1); opacity: 1; }
      40%  { transform: scale(1.35); opacity: 1; }
      100% { transform: scale(0); opacity: 0; }
    }
    @keyframes gummySpawn {
      from { transform: scale(0); }
      to   { transform: scale(1); }
    }
    @keyframes sugarFly {
      from { transform: translate(0, 0) scale(1); opacity: 1; }
      to   { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gummy, .gummy:hover svg { animation: none; }
    }
  `;
  document.head.appendChild(style);

  const layer = document.createElement("div");
  layer.className = "gummy-layer";
  const names = Object.keys(SHAPES);

  // 砂糖の粒が飛び散るエフェクト
  function burst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const bit = document.createElement("div");
      bit.className = "sugar-bit";
      bit.style.left = x + "px";
      bit.style.top = y + "px";
      bit.style.background = i % 3 === 0 ? "#ffffff" : color;
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.6;
      const dist = 30 + Math.random() * 40;
      bit.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      bit.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      document.body.appendChild(bit);
      setTimeout(() => bit.remove(), 650);
    }
  }

  // グミを1つ作る
  function makeGummy(shapeName, isRespawn) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 36 + Math.random() * 54; // 36〜90px
    const wrap = document.createElement("div");
    wrap.className = "gummy" + (isRespawn ? " spawning" : "");
    wrap.style.left = Math.random() * 92 + "%";
    wrap.style.top = Math.random() * 90 + "%";
    wrap.style.setProperty("--rot", (Math.random() * 360) + "deg");
    wrap.style.animationDuration = (3 + Math.random() * 3) + "s";
    wrap.style.animationDelay = (Math.random() * 3) + "s";
    wrap.innerHTML =
      `<svg width="${size}" height="${size}" viewBox="0 0 100 100"
            fill="${color}" filter="url(#sugar-coat)">${SHAPES[shapeName]}</svg>`;

    // ホバーで「ぷに♪」(このグミ自身にもクールダウンあり)
    let lastSelfSound = 0;
    wrap.addEventListener("mouseenter", () => {
      if (wrap.classList.contains("popping")) return;
      const now = performance.now();
      if (now - lastSelfSound < HOVER_SELF_COOLDOWN) return;
      lastSelfSound = now;
      hoverPuni();
    });

    // クリックで「ぷに♪」→ ポップ💥 → しばらくして別の場所に復活
    wrap.addEventListener("click", () => {
      if (wrap.classList.contains("popping")) return;
      puniSound();
      const rect = wrap.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, color);
      wrap.classList.add("popping");
      setTimeout(() => wrap.remove(), 400);
      setTimeout(() => layer.appendChild(makeGummy(shapeName, true)), RESPAWN_MS);
    });

    if (isRespawn) setTimeout(() => wrap.classList.remove("spawning"), 450);
    return wrap;
  }

  for (let i = 0; i < COUNT; i++) {
    layer.appendChild(makeGummy(names[i % names.length], false));
  }
  document.body.prepend(layer);
})();
