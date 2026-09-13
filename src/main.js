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
  const chatHeaderBadge = document.getElementById('chat-header-badge');

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
    avatar: selectedAvatar,
    joinedAt: Date.now()
  };
  
  const gameState = new GameState(localPlayer);

  // Periodic heartbeat timer
  let heartbeatTimer = null;

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
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      mqttClient.leaveRoom(localPlayer);
      location.reload();
    }
  });

  function enterGameRoom(roomId, config) {
    gameState.roomId = roomId;
    gameState.setRoomConfig(config);
    displayRoomCode.textContent = roomId;

    screenLobby.classList.remove('active');
    screenGame.classList.add('active');
    headerGameInfo.classList.remove('hidden');
    btnLeaveRoom.classList.remove('hidden');

    mqttClient.connect(() => {
      mqttClient.joinRoom(roomId, localPlayer);
      gameState.addOrUpdatePlayer(localPlayer);
      startHeartbeatLoop();
    }, (err) => {
      alert('MQTT 連線失敗，請檢查網路連線或稍後再試！');
    });
  }

  // Heartbeat loop every 3 seconds to keep all players in sync
  function startHeartbeatLoop() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (mqttClient.connected && gameState.roomId) {
        mqttClient.publish('presence', {
          action: 'heartbeat',
          playerId: localPlayer.playerId,
          nickname: localPlayer.nickname,
          avatar: localPlayer.avatar,
          score: gameState.players.get(localPlayer.playerId)?.score || 0,
          joinedAt: localPlayer.joinedAt
        });

        gameState.pruneInactivePlayers();
      }
    }, 3000);
  }

  canvasManager.onStrokeEmit = (strokeData) => {
    if (strokeData.type === 'snapshot') {
      mqttClient.publish('snapshot', strokeData);
    } else {
      mqttClient.publish('stroke', strokeData);
    }
  };

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

    if (gameState.isLocalPlayerDrawer() && gameState.status === 'DRAWING') {
      addChatMessage('系統', '畫家作畫中不能在聊天室劇透喔！', 'system');
      return;
    }

    if (gameState.status === 'DRAWING' && !gameState.isLocalPlayerDrawer()) {
      const localP = gameState.players.get(localPlayer.playerId);
      if (localP && localP.guessedCorrect) {
        addChatMessage('系統', '你已經猜中了，請保持安靜幫大家加油！', 'system');
        return;
      }

      if (text.trim().toLowerCase() === gameState.currentWord.trim().toLowerCase()) {
        audioManager.playCorrect();
        triggerConfetti();

        const points = 100 + Math.round((gameState.timer / gameState.turnDuration) * 200);
        localP.score += points;
        localP.guessedCorrect = true;

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

    mqttClient.publish('chat', {
      senderId: localPlayer.playerId,
      senderName: localPlayer.nickname,
      text: text,
      isCorrect: false
    });
  });

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

  function triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

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

    if (gameState.isLocalPlayerHost() && gameState.status === 'LOBBY') {
      hostControls.classList.remove('hidden');
    } else {
      hostControls.classList.add('hidden');
    }
  };

  btnStartGame.addEventListener('click', () => {
    if (gameState.players.size < 1) {
      alert('房間內至少要有一位玩家才能開始！');
      return;
    }
    audioManager.playClick();
    startNewGameCycle();
  });

  function startNewGameCycle() {
    gameState.status = 'GAME_SETUP';
    gameState.currentRound = 1;
    gameState.drawerIndex = 0;

    gameState.players.forEach(p => p.score = 0);

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

    // Clear local canvas for host
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
   * PRESENCE HANDLER FOR REAL-TIME PLAYER SYNC
   */
  mqttClient.on('presence', (data) => {
    if (!data.playerId) return;

    if (data.action === 'join') {
      gameState.addOrUpdatePlayer(data);
      addChatMessage('系統', `${data.nickname} 加入了房間`, 'system');

      mqttClient.publish('presence', {
        action: 'announce',
        playerId: localPlayer.playerId,
        nickname: localPlayer.nickname,
        avatar: localPlayer.avatar,
        score: gameState.players.get(localPlayer.playerId)?.score || 0,
        joinedAt: localPlayer.joinedAt
      });

      if (gameState.isLocalPlayerDrawer() && gameState.status === 'DRAWING') {
        mqttClient.publish('snapshot', {
          senderId: localPlayer.playerId,
          dataUrl: canvasManager.getSnapshot()
        });
      }
    } else if (data.action === 'announce' || data.action === 'heartbeat') {
      if (data.playerId !== localPlayer.playerId) {
        gameState.addOrUpdatePlayer(data);
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

      // CRITICAL FIX: Clear canvas for EVERYONE in the room when a new turn begins!
      canvasManager.clearCanvas(false);

      const drawer = gameState.players.get(data.drawerId);
      const drawerName = drawer ? drawer.nickname : '玩家';

      if (gameState.isLocalPlayerDrawer()) {
        playerRoleBadge.textContent = '🎨 你是畫家';
        wordDisplay.innerHTML = '<span class="hint-text">請在選題視窗選擇題目...</span>';
        chatForm.classList.remove('pulse-highlight');
        chatHeaderBadge.textContent = '畫家禁言';
        showWordSelectionModal();
      } else {
        playerRoleBadge.textContent = '🔍 猜題者';
        wordDisplay.innerHTML = `<span class="hint-text">等待 ${escapeHtml(drawerName)} 選擇題目中...</span>`;
        chatForm.classList.add('pulse-highlight');
        chatHeaderBadge.textContent = '在此輸入答案👇';
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

      // Ensure canvas is 100% fresh & white when drawing phase starts
      canvasManager.clearCanvas(false);

      if (gameState.isLocalPlayerDrawer()) {
        wordDisplay.innerHTML = `<span>題目：${data.word}</span>`;
        drawingToolbar.classList.remove('disabled');
        canvasManager.setDrawingEnabled(true);
        chatForm.classList.remove('pulse-highlight');
        chatHeaderBadge.textContent = '作畫中';
      } else {
        const hint = gameState.generateHint(data.word, 0);
        wordDisplay.innerHTML = `<span class="hint-text">${hint}</span>`;
        drawingToolbar.classList.add('disabled');
        canvasManager.setDrawingEnabled(false);
        
        chatForm.classList.add('pulse-highlight');
        chatHeaderBadge.textContent = '在此輸入答案👇';
        addChatMessage('系統', '👉 請在右下方聊天框輸入您猜測的答案！', 'system');
        chatInput.focus();
      }

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

      checkTurnEndCondition();
    }

    else if (data.type === 'turn_end') {
      gameState.status = 'TURN_SUMMARY';
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);

      audioManager.playTick();
      canvasOverlay.classList.remove('hidden');
      
      const reasonText = data.reason === 'all_guessed' ? '🎉 全員猜中答案！提前進入下一題！' : '';
      canvasOverlay.innerHTML = `<h2>${reasonText || '時間到！'} 正確答案是：<span style="color:var(--accent-warning)">${gameState.currentWord}</span></h2><p>即將進入下一輪...</p>`;
      chatForm.classList.remove('pulse-highlight');

      if (gameState.isLocalPlayerHost()) {
        setTimeout(() => {
          nextTurn();
        }, 4000);
      }
    }

    else if (data.type === 'game_over') {
      gameState.status = 'GAME_OVER';
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);
      chatForm.classList.remove('pulse-highlight');
      showGameOverModal(data.rankings);
    }
  });

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

  function startHostTimer(duration) {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    let time = duration;

    gameState.timerInterval = setInterval(() => {
      time--;
      mqttClient.publish('state', { type: 'timer_tick', timer: time, turnDuration: duration });

      if (time <= 0) {
        clearInterval(gameState.timerInterval);
        mqttClient.publish('state', { type: 'turn_end', reason: 'timeout' });
      }
    }, 1000);
  }

  function checkTurnEndCondition() {
    if (!gameState.isLocalPlayerHost()) return;
    const guessers = Array.from(gameState.players.values()).filter(p => p.id !== gameState.currentDrawerId);
    const allGuessed = guessers.length > 0 && guessers.every(p => p.guessedCorrect);
    
    if (allGuessed) {
      if (gameState.timerInterval) clearInterval(gameState.timerInterval);
      addChatMessage('系統', '🎉 所有猜題者皆已猜中答案！提前結束本輪！', 'system');
      mqttClient.publish('state', { type: 'turn_end', reason: 'all_guessed' });
    }
  }

  function endGame() {
    const rankings = gameState.getSortedLeaderboard();
    mqttClient.publish('state', {
      type: 'game_over',
      rankings: rankings
    });
  }

  function showGameOverModal(rankings) {
    audioManager.playWinFanfare();
    triggerConfetti();
    modalGameOver.classList.remove('hidden');

    podiumContainer.innerHTML = '';
    finalScoresList.innerHTML = '';

    const top3 = rankings.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

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
