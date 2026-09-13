// ==========================================================================
// MQTT DRAW & GUESS - 2D CANVAS DRAWING ENGINE (SYNCHRONOUS REAL-TIME SYNC)
// ==========================================================================

export class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    // Internal fixed virtual resolution
    this.VIRTUAL_WIDTH = 800;
    this.VIRTUAL_HEIGHT = 550;
    this.canvas.width = this.VIRTUAL_WIDTH;
    this.canvas.height = this.VIRTUAL_HEIGHT;

    this.isDrawing = false;
    this.enabled = false; // Only Drawer can draw
    this.currentTool = 'brush'; // brush, line, rect, circle, fill, eraser
    this.color = '#000000';
    this.lineWidth = 6;
    
    // Local stroke tracking
    this.lastX = 0;
    this.lastY = 0;

    // Buffer for streaming stroke points over MQTT (25ms throttle)
    this.strokeBuffer = [];
    this.throttleTimer = null;
    this.throttleIntervalMs = 25; 

    // Shape start point
    this.shapeStartX = 0;
    this.shapeStartY = 0;
    this.snapshotBeforeShape = null;

    // History for Undo
    this.historyStack = [];
    this.maxHistory = 15;

    // Callbacks for broadcasting over MQTT
    this.onStrokeEmit = null;

    this.initEvents();
  }

  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = this.VIRTUAL_WIDTH / rect.width;
      const scaleY = this.VIRTUAL_HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.isDrawing = true;
      const { x, y } = getPos(e);
      this.lastX = x;
      this.lastY = y;
      this.shapeStartX = x;
      this.shapeStartY = y;
      this.strokeBuffer = [];

      this.saveState();

      if (this.currentTool === 'fill') {
        this.floodFill(Math.round(x), Math.round(y), this.color);
        this.emitStroke({ type: 'fill', x: Math.round(x), y: Math.round(y), color: this.color });
        this.isDrawing = false;
        return;
      }

      if (['rect', 'circle', 'line'].includes(this.currentTool)) {
        this.snapshotBeforeShape = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      } else {
        // Dot stroke
        this.drawSegment(x, y, x, y, this.currentTool === 'eraser' ? '#ffffff' : this.color, this.lineWidth);
        this.strokeBuffer.push({ x1: x, y1: y, x2: x, y2: y });
      }

      this.emitStroke({
        type: 'start',
        x, y,
        color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
        width: this.lineWidth,
        tool: this.currentTool
      });

      this.startBufferTimer();
    };

    const moveDraw = (e) => {
      if (!this.isDrawing || !this.enabled) return;
      e.preventDefault();
      const { x, y } = getPos(e);

      if (['brush', 'eraser'].includes(this.currentTool)) {
        this.drawSegment(this.lastX, this.lastY, x, y, this.currentTool === 'eraser' ? '#ffffff' : this.color, this.lineWidth);
        this.strokeBuffer.push({ x1: this.lastX, y1: this.lastY, x2: x, y2: y });

        this.lastX = x;
        this.lastY = y;
      } else if (['rect', 'circle', 'line'].includes(this.currentTool)) {
        if (this.snapshotBeforeShape) {
          this.ctx.putImageData(this.snapshotBeforeShape, 0, 0);
        }
        this.drawShape(this.currentTool, this.shapeStartX, this.shapeStartY, x, y, this.color, this.lineWidth);
      }
    };

    const endDraw = (e) => {
      if (!this.isDrawing || !this.enabled) return;
      this.isDrawing = false;

      this.flushBuffer();
      this.stopBufferTimer();

      if (['rect', 'circle', 'line'].includes(this.currentTool)) {
        const { x, y } = getPos(e) || { x: this.lastX, y: this.lastY };
        this.emitStroke({
          type: 'shape',
          tool: this.currentTool,
          x1: this.shapeStartX,
          y1: this.shapeStartY,
          x2: x,
          y2: y,
          color: this.color,
          width: this.lineWidth
        });
      } else {
        this.emitStroke({ type: 'end' });
      }
      this.snapshotBeforeShape = null;
    };

    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', moveDraw);
    this.canvas.addEventListener('mouseup', endDraw);
    this.canvas.addEventListener('mouseleave', endDraw);

    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
    this.canvas.addEventListener('touchend', endDraw);
  }

  startBufferTimer() {
    this.stopBufferTimer();
    this.throttleTimer = setInterval(() => {
      this.flushBuffer();
    }, this.throttleIntervalMs);
  }

  stopBufferTimer() {
    if (this.throttleTimer) {
      clearInterval(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  flushBuffer() {
    if (this.strokeBuffer.length > 0) {
      this.emitStroke({
        type: 'draw',
        points: [...this.strokeBuffer],
        color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
        width: this.lineWidth,
        tool: this.currentTool
      });
      this.strokeBuffer = [];
    }
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  setDrawingEnabled(enabled) {
    this.enabled = enabled;
  }

  saveState() {
    if (this.historyStack.length >= this.maxHistory) {
      this.historyStack.shift();
    }
    this.historyStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
  }

  undo() {
    if (this.historyStack.length > 0) {
      const previousState = this.historyStack.pop();
      this.ctx.putImageData(previousState, 0, 0);
      this.emitSnapshot();
    }
  }

  clearCanvas(broadcast = true) {
    this.saveState();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (broadcast && this.enabled) {
      this.emitStroke({ type: 'clear' });
    }
  }

  drawSegment(x1, y1, x2, y2, color, width) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawShape(shape, x1, y1, x2, y2, color, width) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (shape === 'line') {
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
    } else if (shape === 'rect') {
      this.ctx.rect(x1, y1, x2 - x1, y2 - y1);
    } else if (shape === 'circle') {
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      this.ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
    }
    this.ctx.stroke();
  }

  floodFill(startX, startY, fillColorHex) {
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    const tempDiv = document.createElement('div');
    tempDiv.style.color = fillColorHex;
    document.body.appendChild(tempDiv);
    const rgb = window.getComputedStyle(tempDiv).color.match(/\d+/g).map(Number);
    document.body.removeChild(tempDiv);
    const fillR = rgb[0], fillG = rgb[1], fillB = rgb[2], fillA = 255;

    const startPos = (startY * width + startX) * 4;
    const targetR = data[startPos];
    const targetG = data[startPos + 1];
    const targetB = data[startPos + 2];
    const targetA = data[startPos + 3];

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const matchTarget = (pos) => {
      return data[pos] === targetR && data[pos + 1] === targetG && data[pos + 2] === targetB && data[pos + 3] === targetA;
    };

    const queue = [[startX, startY]];
    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const pos = (y * width + x) * 4;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (!matchTarget(pos)) continue;

      data[pos] = fillR;
      data[pos + 1] = fillG;
      data[pos + 2] = fillB;
      data[pos + 3] = fillA;

      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  handleRemoteStroke(data) {
    if (!data) return;

    switch (data.type) {
      case 'draw':
        if (data.points && data.points.length > 0) {
          const color = data.color || '#000000';
          const width = data.width || 6;

          data.points.forEach(p => {
            const x1 = p.x1 !== undefined ? p.x1 : (p.x !== undefined ? p.x : 0);
            const y1 = p.y1 !== undefined ? p.y1 : (p.y !== undefined ? p.y : 0);
            const x2 = p.x2 !== undefined ? p.x2 : x1;
            const y2 = p.y2 !== undefined ? p.y2 : y1;

            this.drawSegment(x1, y1, x2, y2, color, width);
          });
        }
        break;

      case 'shape':
        this.drawShape(data.tool, data.x1, data.y1, data.x2, data.y2, data.color, data.width);
        break;

      case 'fill':
        this.floodFill(data.x, data.y, data.color);
        break;

      case 'clear':
        this.clearCanvas(false);
        break;

      case 'snapshot':
        if (data.dataUrl) {
          this.loadSnapshot(data.dataUrl);
        }
        break;
    }
  }

  emitStroke(strokeData) {
    if (this.onStrokeEmit) {
      this.onStrokeEmit(strokeData);
    }
  }

  emitSnapshot() {
    if (this.onStrokeEmit && this.enabled) {
      this.onStrokeEmit({ type: 'snapshot', dataUrl: this.canvas.toDataURL('image/jpeg', 0.5) });
    }
  }

  getSnapshot() {
    return this.canvas.toDataURL('image/jpeg', 0.5);
  }

  loadSnapshot(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    };
    img.src = dataUrl;
  }
}
