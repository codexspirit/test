const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const toolButtons = [...document.querySelectorAll(".tool")];
const strokePicker = document.getElementById("strokeColor");
const fillPicker = document.getElementById("fillColor");
const deleteButton = document.getElementById("deleteSelected");
const clearButton = document.getElementById("clearBoard");
const exportButton = document.getElementById("exportPng");

const state = {
  tool: "select",
  drawing: false,
  dragOffset: null,
  startX: 0,
  startY: 0,
  current: null,
  elements: [],
  selectedId: null,
};

const setActiveTool = (tool) => {
  state.tool = tool;
  document.body.classList.toggle("selecting", tool === "select");
  toolButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
};

const pointerPosition = (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

const normalizeRect = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
};

const updateSelection = (id) => {
  state.selectedId = id;
  render();
};

const hitTest = (point) => {
  for (let i = state.elements.length - 1; i >= 0; i -= 1) {
    const element = state.elements[i];
    if (element.type === "rectangle" || element.type === "ellipse") {
      const bounds = normalizeRect({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
      if (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.w &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.h
      ) {
        return element;
      }
    }

    if (element.type === "line") {
      const distance = distanceToSegment(point, { x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
      if (distance < 7) {
        return element;
      }
    }

    if (element.type === "pencil") {
      for (let j = 0; j < element.points.length - 1; j += 1) {
        const distance = distanceToSegment(point, element.points[j], element.points[j + 1]);
        if (distance < 6) {
          return element;
        }
      }
    }
  }

  return null;
};

const distanceToSegment = (p, v, w) => {
  const lengthSq = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (lengthSq === 0) {
    return Math.hypot(p.x - v.x, p.y - v.y);
  }

  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projection = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  };

  return Math.hypot(p.x - projection.x, p.y - projection.y);
};

const drawElement = (element, isSelected = false) => {
  ctx.strokeStyle = element.stroke;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = element.fill;

  if (element.type === "rectangle") {
    const bounds = normalizeRect({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fill();
    ctx.stroke();
    if (isSelected) {
      highlightBounds(bounds);
    }
  }

  if (element.type === "ellipse") {
    const bounds = normalizeRect({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.w / 2,
      bounds.y + bounds.h / 2,
      Math.max(bounds.w / 2, 1),
      Math.max(bounds.h / 2, 1),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
    if (isSelected) {
      highlightBounds(bounds);
    }
  }

  if (element.type === "line") {
    ctx.beginPath();
    ctx.moveTo(element.x, element.y);
    ctx.lineTo(element.x2, element.y2);
    ctx.stroke();
    if (isSelected) {
      highlightBounds(normalizeRect({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 }));
    }
  }

  if (element.type === "pencil") {
    if (element.points.length < 2) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(element.points[0].x, element.points[0].y);
    for (let i = 1; i < element.points.length; i += 1) {
      ctx.lineTo(element.points[i].x, element.points[i].y);
    }
    ctx.stroke();
    if (isSelected) {
      const xs = element.points.map((point) => point.x);
      const ys = element.points.map((point) => point.y);
      highlightBounds({
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      });
    }
  }
};

const highlightBounds = (bounds) => {
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1;
  ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
  ctx.restore();
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const element of state.elements) {
    drawElement(element, element.id === state.selectedId);
  }

  if (state.current) {
    drawElement(state.current);
  }
};

canvas.addEventListener("pointerdown", (event) => {
  const point = pointerPosition(event);
  state.startX = point.x;
  state.startY = point.y;

  if (state.tool === "select") {
    const hit = hitTest(point);
    updateSelection(hit?.id ?? null);

    if (hit) {
      state.drawing = true;
      state.dragOffset = { x: point.x, y: point.y };
    }

    return;
  }

  state.drawing = true;
  state.current = {
    id: crypto.randomUUID(),
    type: state.tool,
    x: point.x,
    y: point.y,
    x2: point.x,
    y2: point.y,
    stroke: strokePicker.value,
    fill: fillPicker.value,
    points: [{ x: point.x, y: point.y }],
  };
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.drawing) {
    return;
  }

  const point = pointerPosition(event);

  if (state.tool === "select" && state.selectedId && state.dragOffset) {
    const target = state.elements.find((item) => item.id === state.selectedId);
    if (!target) {
      return;
    }

    const dx = point.x - state.dragOffset.x;
    const dy = point.y - state.dragOffset.y;

    if (target.type === "pencil") {
      target.points = target.points.map((entry) => ({ x: entry.x + dx, y: entry.y + dy }));
    } else {
      target.x += dx;
      target.y += dy;
      target.x2 += dx;
      target.y2 += dy;
    }

    state.dragOffset = point;
    render();
    return;
  }

  if (!state.current) {
    return;
  }

  if (state.current.type === "pencil") {
    state.current.points.push({ x: point.x, y: point.y });
  } else {
    state.current.x2 = point.x;
    state.current.y2 = point.y;
  }

  render();
});

canvas.addEventListener("pointerup", () => {
  if (!state.drawing) {
    return;
  }

  state.drawing = false;
  state.dragOffset = null;

  if (state.current) {
    state.elements.push(state.current);
    state.current = null;
  }

  render();
});

canvas.addEventListener("dblclick", () => updateSelection(null));

toolButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTool(button.dataset.tool));
});

deleteButton.addEventListener("click", () => {
  if (!state.selectedId) {
    return;
  }

  state.elements = state.elements.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  render();
});

clearButton.addEventListener("click", () => {
  state.elements = [];
  state.selectedId = null;
  state.current = null;
  render();
});

exportButton.addEventListener("click", () => {
  render();
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = "excali-clone.png";
  link.click();
});

setActiveTool("select");
render();
