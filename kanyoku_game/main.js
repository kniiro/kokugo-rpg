/* ============================================
   国語克服バトルRPG — メインゲームロジック
   ============================================ */

// ─── ゲーム定数 ───
const ENEMIES = [
  { name: 'コラッタ', hp: 2, miss: 2, levels: [1], img: 'enemy1.png', boss: false },
  { name: 'ズバット', hp: 3, miss: 2, levels: [1], img: 'enemy2.png', boss: false },
  { name: 'ワンリキー', hp: 5, miss: 3, levels: [1, 2], img: 'enemy3.png', boss: false },
  { name: 'ゴースト', hp: 7, miss: 3, levels: [2], img: 'enemy4.png', boss: false },
  { name: 'カビゴン', hp: 10, miss: 3, levels: [2, 3], img: 'enemy5.png', boss: true },
  { name: 'ストライク', hp: 12, miss: 2, levels: [3], img: 'enemy6.png', boss: false },
  { name: 'ギャラドス', hp: 15, miss: 2, levels: [3, 4], img: 'enemy7.png', boss: false },
  { name: 'プテラ', hp: 15, miss: 1, levels: [4], img: 'enemy8.png', boss: false },
  { name: 'カイリュー', hp: 18, miss: 1, levels: [4, 5], img: 'enemy9.png', boss: false },
  { name: 'ミュウツー', hp: 20, miss: 1, levels: [5], img: 'enemy10.png', boss: true },
];

const NUM_CHOICES = 5; // 選択肢の数

// ─── ゲーム状態 ───
let gameState = {
  currentStage: 0,   // 0-indexed (マス1 = index 0)
  questions: [],      // CSVから読み込んだ全問題
  allies: [],         // 仲間にしたポケモン [{name, img}]

  // バトル中
  enemyHp: 0,
  enemyMaxHp: 0,
  playerMissCount: 0,
  playerMaxMiss: 0,

  // 出題管理
  usedQuestionIds: new Set(),
  currentQuestion: null,
  battleActive: false,

  // 再プレイ（クリア済みステージの再挑戦）
  replayStage: null,  // null=通常進行, number=再プレイ中のステージindex
};

// ─── 再プレイ対応ヘルパー ───
function getBattleStage() {
  return gameState.replayStage !== null ? gameState.replayStage : gameState.currentStage;
}

// ─── 進捗保存/復元 (localStorage) ───
function saveProgress() {
  const data = {
    currentStage: gameState.currentStage,
    allies: gameState.allies,
    usedQuestionIds: [...gameState.usedQuestionIds],
  };
  localStorage.setItem('kanyoku_save', JSON.stringify(data));
}

function loadProgress() {
  const raw = localStorage.getItem('kanyoku_save');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.currentStage >= ENEMIES.length) {
      // 全クリア済みデータは無視して最初から
      clearProgress();
      return false;
    }
    gameState.currentStage = data.currentStage || 0;
    gameState.allies = data.allies || [];
    gameState.usedQuestionIds = new Set(data.usedQuestionIds || []);
    return data.currentStage > 0; // ステージ0なら復帰不要
  } catch (e) {
    console.warn('セーブデータ読み込みエラー:', e);
    return false;
  }
}

function clearProgress() {
  localStorage.removeItem('kanyoku_save');
}

// ─── 初期化 ───
document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  setupEventListeners();

  // セーブデータがあれば途中から再開
  const hasProgress = loadProgress();
  if (hasProgress) {
    showScreen('screen-map');
    renderMap();

    const startMapBGMOnce = () => {
      soundManager.init();
      soundManager.resume();
      if (document.getElementById('screen-map').classList.contains('active')) {
        soundManager.playMapBGM();
      }
      document.removeEventListener('click', startMapBGMOnce);
      document.removeEventListener('touchstart', startMapBGMOnce);
    };
    document.addEventListener('click', startMapBGMOnce);
    document.addEventListener('touchstart', startMapBGMOnce);
  } else {
    showScreen('screen-title');

    // 初回タッチでタイトルBGM再生
    const startTitleBGMOnce = () => {
      soundManager.init();
      soundManager.resume();
      if (document.getElementById('screen-title').classList.contains('active')) {
        soundManager.playTitleBGM();
      }
      document.removeEventListener('click', startTitleBGMOnce);
      document.removeEventListener('touchstart', startTitleBGMOnce);
    };
    document.addEventListener('click', startTitleBGMOnce);
    document.addEventListener('touchstart', startTitleBGMOnce);
  }
});

// ─── CSV読み込み ───
async function loadQuestions() {
  let text = '';

  try {
    const res = await fetch('questions.csv');
    if (!res.ok) throw new Error('fetch failed');
    text = await res.text();
  } catch (e) {
    // file://プロトコルではfetchが使えないため、埋め込みデータを使用
    if (typeof QUESTIONS_CSV_DATA !== 'undefined') {
      console.log('📂 fetch失敗 → 埋め込みCSVデータを使用');
      text = QUESTIONS_CSV_DATA;
    } else {
      console.error('CSV読み込みエラー: fetchも埋め込みデータも利用不可', e);
      return;
    }
  }

  try {
    const lines = text.trim().split('\n');

    gameState.questions = lines.slice(1).map(line => {
      const cols = parseCSVLine(line);
      return {
        id: parseInt(cols[0]),
        level: parseInt(cols[1]),
        category: cols[2],
        question: cols[3],
        correct: cols[4],
        dummies: [cols[5], cols[6], cols[7], cols[8]],
      };
    });
    console.log(`✅ ${gameState.questions.length} 問 読み込み完了`);
  } catch (e) {
    console.error('CSVパースエラー:', e);
  }
}

/** RFC 4180 準拠の簡易CSVパーサ */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ─── イベントリスナー ───
function setupEventListeners() {
  document.getElementById('btn-start').addEventListener('click', () => {
    soundManager.init();
    soundManager.resume();
    soundManager.playClick();
    startGame();
  });
  document.getElementById('btn-next-battle').addEventListener('click', () => {
    soundManager.playClick();
    startBattle();
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    soundManager.playClick();
    resetGame();
    startGame();
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    soundManager.playClick();
    resetGame();
    startGame();
  });
  document.getElementById('btn-reset-progress').addEventListener('click', () => {
    soundManager.playClick();
    if (confirm('本当に最初からやりなおしますか？\n進捗データはすべて消えます。')) {
      resetGame();
      startGame();
    }
  });
  document.getElementById('btn-sub-continue').addEventListener('click', () => {
    soundManager.playClick();
    document.getElementById('modal-substitute').classList.add('hidden');
    showNextQuestion();
  });
  // 投げるボタンは廃止されたのでリスナーを削除
  document.getElementById('btn-skip-capture').addEventListener('click', () => {
    soundManager.playClick();
    skipCapture();
  });
}

// ─── 画面遷移 ───
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── ゲーム開始 ───
function startGame() {
  showScreen('screen-map');
  renderMap();
  soundManager.playMapBGM();
}

function resetGame() {
  gameState.currentStage = 0;
  gameState.allies = [];
  gameState.usedQuestionIds = new Set();
  gameState.battleActive = false;
  clearProgress();
}

// ─── マップ描画 ───
function renderMap() {
  const board = document.getElementById('map-board');
  board.innerHTML = '';

  ENEMIES.forEach((enemy, i) => {
    const tile = document.createElement('div');
    tile.className = 'map-tile';

    if (i < gameState.currentStage) {
      tile.classList.add('cleared');
    } else if (i === gameState.currentStage) {
      tile.classList.add('current');
    } else {
      tile.classList.add('locked');
    }

    const levelStr = enemy.levels.length > 1
      ? `Lv.${enemy.levels[0]}〜${enemy.levels[enemy.levels.length - 1]}`
      : `Lv.${enemy.levels[0]}`;

    tile.innerHTML = `
      <div class="tile-number">${i + 1}</div>
      <img class="tile-enemy-icon" src="images/${enemy.img}" alt="${enemy.name}"
           onerror="this.style.display='none'">
      <div class="tile-info">
        <div class="tile-enemy-name">${enemy.name}${enemy.boss ? ' ★' : ''}</div>
        <div class="tile-detail">HP:${enemy.hp} / ミス上限:${enemy.miss} / ${levelStr}</div>
      </div>
      <div class="tile-status ${i < gameState.currentStage ? 'done' : ''}">
        ${i < gameState.currentStage ? '✔' : i === gameState.currentStage ? '▶' : '🔒'}
      </div>
      ${i < gameState.currentStage ? '<div class="tile-replay-badge">🔄再プレイ</div>' : ''}
    `;

    // クリア済みタイルをタップで再プレイ
    if (i < gameState.currentStage) {
      tile.classList.add('replayable');
      tile.addEventListener('click', () => {
        soundManager.playClick();
        startReplay(i);
      });
    }

    board.appendChild(tile);
  });

  // 仲間表示
  renderAllyIcons('map-allies');

  // ボタン
  const btn = document.getElementById('btn-next-battle');
  if (gameState.currentStage >= ENEMIES.length) {
    btn.textContent = '冒険完了！';
    btn.disabled = true;
  } else {
    btn.textContent = `マス ${gameState.currentStage + 1} — ${ENEMIES[gameState.currentStage].name} に挑む！`;
    btn.disabled = false;
  }
}

// ─── 再プレイ開始 ───
function startReplay(stageIndex) {
  gameState.replayStage = stageIndex;
  startBattle();
}

function renderAllyIcons(elementId) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = gameState.allies.length === 0
    ? '<span style="font-size:0.6rem;">なし</span>'
    : gameState.allies.map(a =>
      `<img class="ally-icon" src="images/${a.img}" alt="${a.name}" title="${a.name}"
              onerror="this.textContent='🔵'; this.style.fontSize='14px';">`
    ).join('');
}

// ─── バトル開始 ───
function startBattle() {
  const stage = getBattleStage();
  if (stage >= ENEMIES.length) return;

  const enemy = ENEMIES[stage];
  gameState.enemyHp = enemy.hp;
  gameState.enemyMaxHp = enemy.hp;
  gameState.playerMissCount = 0;
  gameState.playerMaxMiss = enemy.miss;
  gameState.battleActive = true;

  showScreen('screen-battle');

  // 敵情報
  document.getElementById('enemy-name').textContent = enemy.name;

  // スプライトを完全リセット（前回のdefeatアニメやフォールバックをクリア）
  const spriteContainer = document.getElementById('enemy-sprite');
  spriteContainer.innerHTML = `<img id="enemy-img" src="images/${enemy.img}" alt="${enemy.name}">`;
  const enemyImg = document.getElementById('enemy-img');
  enemyImg.onerror = () => {
    const fallbacks = ['🐭', '🦇', '💪', '👻', '😴', '🦗', '🐉', '🦕', '🐲', '👾'];
    spriteContainer.innerHTML = `<span style="font-size:64px">${fallbacks[stage]}</span>`;
  };

  updateHpBars();
  renderAllyIcons('battle-allies');

  // バトル開始メッセージ
  const msg = document.getElementById('battle-message');
  const replayLabel = gameState.replayStage !== null ? '【再プレイ】 ' : '';
  msg.textContent = `${replayLabel}野生の ${enemy.name} が現れた！`;

  // バトルBGM（ステージに応じて切替）& 開始SE
  if (stage >= 9) {
    soundManager.playLastBossBGM();   // 10匹目（ミュウツー）
  } else if (stage >= 4) {
    soundManager.playBossBGM();       // 5〜9匹目
  } else {
    soundManager.playBattleBGM();     // 1〜4匹目
  }
  soundManager.playBattleStart();

  const questionArea = document.getElementById('question-area');
  questionArea.classList.add('hidden');

  // 少し待ってから問題表示
  setTimeout(() => {
    showNextQuestion();
  }, 1200);
}

// ─── HP バー更新 ───
function updateHpBars() {
  // 敵HP
  const enemyPercent = (gameState.enemyHp / gameState.enemyMaxHp) * 100;
  const enemyBar = document.getElementById('enemy-hp-bar');
  enemyBar.style.width = enemyPercent + '%';
  enemyBar.style.backgroundColor =
    enemyPercent > 50 ? 'var(--hp-green)' :
      enemyPercent > 20 ? 'var(--hp-yellow)' : 'var(--hp-red)';
  // 敵HP数値は非表示（バーのみ）

  // プレイヤー（残りミス数）
  const remaining = gameState.playerMaxMiss - gameState.playerMissCount;
  const playerPercent = (remaining / gameState.playerMaxMiss) * 100;
  const playerBar = document.getElementById('player-hp-bar');
  playerBar.style.width = playerPercent + '%';
  playerBar.style.backgroundColor =
    playerPercent > 50 ? 'var(--hp-green)' :
      playerPercent > 30 ? 'var(--hp-yellow)' : 'var(--hp-red)';
  document.getElementById('player-hp-text').textContent = `❤️ 残りミス: ${remaining} / ${gameState.playerMaxMiss}`;
}

// ─── 問題出題 ───
function showNextQuestion() {
  if (!gameState.battleActive) return;

  const enemy = ENEMIES[getBattleStage()];
  const availableLevels = enemy.levels;

  // 該当レベル & 未出題のものをフィルタ
  let pool = gameState.questions.filter(q =>
    availableLevels.includes(q.level) && !gameState.usedQuestionIds.has(q.id)
  );

  // プールが空になったら使用済みをリセット（同レベルのみ）
  if (pool.length === 0) {
    gameState.usedQuestionIds.clear();
    pool = gameState.questions.filter(q => availableLevels.includes(q.level));
  }

  // ランダム選択
  const q = pool[Math.floor(Math.random() * pool.length)];
  gameState.currentQuestion = q;
  gameState.usedQuestionIds.add(q.id);

  // 表示
  const questionArea = document.getElementById('question-area');
  questionArea.classList.remove('hidden');
  document.getElementById('question-category').textContent = q.category;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('battle-message').textContent = '問題に答えよう！';

  // 選択肢をシャッフル
  const allChoices = [q.correct, ...q.dummies];
  shuffleArray(allChoices);

  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  allChoices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => handleAnswer(btn, choice, q.correct));
    choicesDiv.appendChild(btn);
  });

  // iPhoneで設問が画面外に出ないよう自動スクロール
  questionArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── 回答処理 ───
function handleAnswer(btn, selected, correct) {
  if (!gameState.battleActive) return;

  // 全ボタン無効化
  const allBtns = document.querySelectorAll('.choice-btn');
  allBtns.forEach(b => {
    b.style.pointerEvents = 'none';
  });

  const isCorrect = selected === correct;

  if (isCorrect) {
    btn.classList.add('correct');
    onCorrectAnswer();
  } else {
    btn.classList.add('wrong');
    // 正解ボタンをハイライト
    allBtns.forEach(b => {
      if (b.textContent === correct) b.classList.add('correct');
    });
    onWrongAnswer();
  }
}

function onCorrectAnswer() {
  gameState.enemyHp--;
  updateHpBars();
  soundManager.playCorrect();
  soundManager.playHit();

  const sprite = document.getElementById('enemy-sprite');
  const spriteEl = sprite.querySelector('img, span');
  if (spriteEl) {
    spriteEl.classList.add('enemy-hit');
    setTimeout(() => spriteEl.classList.remove('enemy-hit'), 500);
  }

  const msg = document.getElementById('battle-message');
  msg.textContent = '⭕ 正解！ 敵に 1 ダメージ！';

  if (gameState.enemyHp <= 0) {
    // 敵撃破
    setTimeout(() => onEnemyDefeated(), 800);
  } else {
    setTimeout(() => showNextQuestion(), 1200);
  }
}

function onWrongAnswer() {
  gameState.playerMissCount++;
  updateHpBars();
  soundManager.playWrong();
  soundManager.playPlayerHit();

  const playerArea = document.querySelector('.battle-player-area');
  playerArea.classList.add('player-hit');
  setTimeout(() => playerArea.classList.remove('player-hit'), 600);

  const remaining = gameState.playerMaxMiss - gameState.playerMissCount;
  const msg = document.getElementById('battle-message');
  msg.textContent = `❌ 不正解… プレイヤーにダメージ！（残りミス: ${remaining}）`;

  if (remaining <= 0) {
    // HP 0 — 身代わりチェック
    if (gameState.allies.length > 0) {
      setTimeout(() => triggerSubstitute(), 1000);
    } else {
      setTimeout(() => onGameOver(), 1000);
    }
  } else {
    setTimeout(() => showNextQuestion(), 1500);
  }
}

// ─── 敵撃破 ───
function onEnemyDefeated() {
  gameState.battleActive = false;

  const sprite = document.getElementById('enemy-sprite');
  const el = sprite.querySelector('img, span');
  if (el) el.classList.add('enemy-defeat');

  const enemy = ENEMIES[getBattleStage()];
  const msg = document.getElementById('battle-message');
  msg.textContent = `🎉 ${enemy.name} を倒した！`;
  soundManager.playDefeat();

  document.getElementById('question-area').classList.add('hidden');

  // 少し待ってから捕獲モーダルを表示
  setTimeout(() => {
    showCaptureModal(enemy);
  }, 1500);
}

// ─── モンスターボール捕獲（3D物理シミュレーション） ───
let captureState = {
  isSwiping: false,
  isThrown: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  startTime: 0,
  lastTime: 0,
  velocities: [], // 直近の速度履歴を保持して精緻化
  ballX: 0,
  ballY: 0,
  ballZ: 1, // スケール（奥行き）
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
  gravity: 1.2, // 重力
  rotation: 0,
  animationFrame: null,
};

function showCaptureModal(enemy) {
  const modal = document.getElementById('modal-capture');
  const ball = document.getElementById('capture-ball');
  const btnSkip = document.getElementById('btn-skip-capture');
  const hint = document.getElementById('capture-hint');
  const targetRing = document.getElementById('capture-target-ring');

  // 同一ポケモンの所持数をカウント
  const currentCount = gameState.allies.filter(a => a.name === enemy.name).length;

  if (currentCount >= 2) {
    // 捕獲上限到達
    document.getElementById('capture-message').textContent = `これ以上 ${enemy.name} は捕まえられない！！`;
    ball.style.display = 'none';
    hint.classList.add('hidden');
    targetRing.style.display = 'none';

    // スキップボタンを「すすむ」に変更
    btnSkip.textContent = 'すすむ ▶';
    btnSkip.classList.remove('hidden');
    btnSkip.dataset.reason = 'limit'; // スキップ理由を記録

  } else {
    // 通常の捕獲フロー
    document.getElementById('capture-message').textContent = `${enemy.name} をゲットしよう！`;
    ball.style.display = 'flex'; // または元のdisplay値 ('block'など、CSSに合わせてflexと想定)
    hint.classList.remove('hidden');
    targetRing.style.display = 'block';

    // スキップボタンを「にがす」に戻す
    btnSkip.textContent = 'にがす ▶';
    btnSkip.classList.remove('hidden');
    btnSkip.dataset.reason = 'skip';

    // 物理状態リセット
    captureState = {
      ...captureState,
      isSwiping: false,
      isThrown: false,
      ballX: 0,
      ballY: 0,
      ballZ: 1,
      rotation: 0,
      velocities: []
    };

    // ボールの表示リセット
    ball.className = 'swipe-ball';
    ball.innerHTML = '<div class="pokeball-mini"></div>';
    ball.style.transform = `translate3d(0px, 0px, 0) scale(1) rotate(0deg)`;
    ball.classList.remove('ball-returning');

    // イベント登録
    ball.addEventListener('touchstart', handleSwipeStart, { passive: false });
    ball.addEventListener('mousedown', handleSwipeStart);
  }

  document.getElementById('capture-enemy-sprite').innerHTML =
    `<img src="images/${enemy.img}" alt="${enemy.name}"
          onerror="this.textContent='❓'; this.style.fontSize='48px';">`;

  const result = document.getElementById('capture-result');
  result.className = 'capture-result hidden';
  result.textContent = '';

  document.getElementById('capture-enemy-sprite').classList.remove('hidden');
  modal.classList.remove('hidden');

  // BGMを捕獲用 (victory.mp3) に切り替え
  soundManager.playCaptureBGM();
}

function handleSwipeStart(e) {
  if (captureState.isThrown) return;
  e.preventDefault();

  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

  captureState.isSwiping = true;
  captureState.startX = clientX;
  captureState.startY = clientY;
  captureState.currentX = clientX;
  captureState.currentY = clientY;
  captureState.startTime = Date.now();
  captureState.lastTime = Date.now();
  captureState.velocities = [];

  const ball = document.getElementById('capture-ball');
  ball.classList.remove('ball-returning');

  document.addEventListener('touchmove', handleSwipeMove, { passive: false });
  document.addEventListener('touchend', handleSwipeEnd);
  document.addEventListener('mousemove', handleSwipeMove);
  document.addEventListener('mouseup', handleSwipeEnd);
}

function handleSwipeMove(e) {
  if (!captureState.isSwiping || captureState.isThrown) return;
  e.preventDefault();

  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  const now = Date.now();
  const dt = Math.max(1, now - captureState.lastTime);

  // 速度の記録（px/ms）
  const vx = (clientX - captureState.currentX) / dt;
  const vy = (clientY - captureState.currentY) / dt;

  captureState.velocities.push({ vx, vy, time: now });
  // 古い履歴を削除（直近100msのみ保持）
  captureState.velocities = captureState.velocities.filter(v => now - v.time < 100);

  // 位置の更新
  captureState.ballX += window.innerWidth < 400 ? (clientX - captureState.currentX) * 1.5 : (clientX - captureState.currentX); // 画面幅に合わせた感度
  captureState.ballY += window.innerHeight < 700 ? (clientY - captureState.currentY) * 1.5 : (clientY - captureState.currentY);

  captureState.currentX = clientX;
  captureState.currentY = clientY;
  captureState.lastTime = now;

  // ボールのDOMを更新（指に追従）
  renderBall();
}

function handleSwipeEnd(e) {
  if (!captureState.isSwiping || captureState.isThrown) return;
  captureState.isSwiping = false;

  document.removeEventListener('touchmove', handleSwipeMove);
  document.removeEventListener('touchend', handleSwipeEnd);
  document.removeEventListener('mousemove', handleSwipeMove);
  document.removeEventListener('mouseup', handleSwipeEnd);

  // 直近の速度の平均を計算して初速とする
  let avgVy = 0;
  let avgVx = 0;
  if (captureState.velocities.length > 0) {
    avgVy = captureState.velocities.reduce((sum, v) => sum + v.vy, 0) / captureState.velocities.length;
    avgVx = captureState.velocities.reduce((sum, v) => sum + v.vx, 0) / captureState.velocities.length;
  }

  // Y軸上方向（マイナス）への速度が一定以上なら「投げた」と判定
  if (avgVy < -0.5) {
    // 投擲開始
    captureState.isThrown = true;
    captureState.velocityX = avgVx * 20; // x軸の初速
    captureState.velocityY = avgVy * 30; // y軸（上方向）の初速
    captureState.velocityZ = -0.015; // 奥への縮小速度（スケール）
    captureState.gravity = 1.0; // 重力

    // 物理シミュレーションループ開始
    if (captureState.animationFrame) cancelAnimationFrame(captureState.animationFrame);
    captureState.animationFrame = requestAnimationFrame(updatePhysics);

    document.getElementById('capture-hint').classList.add('hidden');

  } else {
    // 投げ失敗：元の位置に戻る
    returnBallToStart();
  }
}

// 物理演算ループ
function updatePhysics() {
  if (!captureState.isThrown) return;

  // 速度と位置の更新
  captureState.velocityY += captureState.gravity; // 重力を適用
  captureState.ballX += captureState.velocityX;
  captureState.ballY += captureState.velocityY;
  captureState.ballZ += captureState.velocityZ; // スケール縮小（奥へ飛ぶ）
  captureState.rotation += captureState.velocityX * 2; // X軸移動に応じて回転

  renderBall();

  // ボールが奥に行きすぎた または 下に落ちすぎた場合は終了判定
  if (captureState.ballZ <= 0.3 || captureState.ballY > 300) {
    cancelAnimationFrame(captureState.animationFrame);
    checkHit();
    return;
  }

  captureState.animationFrame = requestAnimationFrame(updatePhysics);
}

function renderBall() {
  const ball = document.getElementById('capture-ball');
  const scale = Math.max(0, captureState.ballZ);
  ball.style.transform = `translate3d(${captureState.ballX}px, ${captureState.ballY}px, 0) scale(${scale}) rotate(${captureState.rotation}deg)`;
}

// ボールを元の位置に戻す（失敗・やり直し）
function returnBallToStart() {
  captureState.isThrown = false;
  captureState.isSwiping = false;

  const ball = document.getElementById('capture-ball');
  ball.classList.add('ball-returning'); // CSS transition
  captureState.ballX = 0;
  captureState.ballY = 0;
  captureState.ballZ = 1;
  captureState.rotation = 0;
  ball.style.transform = `translate3d(0px, 0px, 0) scale(1) rotate(0deg)`;

  setTimeout(() => {
    ball.classList.remove('ball-returning');
  }, 400);
}

// 当たり判定チェック
function checkHit() {
  // 敵の想定位置（X: -40px 〜 40px, 高さ: 画面上部）
  // 簡易的に Z（スケール）が 0.3〜0.5に到達し、かつ Xのズレが少なければヒットとする
  const isHit = captureState.ballY < -100 && Math.abs(captureState.ballX) < 120;

  if (isHit) {
    // 捕獲成功プロセスの開始
    const ball = document.getElementById('capture-ball');
    ball.removeEventListener('touchstart', handleSwipeStart);
    ball.removeEventListener('mousedown', handleSwipeStart);
    processCaptureSuccess();
  } else {
    // 外れた：やり直し
    returnBallToStart();
  }
}

// 捕獲成功アニメーションとロジック
function processCaptureSuccess() {
  document.getElementById('btn-skip-capture').classList.add('hidden');
  document.getElementById('capture-target-ring').style.display = 'none';

  const ball = document.getElementById('capture-ball');
  // 一旦固定（敵の位置付近へ）
  ball.style.transform = `translate3d(0px, -180px, 0) scale(0.6) rotate(0deg)`;

  // 敵が吸い込まれる
  const enemyImg = document.querySelector('#capture-enemy-sprite img');
  if (enemyImg) enemyImg.classList.add('enemy-sucked-in');

  // 吸い込み後、ボール揺れへ
  setTimeout(() => {
    document.getElementById('capture-enemy-sprite').classList.add('hidden');
    ball.classList.add('ball-wiggling');
  }, 500);

  // 揺れ完了後、捕獲成功
  setTimeout(() => {
    ball.classList.remove('ball-wiggling');
    ball.classList.add('ball-captured');
    soundManager.playCorrect();

    const stage = getBattleStage();
    const enemy = ENEMIES[stage];
    const result = document.getElementById('capture-result');
    result.className = 'capture-result success';
    result.textContent = `✨ やった！ ${enemy.name} を捕まえた！`;

    gameState.allies.push({ name: enemy.name, img: enemy.img });

    // 再プレイ中はステージを進めない
    if (gameState.replayStage === null) {
      gameState.currentStage++;
    }
    gameState.replayStage = null;
    saveProgress();

    setTimeout(() => proceedAfterCapture(), 2000);
  }, 2200); // 吸い込み500 + 揺れ1200 + α
}

function skipCapture() {
  const btnSkip = document.getElementById('btn-skip-capture');
  const reason = btnSkip.dataset.reason;

  btnSkip.classList.add('hidden');
  document.getElementById('capture-hint').classList.add('hidden');
  document.getElementById('capture-target-ring').style.display = 'none';

  const ball = document.getElementById('capture-ball');
  ball.removeEventListener('touchstart', handleSwipeStart);
  ball.removeEventListener('mousedown', handleSwipeStart);

  const stage = getBattleStage();
  const enemy = ENEMIES[stage];
  const result = document.getElementById('capture-result');

  if (reason === 'limit') {
    result.className = 'capture-result skipped'; // 逃がした時と同じスタイル
    result.textContent = `ストックがいっぱいだ！ 次のマスへ進もう！`;
  } else {
    result.className = 'capture-result skipped';
    result.textContent = `${enemy.name} は逃げていった…`;
  }

  // 再プレイ中はステージを進めない
  if (gameState.replayStage === null) {
    gameState.currentStage++;
  }
  gameState.replayStage = null;
  saveProgress();

  setTimeout(() => proceedAfterCapture(), 1500);
}

function proceedAfterCapture() {
  document.getElementById('modal-capture').classList.add('hidden');

  if (gameState.currentStage >= ENEMIES.length) {
    showClearScreen();
    soundManager.stopBGM();
    soundManager.playVictory();
  } else {
    showScreen('screen-map');
    renderMap();
    soundManager.playMapBGM();
  }
}

// ─── 身代わりシステム ───
function triggerSubstitute() {
  const releasedAlly = gameState.allies.pop();
  gameState.playerMissCount = gameState.playerMaxMiss - 1; // HP1で生存

  const modal = document.getElementById('modal-substitute');
  const subMsg = document.getElementById('sub-message');
  const subSprite = document.getElementById('sub-sprite');

  soundManager.playSubstitute();
  subMsg.textContent = `${releasedAlly.name} が身代わりになってくれた！\nHP 1 で耐えた！`;
  subSprite.innerHTML = `<img src="images/${releasedAlly.img}" alt="${releasedAlly.name}"
    onerror="this.textContent='😢'; this.style.fontSize='48px';">`;

  modal.classList.remove('hidden');
  updateHpBars();
  renderAllyIcons('battle-allies');
}

// ─── ゲームオーバー ───
function onGameOver() {
  gameState.battleActive = false;
  soundManager.stopBGM();
  soundManager.playGameOver();

  const stage = getBattleStage();
  const enemy = ENEMIES[stage];
  const msg = document.getElementById('battle-message');
  msg.textContent = `😢 ${enemy.name} に負けてしまった… もう一度挑戦！`;
  document.getElementById('question-area').classList.add('hidden');

  // 再プレイ状態をリセット
  gameState.replayStage = null;

  // 少し待ってからマップ画面に戻る（同じステージから再挑戦）
  setTimeout(() => {
    showScreen('screen-map');
    renderMap();
    soundManager.playMapBGM();
  }, 2500);
}

// ─── クリア画面 ───
function showClearScreen() {
  const container = document.getElementById('clear-allies');
  container.innerHTML = gameState.allies.map(a => `
    <div class="clear-ally-item">
      <img src="images/${a.img}" alt="${a.name}"
           onerror="this.textContent='🌟'; this.style.fontSize='32px';">
      <span>${a.name}</span>
    </div>
  `).join('');

  showScreen('screen-clear');
}

// ─── ユーティリティ: シャッフル ───
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
