// ==========================================================================
// MQTT DRAW & GUESS - MAIN APPLICATION CONTROLLER
// ==========================================================================

import { mqttClient } from './mqttClient.js';
import { CanvasManager } from './canvasManager.js';
import { GameState } from './gameState.js';
import { getRandomWordOptions, AVATARS } from './wordBank.js';
import { audioManager } from './audioManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const screenLobby = document.getElementById('screen-lobby');
  const screenGame = document.getElementById('screen-game');
  const headerGameInfo = document.getElementById('header-game-info');
  const btnLeaveRoom = document.getElementById('btn-leave-room');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  
  // Lobby Elements
  const avatarList = document.getElementById('avatar-list');
  const inputNickname = document.getElementById('input-nickname');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const inputRoomCode = document.getElementById('input-room-code');
  const selectRounds = document.getElementById('select-rounds');
  const selectTime = document.getElementById('select-time');
  const selectCategory = document.getElementById('select-category');

  // Game Elements
  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyRoom = document.getElementById('btn-copy-room');
  const displayRound = document.getElementById('display-round');
  const displayTimer = document.getElementById('display-timer');
  const timerBox = document.getElementById('timer-box');
  const playerRoleBadge = document.getElementById('player-role-badge');
  const wordDisplay = document.getElementById('word-display');
  const playerCount = document.getElementById('player-count');
  const playerListEl = document.getElementById('player-list');
  const hostControls = document.getElementById('host-controls');
  const btnStartGame = document.getElementById('btn-start-game');

  // Canvas & Tools
  const gameCanvas = document.getElementById('game-canvas');
  const canvasOverlay = document.getElementById('canvas-overlay');
  const drawingToolbar = document.getElementById('drawing-toolbar');
  const toolBtns = document.querySelectorAll('.tool-btn');
  const swatches = document.querySelectorAll('.swatch');
  const customColorPicker = document.getElementById('custom-color-picker');
  const brushSize = document.getElementById('brush-size');
  const sizePreview = document.getElementById('size-preview');
  const btnUndo = document.getElementById('btn-undo');
  const btnClearCanvas = document.getElementById('btn-clear-canvas');

  // Chat Elements
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  // Modals
  const modalWordSelect = document.getElementById('modal-word-select');
  const wordOptionsContainer = document.getElementById('word-options');
  const modalGameOver = document.getElementById('modal-game-over');
  const podiumContainer = document.getElementById('podium-container');
  const finalScoresList = document.getElementById('final-scores-list');
  const btnBackLobby = document.getElementById('btn-back-lobby');

  // Core Instances
  let selectedAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const canvasManager = new CanvasManager(gameCanvas);
  
  const localPlayer = {
    playerId: mqttClient.playerId,
    nickname: localStorage.getItem('mqtt_draw_nickname') || '畫畫大師',
    avatar: selectedAvatar
  };
  
  const gameState = new GameState(localPlayer);

  // Initialize Canvas Size
  function resizeCanvas() {
    const wrapper = gameCanvas.parentElement;
    if (wrapper) {
      gameCanvas.width = wrapper.clientWidth;
      gameCanvas.height = wrapper.clientHeight;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Populate Avatar Selector
  function renderAvatars() {
    avatarList.innerHTML = '';
    AVATARS.forEach(emoji => {
      const item = document.createElement('div');
      item.className = `avatar-item ${emoji === selectedAvatar ? 'selected' : ''}`;
      item.textContent = emoji;
      item.addEventListener('click', () => {
        audioManager.playClick();
        document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedAvatar = emoji;
        localPlayer.avatar = emoji;
      });
      avatarList.appendChild(item);
    });
  }
  renderAvatars();

  inputNickname.value = localPlayer.nickname;

  // Lobby Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      audioManager.playClick();
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Sound Toggle
  btnSoundToggle.addEventListener('click', () => {
    const isEnabled = audioManager.toggleSound();
    btnSoundToggle.innerHTML = isEnabled 
      ? '<i class="fa-solid fa-volume-high"></i>' 
      : '<i class="fa-solid fa-volume-xmark"></i>';
  });

  // Copy Room Code
  btnCopyRoom.addEventListener('click', () => {
    if (gameState.roomId) {
      navigator.clipboard.writeText(gameState.roomId);
      addChatMessage('系統', `已複製房間邀請碼: ${gameState.roomId}`, 'system');
      audioManager.playClick();
    }
  });

  // Create Room Click
  btnCreateRoom.addEventListener('click', () => {
    audioManager.playClick();
    const nickname = inputNickname.value.trim() || '畫畫大師';
    localPlayer.nickname = nickname;
    localStorage.setItem('mqtt_draw_nickname', nickname);

    const randomCode = 'DRAW-' + Math.floor(1000 + Math.random() * 9000);
    const config = {
      rounds: selectRounds.value,
      turnDuration: selectTime.value,
      category: selectCategory.value
    };

    enterGameRoom(randomCode, config);
  });

  // Join Room Click
  btnJoinRoom.addEventListener('click', () => {
    audioManager.playClick();
    const nickname = inputNickname.value.trim() || '畫畫大師';
    localPlayer.nickname = nickname;
    localStorage.setItem('mqtt_draw_nickname', nickname);

    const code = inputRoomCode.value.trim().toUpperCase();
    if (!code) {
      alert('請輸入房間代碼！');
      return;
    }
    enterGameRoom(code, {});
  });

  // Leave Room Click
  btnLeaveRoom.addEventListener('click', () => {
    if (confirm('確定要離開房間嗎？')) {
      audioManager.playClick();
      mqttClient.leaveRoom(localPlayer);
      location.reload();
    }
  });

  /**
   * Enter Game Room logic
   */
  function enterGameRoom(roomId, config) {
    gameState.roomId = roomId;
    gameState.setRoomConfig(config);
    displayRoomCode.textContent = roomId;

    screenLobby.classList.remove('active');
    screenGame.classList.add('active');
    headerGameInfo.classList.remove('hidden');
    btnLeaveRoom.classList.remove('hidden');
    resizeCanvas();

    // Connect to MQTT
    mqttClient.connect(() => {
      mqttClient.joinRoom(roomId, localPlayer);
      gameState.addOrUpdatePlayer(localPlayer);
    }, (err) => {
      alert('MQTT 連線失敗，請檢查網路連線或稍後再試！');
    });
  }

  // Setup Canvas Stroke broadcasting
  canvasManager.onStrokeEmit = (strokeData) => {
    mqttClient.publish('stroke', strokeData);
  };

  // Wire Toolbar Buttons
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      audioManager.playClick();
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      canvasManager.setTool(btn.dataset.tool);
    });
  });

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      audioManager.playClick();
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.dataset.color;
      canvasManager.setColor(color);
      customColorPicker.value = color;
    });
  });

  customColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    canvasManager.setColor(color);
    swatches.forEach(s => s.classList.remove('active'));
  });

  brushSize.addEventListener('input', (e) => {
    const size = e.target.value;
    canvasManager.setLineWidth(size);
    sizePreview.style.setProperty('--size', `${size}px`);
  });

  btnUndo.addEventListener('click', () => {
    audioManager.playClick();
    canvasManager.undo();
  });

  btnClearCanvas.addEventListener('click', () => {
    audioManager.playClick();
    canvasManager.clearCanvas(true);
  });

  // Chat Submission
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';

    // Check if player is Drawer -> Cannot chat
    if (gameState.isLocalPlayerDrawer() && gameState.status === 'DRAWING') {
      addChatMessage('系統', '畫家作畫中不能在聊天室劇透喔！', 'system');
      return;
    }

    // Check if Guess is Correct during DRAWING
    if (gameState.status === 'DRAWING' && !gameState.isLocalPlayerDrawer()) {
      const localP = gameState.players.get(localPlayer.playerId);
      if (localP && localP.guessedCorrect) {
        addChatMessage('系統', '你已經猜中了，請保持安靜幫大家加油！', 'system');
        return;
      }

      if (text.trim().toLowerCase() === gameState.currentWord.trim().toLowerCase()) {
        // Correct Answer!
        audioManager.playCorrect();
        triggerConfetti();

        // Calculate score
        const points = 100 + Math.round((gameState.timer / gameState.turnDuration) * 200);
        localP.score += points;
        localP.guessedCorrect = true;

        // Broadcast correct guess
        mqttClient.publish('chat', {
          senderId: localPlayer.playerId,
          senderName: localPlayer.nickname,
          text: `🎯 猜中了答案！(+${points}分)`,
          isCorrect: true
        });

        mqttClient.publish('state', {
          type: 'correct_guess',
          playerId: localPlayer.playerId,
          points: points,
          drawerPoints: 50
        });

        checkTurnEndCondition();
        return;
      }
    }

    // Normal Chat message
    mqttClient.publish('chat', {
      senderId: localPlayer.playerId,
      senderName: localPlayer.nickname,
      text: text,
      isCorrect: false
    });
  });

  // Add Chat Message DOM
  function addChatMessage(sender, text, type = 'normal') {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${type === 'system' ? 'system-msg' : type === 'correct' ? 'correct-msg' : ''}`;
    
    if (type === 'normal') {
      msg.innerHTML = `<span class="sender">${escapeHtml(sender)}:</span> ${escapeHtml(text)}`;
    } else {
      msg.innerHTML = `<span>${escapeHtml(text)}</span>`;
    }

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
  }

  // Confetti Particle Effect
  function triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  // Player List UI Update
  gameState.onPlayersUpdate = (players) => {
    playerCount.textContent = players.length;
    playerListEl.innerHTML = '';

    players.forEach(p => {
      const isDrawer = p.id === gameState.currentDrawerId;
      const card = document.createElement('div');
      card.className = `player-card ${isDrawer ? 'is-drawer' : ''} ${p.guessedCorrect ? 'guessed-correct' : ''}`;

      card.innerHTML = `
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.nickname)} ${p.isHost ? '👑' : ''}</div>
          <div class="player-score">${p.score} 分</div>
        </div>
        ${isDrawer ? '<i class="fa-solid fa-paintbrush drawer-icon" title="作畫中"></i>' : ''}
        ${p.guessedCorrect ? '<i class="fa-solid fa-circle-check text-success" title="已猜中"></i>' : ''}
      `;
      playerListEl.appendChild(card);
    });

    // Update Host controls visibility
    if (gameState.isLocalPlayerHost() && gameState.status === 'LOBBY') {
      hostControls.classList.remove('hidden');
    } else {
      hostControls.classList.add('hidden');
    }
  };

  // Host Starts Game Click
  btnStartGame.addEventListener('click', () => {
    if (gameState.players.size < 1) {
      alert('房間內至少要有一位玩家才能開始！');
      return;
    }
    audioManager.playClick();
    startNewGameCycle();
  });

  /**
   * HOST GAME CYCLE MANAGEMENT
   */
  function startNewGameCycle() {
    gameState.status = 'GAME_SETUP';
    gameState.currentRound = 1;
    gameState.drawerIndex = 0;

    // Reset scores
    gameState.players.forEach(p => p.score = 0);

    // Sync room setup state over MQTT
    mqttClient.publish('state', {
      type: 'game_started',
      rounds: gameState.rounds,
      turnDuration: gameState.turnDuration
    });

    nextTurn();
  }

  function nextTurn() {
    const playerArray = Array.from(gameState.players.values());
    if (gameState.drawerIndex >= playerArray.length) {
      gameState.drawerIndex = 0;
      gameState.currentRound++;
    }

    if (gameState.currentRound > gameState.rounds) {
      endGame();
      return;
    }

    const drawer = playerArray[gameState.drawerIndex];
    gameState.currentDrawerId = drawer.id;
    gameState.resetTurnState();

    // Clear canvas
    canvasManager.clearCanvas(false);

    mqttClient.publish('state', {
      type: 'start_word_select',
      drawerId: drawer.id,
      round: gameState.currentRound,
      maxRounds: gameState.rounds
    });

    gameState.drawerIndex++;
  }

  /**
   * MQTT EVENT HANDLERS
   */
  mqttClient.on('presence', (data) => {
    if (data.action === 'join') {
      gameState.addOrUpdatePlayer(data);
      addChatMessage('系統', `${data.nickname} 加入了房間`, 'system');

      // If local player is Drawer, send snapshot to new joiner
      if (gameState.isLocalPlayerDrawer() && gameState.status === 'DRAWING') {
        mqttClient.publish('snapshot', {
          senderId: localPlayer.playerId,
          dataUrl: canvasManager.getSnapshot()
        });
      }
    } else if (data.action === 'leave') {
      gameState.removePlayer(data.playerId);
      addChatMessage('系統', `${data.nickname} 離開了房間`, 'system');
    }
  });

  mqttClient.on('chat', (data) => {
    addChatMessage(data.senderName, data.text, data.isCorrect ? 'correct' : 'normal');
  });

  mqttClient.on('stroke', (data) => {
    if (!gameState.isLocalPlayerDrawer()) {
      canvasManager.handleRemoteStroke(data);
    }
  });

  mqttClient.on('snapshot', (data) => {
    if (!gameState.isLocalPlayerDrawer()) {
      canvasManager.loadSnapshot(data.dataUrl);
    }
  });

  mqttClient.on('state', (data) => {
    if (data.type === 'game_started') {
      gameState.status = 'GAME_SETUP';
      gameState.rounds = data.rounds;
      gameState.turnDuration = data.turnDuration;
      addChatMessage('系統', '🎮 遊戲正式開始！祝大家玩得愉快！', 'system');
    }

    else if (data.type === 'start_word_select') {
      gameState.status = 'WORD_SELECTING';
      gameState.currentDrawerId = data.drawerId;
      gameState.currentRound = data.round;
      displayRound.textContent = `${data.round} / ${data.maxRounds}`;

      const drawer = gameState.players.get(data.drawerId);
      const drawerName = drawer ? drawer.nickname : '玩家';

      if (gameState.isLocalPlayerDrawer()) {
        playerRoleBadge.textContent = '🎨 你是畫家';
        wordDisplay.innerHTML = '<span class="hint-text">請在選題視窗選擇題目...</span>';
        showWordSelectionModal();
      } else {
        playerRoleBadge.textContent = '🔍 猜題者';
        wordDisplay.innerHTML = `<span class="hint-text">等待 ${escapeHtml(drawerName)} 選擇題目中...</span>`;
        modalWordSelect.classList.add('hidden');
      }

      canvasOverlay.classList.remove('hidden');
      canvasOverlay.innerHTML = `<h2>🎨 輪到 <span style="color:var(--accent-secondary)">${escapeHtml(drawerName)}</span> 作畫</h2><p>選題中，請稍候...</p>`;
      drawingToolbar.classList.add('disabled');
      canvasManager.setDrawingEnabled(false);
      gameState.onPlayersUpdate(Array.from(gameState.players.values()));
    }

    else if (data.type === 'word_chosen') {
      gameState.status = 'DRAWING';
      gameState.currentWord = data.word;
      gameState.timer = data.turnDuration;
      displayTimer.textContent = gameState.timer;
      canvasOverlay.classList.add('hidden');

      if (gameState.isLocalPlayerDrawer()) {
        wordDisplay.innerHTML = `<span>題目：${data.word}</span>`;
        drawingToolbar.classList.remove('disabled');
        canvasManager.setDrawingEnabled(true);
      } else {
        const hint = gameState.generateHint(data.word, 0);
        wordDisplay.innerHTML = `<span class="hint-text">${hint}</span>`;
        drawingToolbar.classList.add('disabled');
        canvasManager.setDrawingEnabled(false);
      }

      // If host, start countdown loop
      if (gameState.isLocalPlayerHost()) {
        startHostTimer(data.turnDuration);
      }
    }

    else if (data.type === 'timer_tick') {
      gameState.timer = data.timer;
      displayTimer.textContent = data.timer;

      if (data.timer <= 10) {
        timerBox.classList.add('warning');
        audioManager.playTimerWarning();
      } else {
        timerBox.classList.remove('warning');
      }

      if (!gameState.isLocalPlayerDrawer()) {
        const hint = gameState.generateHint(gameState.currentWord, 1 - (data.timer / gameState.turnDuration));
        wordDisplay.innerHTML = `<span class="hint-text">${hint}</span>`;
      }
    }

    else if (data.type === 'correct_guess') {
      const p = gameState.players.get(data.playerId);
      if (p) {
        p.score += data.points;
        p.guessedCorrect = true;
      }
      const drawer = gameState.players.get(gameState.currentDrawerId);
      if (drawer) {
        drawer.score += data.drawerPoints;
      }
      gameState.onPlayersUpdate(Array.from(gameState.players.values()));
    }

    else if (data.type === 'turn_end') {
      gameState.status = 'TURN_SUMMARY';
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);

      audioManager.playTick();
      canvasOverlay.classList.remove('hidden');
      canvasOverlay.innerHTML = `<h2>時間到！正確答案是：<span style="color:var(--accent-warning)">${gameState.currentWord}</span></h2><p>即將進入下一輪...</p>`;

      if (gameState.isLocalPlayerHost()) {
        setTimeout(() => {
          nextTurn();
        }, 4000);
      }
    }

    else if (data.type === 'game_over') {
      gameState.status = 'GAME_OVER';
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);
      showGameOverModal(data.rankings);
    }
  });

  /**
   * Word selection modal for Drawer
   */
  function showWordSelectionModal() {
    modalWordSelect.classList.remove('hidden');
    wordOptionsContainer.innerHTML = '';

    const options = getRandomWordOptions(gameState.category, 3);
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'word-btn';
      btn.textContent = `${opt.word}`;
      btn.addEventListener('click', () => {
        audioManager.playClick();
        modalWordSelect.classList.add('hidden');
        mqttClient.publish('state', {
          type: 'word_chosen',
          word: opt.word,
          turnDuration: gameState.turnDuration
        });
      });
      wordOptionsContainer.appendChild(btn);
    });
  }

  /**
   * Host Timer Countdown loop
   */
  function startHostTimer(duration) {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    let time = duration;

    gameState.timerInterval = setInterval(() => {
      time--;
      mqttClient.publish('state', { type: 'timer_tick', timer: time, turnDuration: duration });

      if (time <= 0) {
        clearInterval(gameState.timerInterval);
        mqttClient.publish('state', { type: 'turn_end' });
      }
    }, 1000);
  }

  function checkTurnEndCondition() {
    if (!gameState.isLocalPlayerHost()) return;
    const guessers = Array.from(gameState.players.values()).filter(p => p.id !== gameState.currentDrawerId);
    const allGuessed = guessers.length > 0 && guessers.every(p => p.guessedCorrect);
    
    if (allGuessed) {
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);
      mqttClient.publish('state', { type: 'turn_end' });
    }
  }

  function endGame() {
    const rankings = gameState.getSortedLeaderboard();
    mqttClient.publish('state', {
      type: 'game_over',
      rankings: rankings
    });
  }

  /**
   * Game Over Podium Modal
   */
  function showGameOverModal(rankings) {
    audioManager.playWinFanfare();
    triggerConfetti();
    modalGameOver.classList.remove('hidden');

    podiumContainer.innerHTML = '';
    finalScoresList.innerHTML = '';

    const top3 = rankings.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd

    podiumOrder.forEach((p) => {
      const rank = rankings.indexOf(p) + 1;
      const card = document.createElement('div');
      card.className = `podium-place podium-${rank}`;
      card.innerHTML = `
        <div class="podium-avatar">${p.avatar}</div>
        <div class="podium-name">${escapeHtml(p.nickname)}</div>
        <div class="podium-score">${p.score} 分</div>
        <div class="podium-rank">第 ${rank} 名</div>
      `;
      podiumContainer.appendChild(card);
    });

    rankings.slice(3).forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'chat-msg';
      item.innerHTML = `<strong>第 ${idx + 4} 名:</strong> ${p.avatar} ${escapeHtml(p.nickname)} - ${p.score} 分`;
      finalScoresList.appendChild(item);
    });
  }

  btnBackLobby.addEventListener('click', () => {
    audioManager.playClick();
    modalGameOver.classList.add('hidden');
    location.reload();
  });
});
