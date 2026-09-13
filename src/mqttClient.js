// ==========================================================================
// MQTT DRAW & GUESS - MQTT NETWORK CLIENT OVER WEBSOCKETS
// ==========================================================================

export class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.roomId = null;
    this.playerId = 'user_' + Math.random().toString(36).substring(2, 9);
    this.listeners = new Map();

    // Primary & Backup WebSocket MQTT Brokers
    this.brokerUrls = [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://test.mosquitto.org:8081'
    ];
  }

  /**
   * Connect to MQTT Broker over WebSockets
   */
  connect(onSuccess, onError) {
    if (this.connected && this.client) {
      if (onSuccess) onSuccess();
      return;
    }

    const brokerUrl = this.brokerUrls[0];
    console.log(`[MQTT] Connecting to ${brokerUrl}...`);

    try {
      // mqtt is available via global script tag window.mqtt or ES module
      const mqttLib = window.mqtt || (typeof mqtt !== 'undefined' ? mqtt : null);
      if (!mqttLib) {
        throw new Error('MQTT library not loaded!');
      }

      this.client = mqttLib.connect(brokerUrl, {
        clientId: 'draw_guess_' + this.playerId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000,
        keepalive: 30
      });

      this.client.on('connect', () => {
        console.log('[MQTT] Connected successfully!');
        this.connected = true;
        if (onSuccess) onSuccess();
        this.emit('connection_change', { status: 'connected' });
      });

      this.client.on('error', (err) => {
        console.error('[MQTT] Connection Error:', err);
        if (onError) onError(err);
      });

      this.client.on('close', () => {
        this.connected = false;
        this.emit('connection_change', { status: 'disconnected' });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const messageStr = payload.toString();
          const data = JSON.parse(messageStr);
          this.handleIncomingMessage(topic, data);
        } catch (e) {
          console.error('[MQTT] Failed to parse message JSON on topic:', topic, e);
        }
      });
    } catch (err) {
      console.error('[MQTT] Init Error:', err);
      if (onError) onError(err);
    }
  }

  /**
   * Join a room and subscribe to all related MQTT topics
   */
  joinRoom(roomId, playerInfo) {
    if (!this.connected) {
      console.warn('[MQTT] Cannot join room, client not connected');
      return;
    }

    this.roomId = roomId;

    const baseTopic = `mqtt-draw/v1/room/${roomId}`;
    const topics = [
      `${baseTopic}/presence`,
      `${baseTopic}/state`,
      `${baseTopic}/stroke`,
      `${baseTopic}/chat`,
      `${baseTopic}/snapshot`
    ];

    topics.forEach(t => {
      this.client.subscribe(t, { qos: 0 }, (err) => {
        if (err) console.error(`[MQTT] Subscribe error on ${t}:`, err);
        else console.log(`[MQTT] Subscribed to ${t}`);
      });
    });

    // Broadcast presence join event
    this.publish('presence', {
      action: 'join',
      playerId: this.playerId,
      nickname: playerInfo.nickname,
      avatar: playerInfo.avatar,
      timestamp: Date.now()
    });
  }

  /**
   * Leave room
   */
  leaveRoom(playerInfo) {
    if (this.roomId && this.connected) {
      this.publish('presence', {
        action: 'leave',
        playerId: this.playerId,
        nickname: playerInfo.nickname,
        avatar: playerInfo.avatar,
        timestamp: Date.now()
      });
      const baseTopic = `mqtt-draw/v1/room/${this.roomId}`;
      this.client.unsubscribe([
        `${baseTopic}/presence`,
        `${baseTopic}/state`,
        `${baseTopic}/stroke`,
        `${baseTopic}/chat`,
        `${baseTopic}/snapshot`
      ]);
      this.roomId = null;
    }
  }

  /**
   * Helper to publish data to a relative sub-topic
   */
  publish(subTopic, data, retain = false) {
    if (!this.connected || !this.roomId) return;
    const fullTopic = `mqtt-draw/v1/room/${this.roomId}/${subTopic}`;
    const payload = JSON.stringify(data);
    this.client.publish(fullTopic, payload, { qos: 0, retain });
  }

  /**
   * Route incoming messages to registered event callbacks
   */
  handleIncomingMessage(topic, data) {
    const parts = topic.split('/');
    const subTopic = parts[parts.length - 1]; // e.g. presence, state, stroke, chat, snapshot

    this.emit(subTopic, data);
  }

  /**
   * Simple Event Emitter implementation
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
}

export const mqttClient = new MQTTClient();
