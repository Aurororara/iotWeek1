// ==========================================================================
// MQTT DRAW & GUESS - GAME STATE & ROOM LOGIC ENGINE
// ==========================================================================

export class GameState {
  constructor(localPlayer) {
    this.localPlayer = localPlayer; // { playerId, nickname, avatar }
    this.players = new Map(); // playerId -> { id, nickname, avatar, score, isHost, joinedAt, guessedCorrect }
    
    // Room Config
    this.roomId = null;
    this.rounds = 5;
    this.turnDuration = 60;
    this.category = 'all';

    // Current Game Flow State
    this.status = 'LOBBY'; // LOBBY, WORD_SELECTING, DRAWING, TURN_SUMMARY, GAME_OVER
    this.currentRound = 1;
    this.currentDrawerId = null;
    this.currentWord = '';
    this.wordHint = '';
    this.timer = 0;
    this.timerInterval = null;
    this.drawerIndex = 0;

    // Callbacks to UI
    this.onStateChange = null;
    this.onPlayersUpdate = null;
    this.onTimerTick = null;
    this.onWordSelectRequired = null;
    this.onGameOver = null;
  }

  setRoomConfig(config) {
    if (config.rounds) this.rounds = parseInt(config.rounds);
    if (config.turnDuration) this.turnDuration = parseInt(config.turnDuration);
    if (config.category) this.category = config.category;
  }

  /**
   * Add or update player in room list
   */
  addOrUpdatePlayer(playerData) {
    const existing = this.players.get(playerData.playerId) || {};
    this.players.set(playerData.playerId, {
      id: playerData.playerId,
      nickname: playerData.nickname || existing.nickname || '匿名玩家',
      avatar: playerData.avatar || existing.avatar || '🦊',
      score: playerData.score !== undefined ? playerData.score : (existing.score || 0),
      isHost: playerData.isHost !== undefined ? playerData.isHost : (existing.isHost || false),
      joinedAt: playerData.joinedAt || existing.joinedAt || Date.now(),
      guessedCorrect: playerData.guessedCorrect !== undefined ? playerData.guessedCorrect : (existing.guessedCorrect || false)
    });

    this.checkHostElection();
    if (this.onPlayersUpdate) this.onPlayersUpdate(Array.from(this.players.values()));
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.checkHostElection();
    if (this.onPlayersUpdate) this.onPlayersUpdate(Array.from(this.players.values()));
  }

  /**
   * Oldest connected player becomes room Host automatically
   */
  checkHostElection() {
    if (this.players.size === 0) return;
    const sorted = Array.from(this.players.values()).sort((a, b) => a.joinedAt - b.joinedAt);
    const hostId = sorted[0].id;

    this.players.forEach(p => {
      p.isHost = (p.id === hostId);
    });
  }

  isLocalPlayerHost() {
    const local = this.players.get(this.localPlayer.playerId);
    return local ? local.isHost : false;
  }

  isLocalPlayerDrawer() {
    return this.currentDrawerId === this.localPlayer.playerId;
  }

  getSortedLeaderboard() {
    return Array.from(this.players.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Secret Word Hint Generator
   */
  generateHint(word, progress = 0) {
    if (!word) return '';
    const chars = Array.from(word);
    
    if (progress < 0.3) {
      // Phase 1: All masked (_ _ _)
      return chars.map(() => '_').join(' ');
    } else if (progress < 0.7) {
      // Phase 2: Show character count & space structure
      return chars.map(c => (c === ' ' ? ' ' : '_')).join(' ') + ` (${chars.length}個字)`;
    } else {
      // Phase 3: Reveal first character
      return chars.map((c, i) => (i === 0 ? c : '_')).join(' ') + ` (${chars.length}個字)`;
    }
  }

  /**
   * Reset round state for new turn
   */
  resetTurnState() {
    this.players.forEach(p => p.guessedCorrect = false);
    if (this.onPlayersUpdate) this.onPlayersUpdate(Array.from(this.players.values()));
  }
}
