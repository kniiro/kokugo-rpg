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
};

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

  // 初回タッチでAudioContext起動
  const initAudio = () => {
    soundManager.init();
    soundManager.resume();
    document.removeEventListener('click', initAudio);
    document.removeEventListener('touchstart', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('touchstart', initAudio);

  // セーブデータがあれば途中から再開
  const hasProgress = loadProgress();
  if (hasProgress) {
    showScreen('screen-map');
    renderMap();
    // 音声は初回タッチ後に再生されるため、ここではタッチ待ち
    const startBGMOnce = () => {
      soundManager.init();
      soundManager.resume();
      soundManager.playMapBGM();
      document.removeEventListener('click', startBGMOnce);
      document.removeEventListener('touchstart', startBGMOnce);
    };
    document.addEventListener('click', startBGMOnce);
    document.addEventListener('touchstart', startBGMOnce);
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
    `;
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
  const stage = gameState.currentStage;
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
  msg.textContent = `野生の ${enemy.name} が現れた！`;

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

  const enemy = ENEMIES[gameState.currentStage];
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

  const enemy = ENEMIES[gameState.currentStage];
  const msg = document.getElementById('battle-message');
  msg.textContent = `🎉 ${enemy.name} を倒した！`;
  soundManager.playDefeat();

  document.getElementById('question-area').classList.add('hidden');

  // 少し待ってから捕獲モーダルを表示
  setTimeout(() => {
    showCaptureModal(enemy);
  }, 1500);
}

// ─── モンスターボール捕獲（スワイプ） ───
let swipeStartY = 0;
let swipeStartTime = 0;
let isSwiping = false;

function showCaptureModal(enemy) {
  const modal = document.getElementById('modal-capture');
  document.getElementById('capture-message').textContent = `${enemy.name} をゲットしよう！`;
  document.getElementById('capture-enemy-sprite').innerHTML =
    `<img src="images/${enemy.img}" alt="${enemy.name}"
          onerror="this.textContent='❓'; this.style.fontSize='48px';">`;

  // リセット状態
  const ball = document.getElementById('capture-ball');
  ball.className = 'swipe-ball';
  ball.innerHTML = '<div class="pokeball-mini"></div>';

  const result = document.getElementById('capture-result');
  result.className = 'capture-result hidden';
  result.textContent = '';

  document.getElementById('btn-skip-capture').classList.remove('hidden');
  document.getElementById('capture-hint').classList.remove('hidden');
  document.getElementById('capture-target-ring').style.display = 'block';
  document.getElementById('capture-enemy-sprite').classList.remove('hidden');

  modal.classList.remove('hidden');

  // スワイプイベント登録
  ball.addEventListener('touchstart', handleSwipeStart, { passive: false });
  ball.addEventListener('mousedown', handleSwipeStart);
}

function handleSwipeStart(e) {
  e.preventDefault();
  isSwiping = true;
  swipeStartY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  swipeStartTime = Date.now();

  const ball = document.getElementById('capture-ball');
  ball.classList.remove('ball-returning');

  document.addEventListener('touchmove', handleSwipeMove, { passive: false });
  document.addEventListener('touchend', handleSwipeEnd);
  document.addEventListener('mousemove', handleSwipeMove);
  document.addEventListener('mouseup', handleSwipeEnd);
}

function handleSwipeMove(e) {
  if (!isSwiping) return;
  e.preventDefault(); // スクロール防止
}

function handleSwipeEnd(e) {
  if (!isSwiping) return;
  isSwiping = false;

  document.removeEventListener('touchmove', handleSwipeMove);
  document.removeEventListener('touchend', handleSwipeEnd);
  document.removeEventListener('mousemove', handleSwipeMove);
  document.removeEventListener('mouseup', handleSwipeEnd);

  const endY = e.type.includes('touch') ? e.changedTouches[0].clientY : e.clientY;
  const timeDiff = Date.now() - swipeStartTime;
  const distanceY = swipeStartY - endY; // 上方向が正

  // スワイプ速度判定（px/ms）
  const velocity = distanceY / timeDiff;

  // 上方向に一定以上の速度・距離でスワイプされたか
  if (distanceY > 50 && velocity > 0.3) {
    throwBall(); // 投げ成功
  } else {
    // 投げ失敗（ボールが戻る）
    const ball = document.getElementById('capture-ball');
    ball.classList.add('ball-returning');
  }
}

function throwBall() {
  const ball = document.getElementById('capture-ball');
  // イベント削除
  ball.removeEventListener('touchstart', handleSwipeStart);
  ball.removeEventListener('mousedown', handleSwipeStart);

  document.getElementById('btn-skip-capture').classList.add('hidden');
  document.getElementById('capture-hint').classList.add('hidden');
  document.getElementById('capture-target-ring').style.display = 'none';

  // 敵が吸い込まれるアニメーション
  const enemySprite = document.getElementById('capture-enemy-sprite');
  const enemyImg = enemySprite.querySelector('img, span');
  if (enemyImg) enemyImg.classList.add('enemy-sucked-in');

  // ボール投げアニメーション
  ball.classList.add('ball-throwing');

  // 投げた後に揺れ
  setTimeout(() => {
    document.getElementById('capture-enemy-sprite').classList.add('hidden');
    ball.classList.remove('ball-throwing');
    ball.classList.add('ball-wiggling');
  }, 700);

  // 揺れ3回の後、捕獲成功
  setTimeout(() => {
    ball.classList.remove('ball-wiggling');
    ball.classList.add('ball-captured');
    soundManager.playCorrect();

    const enemy = ENEMIES[gameState.currentStage];
    const result = document.getElementById('capture-result');
    result.className = 'capture-result success';
    result.textContent = `✨ やった！ ${enemy.name} を捕まえた！`;

    // 仲間に追加
    gameState.allies.push({ name: enemy.name, img: enemy.img });
    gameState.currentStage++;
    saveProgress();

    setTimeout(() => proceedAfterCapture(), 2000);
  }, 2300);
}

function skipCapture() {
  document.getElementById('btn-skip-capture').classList.add('hidden');
  document.getElementById('capture-hint').classList.add('hidden');
  document.getElementById('capture-target-ring').style.display = 'none';

  const ball = document.getElementById('capture-ball');
  ball.removeEventListener('touchstart', handleSwipeStart);
  ball.removeEventListener('mousedown', handleSwipeStart);

  const enemy = ENEMIES[gameState.currentStage];
  const result = document.getElementById('capture-result');
  result.className = 'capture-result skipped';
  result.textContent = `${enemy.name} は逃げていった…`;

  // 仲間に追加しないでステージを進める
  gameState.currentStage++;
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

  const enemy = ENEMIES[gameState.currentStage];
  const msg = document.getElementById('battle-message');
  msg.textContent = `😢 ${enemy.name} に負けてしまった… もう一度挑戦！`;
  document.getElementById('question-area').classList.add('hidden');

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
