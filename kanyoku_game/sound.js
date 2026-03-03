/* ============================================
   国語克服バトルRPG — サウンドシステム
   8bit チップチューン風 BGM & 効果音
   Web Audio API で動的生成
   ============================================ */

class SoundManager {
    constructor() {
        this.ctx = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.bgmPlaying = false;
        this.bgmNodes = [];
        this.bgmTimer = null;
        this.initialized = false;
        this.bgmWasPaused = false;

        // バックグラウンド移行時にBGMを停止/復帰
        document.addEventListener('visibilitychange', () => {
            this._handleVisibilityChange();
        });
    }

    _handleVisibilityChange() {
        if (document.hidden) {
            // バックグラウンドへ — BGM一時停止
            if (this.currentBGM && !this.currentBGM.paused) {
                this.currentBGM.pause();
                this.bgmWasPaused = true;
            }
            if (this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend();
            }
        } else {
            // フォアグラウンドへ — BGM再開
            if (this.bgmWasPaused && this.currentBGM) {
                this.currentBGM.play().catch(e => console.warn('BGM再開失敗:', e));
                this.bgmWasPaused = false;
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // マスターゲイン
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);

        // BGMゲイン
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.25;
        this.bgmGain.connect(this.masterGain);

        // SFXゲイン
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.masterGain);

        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ─── 音符ヘルパー ───
    noteFreq(note, octave) {
        const notes = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
        const semitone = notes[note] - 9; // A4 = 440Hz 基準
        return 440 * Math.pow(2, (semitone + (octave - 4) * 12) / 12);
    }

    // ─── 単音再生 ───
    playTone(freq, duration, type = 'square', gainNode = null, startTime = null) {
        if (!this.ctx) return;
        const t = startTime || this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);

        env.gain.setValueAtTime(0.3, t);
        env.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(env);
        env.connect(gainNode || this.sfxGain);

        osc.start(t);
        osc.stop(t + duration);
        return osc;
    }

    // ─── 効果音: 正解 ───
    playCorrect() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        this.playTone(523.25, 0.1, 'square', this.sfxGain, t);        // C5
        this.playTone(659.25, 0.1, 'square', this.sfxGain, t + 0.1);  // E5
        this.playTone(783.99, 0.2, 'square', this.sfxGain, t + 0.2);  // G5
    }

    // ─── 効果音: 不正解 ───
    playWrong() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        this.playTone(311.13, 0.15, 'square', this.sfxGain, t);        // D#4
        this.playTone(233.08, 0.3, 'square', this.sfxGain, t + 0.15); // A#3
    }

    // ─── 効果音: 敵にダメージ ───
    playHit() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        // ノイズ的な打撃音
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        env.gain.setValueAtTime(0.4, t);
        env.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    // ─── 効果音: プレイヤーダメージ ───
    playPlayerHit() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        env.gain.setValueAtTime(0.35, t);
        env.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // ─── 効果音: 敵撃破 ───
    playDefeat() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        // 上昇アルペジオ
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
        notes.forEach((f, i) => {
            this.playTone(f, 0.12, 'square', this.sfxGain, t + i * 0.08);
        });
    }

    // ─── 効果音: ゲームオーバー ───
    playGameOver() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        const notes = [392, 369.99, 349.23, 329.63, 311.13, 293.66, 277.18, 261.63];
        notes.forEach((f, i) => {
            this.playTone(f, 0.25, 'square', this.sfxGain, t + i * 0.2);
        });
    }

    // ─── 効果音: クリアファンファーレ（victory.wav使用） ───
    playVictory() {
        this._playBGMFile('audio/victory.wav', false);
    }

    // ─── 効果音: バトル開始 ───
    playBattleStart() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        this.playTone(261.63, 0.1, 'square', this.sfxGain, t);
        this.playTone(329.63, 0.1, 'square', this.sfxGain, t + 0.1);
        this.playTone(392.00, 0.1, 'square', this.sfxGain, t + 0.2);
        this.playTone(523.25, 0.3, 'square', this.sfxGain, t + 0.3);
    }

    // ─── 効果音: ボタンクリック ───
    playClick() {
        if (!this.ctx) return;
        this.init();
        this.playTone(800, 0.05, 'square', this.sfxGain);
    }

    // ─── 効果音: 身代わり発動 ───
    playSubstitute() {
        if (!this.ctx) return;
        this.init();
        const t = this.ctx.currentTime;
        this.playTone(523.25, 0.15, 'triangle', this.sfxGain, t);
        this.playTone(392.00, 0.15, 'triangle', this.sfxGain, t + 0.15);
        this.playTone(329.63, 0.3, 'triangle', this.sfxGain, t + 0.3);
        // 復活音
        this.playTone(392.00, 0.1, 'square', this.sfxGain, t + 0.7);
        this.playTone(523.25, 0.2, 'square', this.sfxGain, t + 0.8);
    }

    // ========================================
    //  BGM ─ audioフォルダのwavファイル再生
    // ========================================

    _playBGMFile(src, loop = true) {
        this.stopBGM();
        this.currentBGM = new Audio(src);
        this.currentBGM.loop = loop;
        this.currentBGM.volume = 0.35;
        this.currentBGM.play().catch(e => console.warn('BGM再生失敗:', e));
        this.bgmPlaying = true;
    }

    // --- マップBGM (masala.mp3) ---
    playMapBGM() {
        this._playBGMFile('audio/masala.mp3', true);
    }

    // --- バトルBGM (battle.mp3) ---
    playBattleBGM() {
        this._playBGMFile('audio/battle.mp3', true);
    }

    // --- ボスBGM 5〜9匹目 (battle_boss.mp3) ---
    playBossBGM() {
        this._playBGMFile('audio/battle_boss.mp3', true);
    }

    // --- ラストボスBGM 10匹目 (battle_last.mp3) ---
    playLastBossBGM() {
        this._playBGMFile('audio/battle_last.mp3', true);
    }

    // --- タイトルBGM (opening.mp3) ---
    playTitleBGM() {
        this._playBGMFile('audio/opening.mp3', true);
    }

    // --- BGM停止 ---
    stopBGM() {
        this.bgmPlaying = false;
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
            this.currentBGM = null;
        }
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

// グローバルインスタンス
const soundManager = new SoundManager();
