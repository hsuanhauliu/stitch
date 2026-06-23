import { useState, useRef, useEffect } from 'react';

const PLACEHOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#2dd4bf', '#ec4899'];

const makePlaceholder = (index) => ({
  id: `placeholder-${Date.now()}-${index}`,
  type: 'placeholder',
  color: PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length],
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  fillMode: 'fill',
  filters: { brightness: 1, contrast: 1, saturation: 1 },
});

// ── Small reusable components (module scope so their identity is stable
// across App re-renders — otherwise inputs remount and lose focus/commits) ──
const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{children}</p>
);

const ColorSwatch = ({ value, onChange, disabled }) => (
  <label className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer hover:border-zinc-600 transition-colors ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
    <span className="w-5 h-5 rounded-md border border-zinc-600 flex-shrink-0" style={{ background: value }} />
    <span className="text-xs text-zinc-400 font-mono">{value.toUpperCase()}</span>
    <input type="color" value={value} onChange={onChange} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
  </label>
);

const NumInput = ({ label, value, onChange, onCommit, min, disabled, unit }) => (
  <div>
    <SectionLabel>{label}</SectionLabel>
    <div className="flex items-center gap-1.5">
      <input
        type="number" value={value} min={min ?? 0} disabled={disabled}
        onChange={e => { onChange(e.target.value); onCommit(e.target.value); }}
        onBlur={() => onCommit(value)}
        onKeyDown={e => e.key === 'Enter' && onCommit(value)}
        className="w-full p-1.5 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-40"
      />
      {unit && <span className="text-xs text-zinc-500 flex-shrink-0">{unit}</span>}
    </div>
  </div>
);

const iconBtn = (active) =>
  `p-1.5 rounded-lg transition-colors duration-150 ${active ? 'bg-zinc-700 text-purple-400' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'}`;

const App = () => {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [mode, setMode] = useState('grid');
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(2);
  const [trioPattern, setTrioPattern] = useState('y-down');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [numberOfSlots, setNumberOfSlots] = useState(2);
  const [canvasItems, setCanvasItems] = useState([]);
  const [lineThickness, setLineThickness] = useState(10);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [canvasHeight, setCanvasHeight] = useState(720);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [showBorder, setShowBorder] = useState(false);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [borderThickness, setBorderThickness] = useState(4);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [exportQuality, setExportQuality] = useState(0.92);
  const [expandedFilterSlots, setExpandedFilterSlots] = useState(new Set());
  const [galleryDragIndex, setGalleryDragIndex] = useState(null);

  // Undo/redo
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [historyVersion, setHistoryVersion] = useState(0);

  // Local inputs
  const [localWidth, setLocalWidth] = useState(1280);
  const [localHeight, setLocalHeight] = useState(720);
  const [localSpacing, setLocalSpacing] = useState(10);
  const [localBorderThickness, setLocalBorderThickness] = useState(4);
  const [localCornerRadius, setLocalCornerRadius] = useState(0);
  const [localRows, setLocalRows] = useState(1);
  const [localCols, setLocalCols] = useState(2);
  const [draftZooms, setDraftZooms] = useState({});

  const canvasRef = useRef(null);

  const sizePresets = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    'Square': { width: 1080, height: 1080 },
    'Portrait': { width: 1080, height: 1350 },
    'Story': { width: 1080, height: 1920 },
  };
  // Quick row×col layout presets
  const layoutPresets = [
    { label: '1×2', rows: 1, cols: 2 },
    { label: '2×1', rows: 2, cols: 1 },
    { label: '1×3', rows: 1, cols: 3 },
    { label: '3×1', rows: 3, cols: 1 },
    { label: '2×2', rows: 2, cols: 2 },
    { label: '3×3', rows: 3, cols: 3 },
  ];

  // ── History ──────────────────────────────────────────────────────────────
  const pushHistory = (items) => {
    const slice = historyRef.current.slice(0, historyIndexRef.current + 1);
    slice.push(JSON.parse(JSON.stringify(items)));
    if (slice.length > 50) slice.shift();
    historyRef.current = slice;
    historyIndexRef.current = slice.length - 1;
    setHistoryVersion(v => v + 1);
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    setCanvasItems(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    setHistoryVersion(v => v + 1);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    setCanvasItems(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
    setHistoryVersion(v => v + 1);
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // ── Slot helpers ──────────────────────────────────────────────────────────
  const updateSlotItems = (updater) => {
    setCanvasItems(prev => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  };

  const handleClearSlot = (index) => {
    updateSlotItems(prev => {
      const next = [...prev];
      next[index] = makePlaceholder(index);
      return next;
    });
  };

  const handleRotate = (index) => {
    updateSlotItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], rotation: ((next[index].rotation || 0) + 90) % 360 };
      return next;
    });
  };

  const handleFillModeToggle = (index) => {
    updateSlotItems(prev => {
      const next = [...prev];
      const cur = next[index].fillMode || 'fill';
      next[index] = { ...next[index], fillMode: cur === 'fill' ? 'fit' : 'fill' };
      return next;
    });
  };

  const handleFilterChange = (index, key, value) => {
    setCanvasItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], filters: { ...(next[index].filters || { brightness: 1, contrast: 1, saturation: 1 }), [key]: value } };
      return next;
    });
  };

  const handleFilterCommit = () => {
    setCanvasItems(prev => { pushHistory(prev); return prev; });
  };

  // ── Slot count / mode sync ─────────────────────────────────────────────
  useEffect(() => {
    setCanvasItems(current => {
      const colors = PLACEHOLDER_COLORS;
      if (numberOfSlots > current.length) {
        const add = Array.from({ length: numberOfSlots - current.length }, (_, i) => makePlaceholder(current.length + i));
        return [...current, ...add];
      } else if (numberOfSlots < current.length) {
        return current.slice(0, numberOfSlots);
      }
      return current;
    });
  }, [numberOfSlots]);

  useEffect(() => {
    setNumberOfSlots(mode === 'trio' ? 3 : Math.max(1, rows * cols));
  }, [mode, rows, cols]);

  // ── Local input sync ───────────────────────────────────────────────────
  useEffect(() => { setLocalWidth(canvasWidth); }, [canvasWidth]);
  useEffect(() => { setLocalHeight(canvasHeight); }, [canvasHeight]);
  useEffect(() => { setLocalRows(rows); }, [rows]);
  useEffect(() => { setLocalCols(cols); }, [cols]);

  // ── Pre-load images ────────────────────────────────────────────────────
  useEffect(() => {
    const toLoad = canvasItems.filter(item => item.type === 'image' && !loadedImages[item.url]);
    if (toLoad.length === 0) return;
    Promise.all(toLoad.map(item => new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve({ url: item.url, img });
      img.onerror = () => resolve({ url: item.url, img: null });
      img.src = item.url;
    }))).then(results => {
      setLoadedImages(prev => {
        const next = { ...prev };
        results.forEach(({ url, img }) => { next[url] = img; });
        return next;
      });
    });
  }, [canvasItems]);

  // ── Clipboard paste ────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []).filter(i => i.type.startsWith('image/'));
      if (items.length === 0) return;
      processFiles(items.map(i => i.getAsFile()).filter(Boolean));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [historyVersion]);

  // ── Draw ───────────────────────────────────────────────────────────────
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const numItems = canvasItems.length;
    if (numItems === 0) return;

    let itemWidth = 0, itemHeight = 0;
    if (mode === 'grid') {
      itemWidth = canvas.width / cols;
      itemHeight = canvas.height / rows;
    }

    canvasItems.forEach((item, index) => {
      let x = 0, y = 0, w = itemWidth, h = itemHeight;
      if (mode === 'grid') {
        x = (index % cols) * itemWidth;
        y = Math.floor(index / cols) * itemHeight;
      }

      ctx.save();

      if (mode === 'trio') {
        const path = new Path2D();
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const cw = canvas.width, ch = canvas.height;
        if (trioPattern === 'y-down') {
          if (index === 0) { path.moveTo(0,0); path.lineTo(cw,0); path.lineTo(cx,cy); }
          else if (index === 1) { path.moveTo(0,0); path.lineTo(0,ch); path.lineTo(cx,ch); path.lineTo(cx,cy); }
          else { path.moveTo(cw,0); path.lineTo(cx,cy); path.lineTo(cx,ch); path.lineTo(cw,ch); }
        } else if (trioPattern === 'y-up') {
          if (index === 0) { path.moveTo(0,ch); path.lineTo(cw,ch); path.lineTo(cx,cy); }
          else if (index === 1) { path.moveTo(0,0); path.lineTo(cx,0); path.lineTo(cx,cy); path.lineTo(0,ch); }
          else { path.moveTo(cw,0); path.lineTo(cw,ch); path.lineTo(cx,cy); path.lineTo(cx,0); }
        } else if (trioPattern === 't-left') {
          if (index === 0) { path.moveTo(0,0); path.lineTo(cx,0); path.lineTo(cx,cy); path.lineTo(0,cy); }
          else if (index === 1) { path.moveTo(0,cy); path.lineTo(cx,cy); path.lineTo(cx,ch); path.lineTo(0,ch); }
          else { path.moveTo(cx,0); path.lineTo(cw,0); path.lineTo(cw,ch); path.lineTo(cx,ch); }
        } else if (trioPattern === 't-right') {
          if (index === 0) { path.moveTo(cx,0); path.lineTo(cw,0); path.lineTo(cw,cy); path.lineTo(cx,cy); }
          else if (index === 1) { path.moveTo(cx,cy); path.lineTo(cw,cy); path.lineTo(cw,ch); path.lineTo(cx,ch); }
          else { path.moveTo(0,0); path.lineTo(cx,0); path.lineTo(cx,ch); path.lineTo(0,ch); }
        }
        path.closePath();
        ctx.clip(path);
      } else if (cornerRadius > 0) {
        const r = Math.min(cornerRadius, w / 2, h / 2);
        const rp = new Path2D();
        rp.roundRect(x, y, w, h, r);
        ctx.clip(rp);
      }

      const destW = mode === 'trio' ? canvas.width : w;
      const destH = mode === 'trio' ? canvas.height : h;
      const destX = mode === 'trio' ? 0 : x;
      const destY = mode === 'trio' ? 0 : y;

      if (item.type === 'placeholder') {
        ctx.fillStyle = item.color;
        ctx.fillRect(destX, destY, destW, destH);
      } else if (item.type === 'image') {
        const img = loadedImages[item.url];
        if (img) {
          const zoom = item.zoom || 1;
          const rotation = item.rotation || 0;
          const fillMode = item.fillMode || 'fill';
          const { brightness = 1, contrast = 1, saturation = 1 } = item.filters || {};

          ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;

          // For 90/270, the image fills a rotated slot so aspect dims swap
          const swapDims = rotation === 90 || rotation === 270;
          const slotAspect = swapDims ? destH / destW : destW / destH;
          const imgAspect = img.width / img.height;

          let sWidth, sHeight;
          if (fillMode === 'fill') {
            if (imgAspect > slotAspect) { sHeight = img.height; sWidth = sHeight * slotAspect; }
            else { sWidth = img.width; sHeight = sWidth / slotAspect; }
          } else {
            if (slotAspect > imgAspect) { sWidth = img.width; sHeight = sWidth / slotAspect; }
            else { sHeight = img.height; sWidth = sHeight * slotAspect; }
          }
          sWidth /= zoom;
          sHeight /= zoom;

          const maxSX = (img.width - sWidth) / 2;
          const maxSY = (img.height - sHeight) / 2;
          let sx = maxSX + (item.offsetX || 0);
          let sy = maxSY + (item.offsetY || 0);

          ctx.translate(destX + destW / 2, destY + destH / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(img, sx, sy, sWidth, sHeight, -destW / 2, -destH / 2, destW, destH);
          ctx.filter = 'none';
        } else {
          ctx.fillStyle = 'rgba(100,100,100,0.5)';
          ctx.fillRect(destX, destY, destW, destH);
        }
      }
      ctx.restore();
    });

    // Divider lines
    if (lineThickness > 0) {
      ctx.strokeStyle = backgroundColor;
      ctx.lineWidth = lineThickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (mode === 'trio') {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        switch (trioPattern) {
          case 'y-down': ctx.moveTo(0,0); ctx.lineTo(cx,cy); ctx.moveTo(canvas.width,0); ctx.lineTo(cx,cy); ctx.moveTo(cx,canvas.height); ctx.lineTo(cx,cy); break;
          case 'y-up': ctx.moveTo(0,canvas.height); ctx.lineTo(cx,cy); ctx.moveTo(canvas.width,canvas.height); ctx.lineTo(cx,cy); ctx.moveTo(cx,0); ctx.lineTo(cx,cy); break;
          case 't-left': ctx.moveTo(cx,0); ctx.lineTo(cx,canvas.height); ctx.moveTo(0,cy); ctx.lineTo(cx,cy); break;
          case 't-right': ctx.moveTo(cx,0); ctx.lineTo(cx,canvas.height); ctx.moveTo(canvas.width,cy); ctx.lineTo(cx,cy); break;
        }
      } else if (mode === 'grid') {
        for (let i = 1; i < cols; i++) { ctx.moveTo(i * itemWidth, 0); ctx.lineTo(i * itemWidth, canvas.height); }
        for (let i = 1; i < rows; i++) { ctx.moveTo(0, i * itemHeight); ctx.lineTo(canvas.width, i * itemHeight); }
      }
      ctx.stroke();
    }

    if (showBorder) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderThickness;
      const inset = borderThickness / 2;
      ctx.strokeRect(inset, inset, canvas.width - borderThickness, canvas.height - borderThickness);
    }
  };

  useEffect(() => { drawCanvas(); }, [canvasItems, mode, rows, cols, lineThickness, canvasWidth, canvasHeight, backgroundColor, showBorder, borderColor, borderThickness, trioPattern, loadedImages, cornerRadius]);

  // ── File processing ────────────────────────────────────────────────────
  const isHeif = (file) => {
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.type === 'image/heic-sequence' || file.type === 'image/heif-sequence') return true;
    const ext = file.name.split('.').pop().toLowerCase();
    return ext === 'heic' || ext === 'heif';
  };

  const fileToImageEntry = async (file) => {
    let blob = file;
    let name = file.name;

    if (isHeif(file)) {
      try {
        const { default: createLibheif } = await import('https://cdn.jsdelivr.net/npm/libheif-js@1.19.8/libheif-wasm/libheif-bundle.mjs');
        const libheif = await createLibheif();
        const buffer = await file.arrayBuffer();
        const decoder = new libheif.HeifDecoder();
        const images = decoder.decode(new Uint8Array(buffer));
        if (!images || images.length === 0) throw new Error('No images decoded');

        const image = images[0];
        const w = image.get_width();
        const h = image.get_height();

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(w, h);

        await new Promise((resolve, reject) => {
          image.display(imageData, (displayData) => {
            if (!displayData) { reject(new Error('HEIF display failed')); return; }
            resolve();
          });
        });

        ctx.putImageData(imageData, 0, 0);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        name = name.replace(/\.(heic|heif)$/i, '.jpg');
      } catch (err) {
        console.error('HEIF conversion failed:', err);
        return null;
      }
    }

    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve({ id: crypto.randomUUID(), url, name, width: img.width, height: img.height });
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  };

  const processFiles = (files) => {
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || isHeif(f)
    );
    if (imageFiles.length === 0) return;
    Promise.all(imageFiles.map(fileToImageEntry)).then(results => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) setUploadedImages(prev => [...prev, ...valid]);
      const failed = results.length - valid.length;
      if (failed > 0) {
        setUrlError(`${failed} image${failed > 1 ? 's' : ''} could not be loaded`);
        setTimeout(() => setUrlError(''), 4000);
      }
    });
  };

  const handleFileUpload = (e) => processFiles(e.target.files);

  const handleImageUrlSubmit = () => {
    if (!imageUrl.trim()) return;
    const url = imageUrl.trim();
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      setUploadedImages(prev => [...prev, { id: crypto.randomUUID(), url, name: 'URL Image', width: img.width, height: img.height }]);
      setImageUrl('');
      setUrlError('');
    };
    img.onerror = () => {
      setUrlError('Could not load image. Check URL or CORS policy.');
      setTimeout(() => setUrlError(''), 5000);
    };
    img.src = url;
  };

  // ── Gallery reorder ────────────────────────────────────────────────────
  const handleGalleryDragStart = (e, index) => {
    setGalleryDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGalleryDragOver = (e, index) => {
    e.preventDefault();
    if (galleryDragIndex === null || galleryDragIndex === index) return;
    setUploadedImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(galleryDragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setGalleryDragIndex(index);
  };

  const handleGalleryDragEnd = () => setGalleryDragIndex(null);

  // ── Canvas interaction ─────────────────────────────────────────────────
  const getSlotIndex = (canvas, x, y) => {
    const numItems = canvasItems.length;
    if (mode === 'trio') {
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;
      const pathDefs = {
        'y-down': [
          [{x:0,y:0},{x:w,y:0},{x:cx,y:cy}],
          [{x:0,y:0},{x:0,y:h},{x:cx,y:h},{x:cx,y:cy}],
          [{x:w,y:0},{x:cx,y:cy},{x:cx,y:h},{x:w,y:h}]
        ],
        'y-up': [
          [{x:0,y:h},{x:w,y:h},{x:cx,y:cy}],
          [{x:0,y:0},{x:cx,y:0},{x:cx,y:cy},{x:0,y:h}],
          [{x:w,y:0},{x:w,y:h},{x:cx,y:cy},{x:cx,y:0}]
        ],
        't-left': [
          [{x:0,y:0},{x:cx,y:0},{x:cx,y:cy},{x:0,y:cy}],
          [{x:0,y:cy},{x:cx,y:cy},{x:cx,y:h},{x:0,y:h}],
          [{x:cx,y:0},{x:w,y:0},{x:w,y:h},{x:cx,y:h}]
        ],
        't-right': [
          [{x:cx,y:0},{x:w,y:0},{x:w,y:cy},{x:cx,y:cy}],
          [{x:cx,y:cy},{x:w,y:cy},{x:w,y:h},{x:cx,y:h}],
          [{x:0,y:0},{x:cx,y:0},{x:cx,y:h},{x:0,y:h}]
        ]
      };
      const tempCtx = canvas.getContext('2d');
      const polys = pathDefs[trioPattern] || [];
      for (let i = 0; i < polys.length; i++) {
        const path = new Path2D();
        path.moveTo(polys[i][0].x, polys[i][0].y);
        polys[i].slice(1).forEach(p => path.lineTo(p.x, p.y));
        path.closePath();
        if (tempCtx.isPointInPath(path, x, y)) return i;
      }
      return -1;
    }

    const itemWidth = canvas.width / cols;
    const itemHeight = canvas.height / rows;

    for (let i = 0; i < numItems; i++) {
      const ix = (i % cols) * itemWidth;
      const iy = Math.floor(i / cols) * itemHeight;
      if (x >= ix && x <= ix + itemWidth && y >= iy && y <= iy + itemHeight) return i;
    }
    return -1;
  };

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const clickedIndex = getSlotIndex(canvas, x, y);
    if (clickedIndex === -1) return;

    if (selectedImageIndex !== null && uploadedImages[selectedImageIndex]) {
      const sel = uploadedImages[selectedImageIndex];
      const newItems = [...canvasItems];
      const orig = newItems[clickedIndex];
      newItems[clickedIndex] = {
        id: orig.id, url: sel.url, name: sel.name, width: sel.width, height: sel.height,
        type: 'image', zoom: 1, offsetX: 0, offsetY: 0,
        rotation: orig.rotation || 0,
        fillMode: orig.fillMode || 'fill',
        filters: orig.filters || { brightness: 1, contrast: 1, saturation: 1 },
      };
      setCanvasItems(newItems);
      pushHistory(newItems);
      setSelectedImageIndex(null);
    } else if (canvasItems[clickedIndex]?.type === 'image') {
      setDraggingItem(clickedIndex);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (draggingItem === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const item = canvasItems[draggingItem];
    if (item.type !== 'image' || !item.width || !item.height) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let destW, destH;
    if (mode === 'trio') { destW = canvas.width; destH = canvas.height; }
    else { destW = canvas.width / cols; destH = canvas.height / rows; }

    const zoom = item.zoom || 1;
    const rotation = item.rotation || 0;
    const fillMode = item.fillMode || 'fill';
    const swapDims = rotation === 90 || rotation === 270;
    const slotAspect = swapDims ? destH / destW : destW / destH;
    const imgAspect = item.width / item.height;

    let sWidth, sHeight;
    if (fillMode === 'fill') {
      if (imgAspect > slotAspect) { sHeight = item.height; sWidth = sHeight * slotAspect; }
      else { sWidth = item.width; sHeight = sWidth / slotAspect; }
    } else {
      if (slotAspect > imgAspect) { sWidth = item.width; sHeight = sWidth / slotAspect; }
      else { sHeight = item.height; sWidth = sHeight * slotAspect; }
    }
    sWidth /= zoom; sHeight /= zoom;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const ssX = (sWidth / destW) * scaleX;
    const ssY = (sHeight / destH) * scaleY;

    setCanvasItems(prev => {
      const next = [...prev];
      const u = { ...next[draggingItem] };
      const maxX = (item.width - sWidth) / 2;
      const maxY = (item.height - sHeight) / 2;
      u.offsetX = maxX > 0 ? Math.max(-maxX, Math.min(maxX, (u.offsetX || 0) - dx * ssX)) : 0;
      u.offsetY = maxY > 0 ? Math.max(-maxY, Math.min(maxY, (u.offsetY || 0) - dy * ssY)) : 0;
      next[draggingItem] = u;
      return next;
    });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseUp = () => {
    if (draggingItem !== null) {
      setCanvasItems(prev => { pushHistory(prev); return prev; });
      setDraggingItem(null);
    }
  };

  const handleZoomChange = (index, newZoom) => {
    setCanvasItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], zoom: newZoom };
      pushHistory(next);
      return next;
    });
  };

  // ── Aspect ratio lock ──────────────────────────────────────────────────
  const handleWidthCommit = (value) => {
    const n = Number(value);
    if (isNaN(n) || n <= 0) return;
    setCanvasWidth(n);
    if (aspectRatioLocked && canvasWidth > 0) {
      const newH = Math.round(n * (canvasHeight / canvasWidth));
      setCanvasHeight(newH);
      setLocalHeight(newH);
    }
  };

  const handleHeightCommit = (value) => {
    const n = Number(value);
    if (isNaN(n) || n <= 0) return;
    setCanvasHeight(n);
    if (aspectRatioLocked && canvasHeight > 0) {
      const newW = Math.round(n * (canvasWidth / canvasHeight));
      setCanvasWidth(newW);
      setLocalWidth(newW);
    }
  };

  const handleRowsCommit = (value) => {
    const n = Math.round(Number(value));
    if (isNaN(n) || n < 1) return;
    setRows(Math.min(n, 10));
  };

  const handleColsCommit = (value) => {
    const n = Math.round(Number(value));
    if (isNaN(n) || n < 1) return;
    setCols(Math.min(n, 10));
  };

  const applyLayoutPreset = (r, c) => { setRows(r); setCols(c); };

  // ── Download / preview ─────────────────────────────────────────────────
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas();
    setTimeout(() => {
      const mime = exportFormat === 'png' ? 'image/png' : exportFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
      const q = exportFormat === 'png' ? undefined : exportQuality;
      const link = document.createElement('a');
      link.href = canvas.toDataURL(mime, q);
      link.download = `stitch-image.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 100);
  };

  const handlePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas();
    setTimeout(() => { setPreviewImageUrl(canvas.toDataURL('image/png')); setIsPreviewOpen(true); }, 100);
  };

  const handleResetCanvas = () => {
    const items = Array.from({ length: numberOfSlots }, (_, i) => makePlaceholder(i));
    setCanvasItems(items);
    pushHistory(items);
  };

  const handleClearGallery = () => { setUploadedImages([]); setSelectedImageIndex(null); };

  const handleNumericInputCommit = (setter, value) => {
    const n = Number(value);
    if (!isNaN(n)) setter(n);
  };

  const handlePresetClick = (preset) => {
    setCanvasWidth(preset.width);
    setCanvasHeight(preset.height);
  };

  // ── Save / Load ────────────────────────────────────────────────────────
  const imgToBase64 = (img) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  };

  const handleSaveProject = () => {
    const savedImages = uploadedImages.map(img => ({
      ...img,
      url: loadedImages[img.url] ? imgToBase64(loadedImages[img.url]) : img.url,
    }));
    const data = {
      version: 1,
      mode, rows, cols, trioPattern, numberOfSlots,
      canvasWidth, canvasHeight, backgroundColor,
      showBorder, borderColor, borderThickness, lineThickness, cornerRadius,
      exportFormat, exportQuality,
      uploadedImages: savedImages,
      canvasItems,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stitch-project.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.version !== 1) return;

        // Build URL mapping: old url -> data url
        const urlMap = {};
        const restoredImages = (data.uploadedImages || []).map(img => {
          const newImg = { ...img };
          urlMap[img.url] = img.url; // data: URLs stay the same
          return newImg;
        });

        setUploadedImages(restoredImages);

        // Resolve rows/cols, migrating legacy stack/grid projects if needed
        let r = data.rows, c = data.cols;
        if (r == null || c == null) {
          const n = data.numberOfSlots || 2;
          if (data.mode === 'stack') {
            if (data.stackDirection === 'horizontal') { r = 1; c = n; }
            else { r = n; c = 1; }
          } else if (data.mode === 'grid') {
            const s = Math.round(Math.sqrt(n)) || 1;
            r = s; c = s;
          } else { r = 1; c = 2; }
        }
        setRows(r); setCols(c);
        setLocalRows(r); setLocalCols(c);

        setMode(data.mode === 'trio' ? 'trio' : 'grid');
        setTrioPattern(data.trioPattern || 'y-down');
        setCanvasWidth(data.canvasWidth || 1280);
        setCanvasHeight(data.canvasHeight || 720);
        setLocalWidth(data.canvasWidth || 1280);
        setLocalHeight(data.canvasHeight || 720);
        setBackgroundColor(data.backgroundColor || '#000000');
        setShowBorder(data.showBorder || false);
        setBorderColor(data.borderColor || '#ffffff');
        setBorderThickness(data.borderThickness || 4);
        setLocalBorderThickness(data.borderThickness || 4);
        setLineThickness(data.lineThickness || 10);
        setLocalSpacing(data.lineThickness || 10);
        setCornerRadius(data.cornerRadius || 0);
        setLocalCornerRadius(data.cornerRadius || 0);
        setExportFormat(data.exportFormat || 'png');
        setExportQuality(data.exportQuality || 0.92);
        setCanvasItems(data.canvasItems || []);
        pushHistory(data.canvasItems || []);
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Drag & drop for file upload ────────────────────────────────────────
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = (e) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear when leaving the panel entirely (not when moving between child elements)
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingOver(false);
  };
  const handleDrop = (e) => { e.preventDefault(); setIsDraggingOver(false); processFiles(e.dataTransfer.files); };

  // Escape key closes preview modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsPreviewOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background-color: #8b5cf6; color: #f5f5f5; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: #3f3f46; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #8b5cf6; cursor: pointer; border: 2px solid #18181b; }
        input[type=range]:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* ── Top bar ── */}
        <header className="flex-shrink-0 h-12 border-b border-zinc-800/60 flex items-center px-4 gap-3">
          {/* Left: undo/redo/save/load */}
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={!canUndo} title="Undo (⌘Z)"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${canUndo ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 cursor-not-allowed'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
              Undo
            </button>
            <button onClick={handleRedo} disabled={!canRedo} title="Redo (⌘⇧Z)"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${canRedo ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 cursor-not-allowed'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></svg>
              Redo
            </button>

            <div className="w-px h-4 bg-zinc-700 mx-1" />

            <button onClick={handleSaveProject} title="Save project (.json)"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
              Save
            </button>
            <label title="Load project" className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              Load
              <input type="file" accept=".json" onChange={handleLoadProject} className="hidden" />
            </label>
          </div>

          {/* Center: wordmark */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 select-none">
              Stitch
            </h1>
          </div>

          {/* Right: mode switcher + canvas actions */}
          <div className="flex items-center gap-2">
            {/* Mode tabs */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {[
                { id: 'grid',  label: 'Grid',  icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg> },
                { id: 'trio',  label: 'Trio',  icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 22,22 2,22"/></svg> },
              ].map(({ id, label, icon }) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${mode === id ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-zinc-700" />

            {/* Canvas action bar */}
            <div className="flex items-center gap-1">
              <button onClick={handleResetCanvas} title="Reset canvas" className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reset
              </button>
              <button onClick={handlePreview} title="Fullscreen preview" className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M7 21H3v-4"/><path d="M17 21h4v-4"/></svg>
                Preview
              </button>
              <button onClick={handleDownload} title={`Download as ${exportFormat.toUpperCase()}`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left panel: images ── */}
          <aside
            className="w-56 flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Upload */}
            <div className="p-3 border-b border-zinc-800/60">
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 ${isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                <span className="text-xs font-medium text-zinc-400">Drop images here</span>
                <span className="text-[10px] text-zinc-600">or click to browse · paste ⌘V</span>
              </label>
              <input id="file-upload" type="file" multiple onChange={handleFileUpload} className="hidden" />

              <div className="flex gap-1.5 mt-2">
                <input
                  type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImageUrlSubmit()}
                  placeholder="Paste URL…"
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 min-w-0"
                />
                <button onClick={handleImageUrlSubmit} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors">Add</button>
              </div>
              {urlError && <p className="text-red-400 text-[11px] mt-1.5">{urlError}</p>}
            </div>

            {/* Gallery */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Gallery</span>
                {uploadedImages.length > 0 && (
                  <button onClick={handleClearGallery} className="text-[10px] text-zinc-600 hover:text-red-400 font-medium transition-colors">Clear all</button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {uploadedImages.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {uploadedImages.map((image, index) => (
                      <div
                        key={image.id}
                        draggable
                        onDragStart={(e) => handleGalleryDragStart(e, index)}
                        onDragOver={(e) => handleGalleryDragOver(e, index)}
                        onDragEnd={handleGalleryDragEnd}
                        onClick={() => setSelectedImageIndex(index === selectedImageIndex ? null : index)}
                        title={image.name}
                        className={`relative h-16 rounded-lg overflow-hidden cursor-pointer transition-all duration-150 ring-offset-zinc-950 ${selectedImageIndex === index ? 'ring-2 ring-purple-500 ring-offset-1' : 'ring-1 ring-zinc-800 hover:ring-zinc-600'}`}
                      >
                        <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
                        {selectedImageIndex === index && (
                          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                            <div className="bg-purple-500 rounded-full p-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1">
                          <p className="text-[9px] text-white/80 truncate">{image.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <p className="text-xs text-zinc-600">Add images above to get started</p>
                  </div>
                )}
              </div>

              {uploadedImages.length > 0 && (
                <p className="px-3 pb-2 text-[10px] text-zinc-600 flex-shrink-0">
                  {selectedImageIndex !== null ? '✓ Click a slot on the canvas to place' : 'Click to select · drag to reorder'}
                </p>
              )}
            </div>
          </aside>

          {/* ── Center: canvas ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-900/40">
            {/* Sub-toolbar for mode-specific controls */}
            {mode === 'trio' && (
              <div className="flex-shrink-0 h-10 border-b border-zinc-800/60 flex items-center px-4 gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mr-1">Pattern</span>
                {[
                  { id: 'y-down', title: 'Y-Down', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M12 12L2 2M12 12l10-10"/></svg> },
                  { id: 'y-up',   title: 'Y-Up',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v10M12 12L2 22M12 12l10 10"/></svg> },
                  { id: 't-left', title: 'T-Left', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h10M12 2v20"/></svg> },
                  { id: 't-right',title: 'T-Right',icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12H12M12 2v20"/></svg> },
                ].map(({ id, title, icon }) => (
                  <button key={id} onClick={() => setTrioPattern(id)} title={title} className={iconBtn(trioPattern === id)}>{icon}</button>
                ))}
              </div>
            )}

            {/* Canvas area */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-6 min-h-0">
              <div className="relative shadow-2xl rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', cursor: draggingItem !== null ? 'grabbing' : selectedImageIndex !== null ? 'crosshair' : 'grab' }}
                />
                {/* Hint overlay when an image is selected */}
                {selectedImageIndex !== null && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-purple-500/60 rounded-lg" />
                )}
              </div>
            </div>

            {/* Status bar */}
            <div className="flex-shrink-0 h-7 border-t border-zinc-800/60 flex items-center px-4 gap-4">
              <span className="text-[10px] text-zinc-600">{canvasWidth} × {canvasHeight}px</span>
              <span className="text-[10px] text-zinc-600">{mode === 'trio' ? 'Trio' : `Grid · ${rows}×${cols} (${rows * cols} slots)`}</span>
              {selectedImageIndex !== null && (
                <span className="text-[10px] text-purple-400 font-medium">Click a slot to place "{uploadedImages[selectedImageIndex]?.name}" — Esc to cancel</span>
              )}
            </div>
          </div>

          {/* ── Right panel: settings ── */}
          <aside className="w-60 flex-shrink-0 border-l border-zinc-800/60 flex flex-col bg-zinc-950 overflow-y-auto">

            {/* Layout section */}
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <SectionLabel>Layout</SectionLabel>
              {mode !== 'trio' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <NumInput label="Rows" value={localRows} onChange={setLocalRows} onCommit={handleRowsCommit} min={1} />
                    <NumInput label="Columns" value={localCols} onChange={setLocalCols} onCommit={handleColsCommit} min={1} />
                  </div>
                  <p className="text-[10px] text-zinc-600 mb-1.5">Quick layouts</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {layoutPresets.map(({ label, rows: r, cols: c }) => (
                      <button key={label} onClick={() => applyLayoutPreset(r, c)}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${rows === r && cols === c ? 'bg-purple-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[10px] text-zinc-600 mb-1.5">Canvas size</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(sizePresets).map(([name, dims]) => (
                  <button key={name} onClick={() => handlePresetClick(dims)}
                    className="px-2.5 py-1 text-xs rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 font-medium transition-colors">
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas section */}
            <div className="px-4 py-3 border-b border-zinc-800/60 space-y-3">
              <SectionLabel>Canvas</SectionLabel>

              {/* Width / Height */}
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="Width" value={localWidth} onChange={setLocalWidth} onCommit={handleWidthCommit} unit="px" />
                <NumInput label="Height" value={localHeight} onChange={setLocalHeight} onCommit={handleHeightCommit} unit="px" />
              </div>

              {/* Lock ratio */}
              <button onClick={() => setAspectRatioLocked(l => !l)}
                className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${aspectRatioLocked ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                {aspectRatioLocked
                  ? <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                {aspectRatioLocked ? 'Ratio locked' : 'Lock aspect ratio'}
              </button>

              {/* Spacing + bg */}
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="Spacing" value={localSpacing} onChange={setLocalSpacing} onCommit={(v) => handleNumericInputCommit(setLineThickness, v)} unit="px" />
                {mode !== 'trio' && (
                  <NumInput label="Radius" value={localCornerRadius} onChange={setLocalCornerRadius} onCommit={(v) => handleNumericInputCommit(setCornerRadius, v)} unit="px" />
                )}
              </div>

              <div>
                <SectionLabel>Background color</SectionLabel>
                <ColorSwatch value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
              </div>
            </div>

            {/* Border section */}
            <div className="px-4 py-3 border-b border-zinc-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Border</SectionLabel>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div className={`relative w-7 h-4 rounded-full transition-colors ${showBorder ? 'bg-purple-600' : 'bg-zinc-700'}`}
                    onClick={() => setShowBorder(b => !b)}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${showBorder ? 'left-3.5' : 'left-0.5'}`} />
                  </div>
                </label>
              </div>
              {showBorder && (
                <div className="space-y-2">
                  <NumInput label="Thickness" value={localBorderThickness} onChange={setLocalBorderThickness} onCommit={(v) => handleNumericInputCommit(setBorderThickness, v)} unit="px" />
                  <div>
                    <SectionLabel>Border color</SectionLabel>
                    <ColorSwatch value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Export section */}
            <div className="px-4 py-3 border-b border-zinc-800/60 space-y-3">
              <SectionLabel>Export</SectionLabel>
              <div className="flex gap-1.5">
                {['png', 'jpeg', 'webp'].map(fmt => (
                  <button key={fmt} onClick={() => setExportFormat(fmt)}
                    className={`flex-1 py-1 text-[11px] rounded-md font-bold uppercase tracking-wide transition-colors ${exportFormat === fmt ? 'bg-purple-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                    {fmt}
                  </button>
                ))}
              </div>
              {exportFormat !== 'png' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[10px] text-zinc-600">Quality</p>
                    <span className="text-[10px] font-mono text-zinc-400">{Math.round(exportQuality * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="1" step="0.01" value={exportQuality}
                    onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                    className="w-full cursor-pointer" />
                </div>
              )}
            </div>

            {/* Per-slot controls */}
            {canvasItems.some(item => item.type === 'image') && (
              <div className="px-4 py-3 space-y-3">
                <SectionLabel>Slots</SectionLabel>
                {canvasItems.map((item, index) => item.type !== 'image' ? null : (
                  <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    {/* Slot header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-300">Slot {index + 1}</span>
                        <span className="text-[10px] text-zinc-600 truncate max-w-[80px]">{item.name}</span>
                      </div>
                      <button onClick={() => handleClearSlot(index)}
                        className="text-[10px] text-zinc-600 hover:text-red-400 font-medium transition-colors">
                        Clear
                      </button>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Fill / Fit + Rotate row */}
                      <div className="flex gap-1.5">
                        <button onClick={() => handleFillModeToggle(index)}
                          className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-colors ${(item.fillMode || 'fill') === 'fill' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                          {(item.fillMode || 'fill') === 'fill' ? '⬛ Fill' : '⬜ Fit'}
                        </button>
                        <button onClick={() => handleRotate(index)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                          title="Rotate 90°">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>
                          {item.rotation || 0}°
                        </button>
                      </div>

                      {/* Zoom */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[10px] text-zinc-600">Zoom</p>
                          <span className="text-[10px] font-mono text-zinc-400">{((draftZooms[index] ?? item.zoom) || 1).toFixed(1)}×</span>
                        </div>
                        <input type="range" min="0.1" max="10" step="0.1"
                          value={draftZooms[index] ?? item.zoom}
                          onChange={(e) => setDraftZooms(prev => ({ ...prev, [index]: parseFloat(e.target.value) }))}
                          onMouseUp={() => handleZoomChange(index, draftZooms[index] ?? item.zoom)}
                          className="w-full cursor-pointer" />
                      </div>

                      {/* Filters */}
                      <button
                        onClick={() => setExpandedFilterSlots(prev => { const n = new Set(prev); n.has(index) ? n.delete(index) : n.add(index); return n; })}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: expandedFilterSlots.has(index) ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        Filters
                        {expandedFilterSlots.has(index) && <span className="ml-auto text-purple-400">▴ collapse</span>}
                      </button>

                      {expandedFilterSlots.has(index) && (
                        <div className="space-y-2.5 pt-1 border-t border-zinc-800">
                          {[
                            { key: 'brightness', label: 'Brightness' },
                            { key: 'contrast',   label: 'Contrast' },
                            { key: 'saturation', label: 'Saturation' },
                          ].map(({ key, label }) => {
                            const val = (item.filters || {})[key] ?? 1;
                            return (
                              <div key={key}>
                                <div className="flex justify-between items-center mb-1">
                                  <p className="text-[10px] text-zinc-600">{label}</p>
                                  <span className="text-[10px] font-mono text-zinc-400">{Math.round(val * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="3" step="0.05" value={val}
                                  onChange={(e) => handleFilterChange(index, key, parseFloat(e.target.value))}
                                  onMouseUp={handleFilterCommit}
                                  className="w-full cursor-pointer" />
                              </div>
                            );
                          })}
                          <button
                            onClick={() => { handleFilterChange(index, 'brightness', 1); handleFilterChange(index, 'contrast', 1); handleFilterChange(index, 'saturation', 1); setTimeout(handleFilterCommit, 0); }}
                            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                            Reset filters
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />
          </aside>
        </div>

        {/* ── Preview modal ── */}
        {isPreviewOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            onClick={() => setIsPreviewOpen(false)}
          >
            <img
              src={previewImageUrl} alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.8)' }}
            />
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 backdrop-blur text-zinc-300 text-xs font-medium hover:bg-zinc-800 transition-colors border border-zinc-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              Close · Esc
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
