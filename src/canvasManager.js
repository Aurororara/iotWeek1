// ==========================================================================
// MQTT DRAW & GUESS - 2D CANVAS DRAWING ENGINE
// ==========================================================================

export class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    this.isDrawing = false;
    this.enabled = false; // Only Drawer can draw
    this.currentTool = 'brush'; // brush, line, rect, circle, fill, eraser
    this.color = '#000000';
    this.lineWidth = 6;
    
    // Stroke tracking
    this.lastX = 0;
    this.lastY = 0;
    this.pointsBuffer = [];

    // Shape start point
    this.shapeStartX = 0;
    this.shapeStartY = 0;
    this.snapshotBeforeShape = null;

    // History for Undo
    this.historyStack = [];
    this.maxHistory = 15;

    // Callback for broadcasting strokes over MQTT
    this.onStrokeEmit = null;

    this.initEvents();
  }

  initEvents() {
    // Pointer / Mouse / Touch listeners
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: Math.round((clientX - rect.left) * scaleX),
        y: Math.round((clientY - rect.top) * scaleY)
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
      this.pointsBuffer = [{ x, y }];

      // Save state before drawing
      this.saveState();

      if (this.currentTool === 'fill') {
        this.floodFill(x, y, this.color);
        this.emitStroke({ type: 'fill', x, y, color: this.color });
        this.isDrawing = false;
        return;
      }

      if (['rect', 'circle', 'line'].includes(this.currentTool)) {
        this.snapshotBeforeShape = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x, y);

      this.emitStroke({
        type: 'start',
        x, y,
        color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
        width: this.lineWidth,
        tool: this.currentTool
      });
    };

    const moveDraw = (e) => {
      if (!this.isDrawing || !this.enabled) return;
      e.preventDefault();
      const { x, y } = getPos(e);

      if (['brush', 'eraser'].includes(this.currentTool)) {
        this.pointsBuffer.push({ x, y });
        this.drawSegment(this.lastX, this.lastY, x, y, this.currentTool === 'eraser' ? '#ffffff' : this.color, this.lineWidth);

        this.emitStroke({
          type: 'draw',
          points: [{ x: this.lastX, y: this.lastY }, { x, y }],
          color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
          width: this.lineWidth,
          tool: this.currentTool
        });

        this.lastX = x;
        this.lastY = y;
      } else if (['rect', 'circle', 'line'].includes(this.currentTool)) {
        // Preview shape locally
        if (this.snapshotBeforeShape) {
          this.ctx.putImageData(this.snapshotBeforeShape, 0, 0);
        }
        this.drawShape(this.currentTool, this.shapeStartX, this.shapeStartY, x, y, this.color, this.lineWidth);
      }
    };

    const endDraw = (e) => {
      if (!this.isDrawing || !this.enabled) return;
      this.isDrawing = false;
      const { x, y } = getPos(e) || { x: this.lastX, y: this.lastY };

      if (['rect', 'circle', 'line'].includes(this.currentTool)) {
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

    // Attach mouse & touch events
    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', moveDraw);
    this.canvas.addEventListener('mouseup', endDraw);
    this.canvas.addEventListener('mouseleave', endDraw);

    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
    this.canvas.addEventListener('touchend', endDraw);
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
      this.emitStroke({ type: 'snapshot', dataUrl: this.canvas.toDataURL() });
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

  /**
   * Draw line segment
   */
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

  /**
   * Draw Geometric Shapes
   */
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

  /**
   * 4-Direction Flood Fill Bucket
   */
  floodFill(startX, startY, fillColorHex) {
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Convert hex to RGBA
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

  /**
   * Handle incoming remote stroke events from MQTT
   */
  handleRemoteStroke(data) {
    if (!data) return;

    switch (data.type) {
      case 'start':
        this.ctx.beginPath();
        this.ctx.moveTo(data.x, data.y);
        break;
      case 'draw':
        if (data.points && data.points.length > 0) {
          data.points.forEach(p => {
            this.drawSegment(p.x1 || data.points[0].x, p.y1 || data.points[0].y, p.x2 || p.x, p.y2 || p.y, data.color, data.width);
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
          const img = new Image();
          img.onload = () => this.ctx.drawImage(img, 0, 0);
          img.src = data.dataUrl;
        }
        break;
    }
  }

  emitStroke(strokeData) {
    if (this.onStrokeEmit) {
      this.onStrokeEmit(strokeData);
    }
  }

  getSnapshot() {
    return this.canvas.toDataURL();
  }

  loadSnapshot(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }
}
