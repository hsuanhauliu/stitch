import { useState, useRef, useEffect } from 'react';

// Main App component
const App = () => {
  // State for the list of images uploaded by the user
  const [uploadedImages, setUploadedImages] = useState([]);
  // State for the current mode: 'stack', 'grid', or 'trio'
  const [mode, setMode] = useState('stack');
  // State for the stacking direction: 'horizontal' or 'vertical'
  const [stackDirection, setStackDirection] = useState('vertical');
  // State for the trio layout pattern
  const [trioPattern, setTrioPattern] = useState('y-down');
  // State for the URL input field
  const [imageUrl, setImageUrl] = useState('');
  // State to track the image selected from the carousel
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  // State for number of image slots
  const [numberOfSlots, setNumberOfSlots] = useState(2);
  // State for the items currently on the canvas
  const [canvasItems, setCanvasItems] = useState([]);
  // State for line thickness
  const [lineThickness, setLineThickness] = useState(10);
  // State for canvas dimensions, defaulting to 720p
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [canvasHeight, setCanvasHeight] = useState(720);
  // State for background color
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  // State for showing the border
  const [showBorder, setShowBorder] = useState(false);
  // State for border color
  const [borderColor, setBorderColor] = useState('#000000');
  // State for border thickness
  const [borderThickness, setBorderThickness] = useState(4);
  // State for the active item being dragged on the canvas
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // State for the preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const [urlError, setUrlError] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // State for pre-loaded images to prevent flickering
  const [loadedImages, setLoadedImages] = useState({});

  // Local state for deferred input updates
  const [localWidth, setLocalWidth] = useState(canvasWidth);
  const [localHeight, setLocalHeight] = useState(canvasHeight);
  const [localSpacing, setLocalSpacing] = useState(lineThickness);
  const [localBorderThickness, setLocalBorderThickness] = useState(borderThickness);
  const [draftZooms, setDraftZooms] = useState({});

  // Ref to the canvas element for drawing
  const canvasRef = useRef(null);

  const stackPresets = {
    '480p': { width: 640, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 },
  };

  const gridPresets = {
    '480p': { width: 480, height: 480 },
    '720p': { width: 720, height: 720 },
    '1080p': { width: 1080, height: 1080 },
    '4K': { width: 2160, height: 2160 },
  };

  const stackSlots = [2, 3, 4, 5];
  const gridSlots = [4, 9, 16];
  const gridLabels = { 4: '2x2', 9: '3x3', 16: '4x4' };


  const handlePresetClick = (preset) => {
    setCanvasWidth(preset.width);
    setCanvasHeight(preset.height);
  };

  // Effect to update canvas items when the number of slots changes
  useEffect(() => {
    setCanvasItems(currentItems => {
      const currentLength = currentItems.length;
      if (numberOfSlots > currentLength) {
        // Add new placeholders
        const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#2dd4bf', '#ec4899'];
        const itemsToAdd = Array.from({ length: numberOfSlots - currentLength }, (_, i) => ({
          id: `placeholder-${Date.now()}-${currentLength + i}`,
          type: 'placeholder',
          color: colors[(currentLength + i) % colors.length],
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        }));
        return [...currentItems, ...itemsToAdd];
      } else if (numberOfSlots < currentLength) {
        // Remove items from the end
        return currentItems.slice(0, numberOfSlots);
      }
      return currentItems; // No change
    });
  }, [numberOfSlots]);

  // Effect to handle mode change
  useEffect(() => {
    if (mode === 'stack') {
      if (!stackSlots.includes(numberOfSlots)) {
        setNumberOfSlots(2);
      }
    } else if (mode === 'grid') {
      if (!gridSlots.includes(numberOfSlots)) {
        setNumberOfSlots(4);
      }
    } else if (mode === 'trio') {
      setNumberOfSlots(3);
    }
  }, [mode]);


  // Initialize canvas items on mount
  useEffect(() => {
    setNumberOfSlots(2);
  }, []);

  // Sync local state for input fields with the main canvas dimension state
  useEffect(() => {
    setLocalWidth(canvasWidth);
  }, [canvasWidth]);

  useEffect(() => {
    setLocalHeight(canvasHeight);
  }, [canvasHeight]);

  // Effect to pre-load image objects to prevent flickering
  useEffect(() => {
    const imagesToLoad = canvasItems.filter(item => item.type === 'image' && !loadedImages[item.url]);
    if (imagesToLoad.length === 0) return;

    const promises = imagesToLoad.map(item => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve({ url: item.url, img });
      img.onerror = () => resolve({ url: item.url, img: null }); // Handle error gracefully
      img.src = item.url;
    }));

    Promise.all(promises).then(results => {
      setLoadedImages(prev => {
        const newLoaded = { ...prev };
        results.forEach(({ url, img }) => {
          newLoaded[url] = img;
        });
        return newLoaded;
      });
    });
  }, [canvasItems, loadedImages]);

  // Main drawing function, now synchronous
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

    let itemWidth = 0;
    let itemHeight = 0;

    if (mode === 'stack') {
      if (stackDirection === 'vertical') {
        itemWidth = canvas.width;
        itemHeight = canvas.height / numItems;
      } else {
        itemWidth = canvas.width / numItems;
        itemHeight = canvas.height;
      }
    } else if (mode === 'grid') {
      const cols = Math.sqrt(numItems);
      itemWidth = canvas.width / cols;
      itemHeight = canvas.height / cols;
    }

    canvasItems.forEach((item, index) => {
      let x = 0, y = 0, w = itemWidth, h = itemHeight;

      if (mode === 'stack') {
        if (stackDirection === 'vertical') { x = 0; y = index * itemHeight; }
        else { x = index * itemWidth; y = 0; }
      } else if (mode === 'grid') {
        const cols = Math.sqrt(numItems);
        const row = Math.floor(index / cols);
        const col = index % cols;
        x = col * itemWidth;
        y = row * itemHeight;
      }

      ctx.save();

      if (mode === 'trio') {
        const path = new Path2D();
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        if (trioPattern === 'y-down') {
          if (index === 0) { path.moveTo(0, 0); path.lineTo(canvas.width, 0); path.lineTo(cx, cy); }
          else if (index === 1) { path.moveTo(0, 0); path.lineTo(0, canvas.height); path.lineTo(cx, canvas.height); path.lineTo(cx, cy); }
          else { path.moveTo(canvas.width, 0); path.lineTo(cx, cy); path.lineTo(cx, canvas.height); path.lineTo(canvas.width, canvas.height); }
        } else if (trioPattern === 'y-up') {
          if (index === 0) { path.moveTo(0, canvas.height); path.lineTo(canvas.width, canvas.height); path.lineTo(cx, cy); }
          else if (index === 1) { path.moveTo(0, 0); path.lineTo(cx, 0); path.lineTo(cx, cy); path.lineTo(0, canvas.height); }
          else { path.moveTo(canvas.width, 0); path.lineTo(canvas.width, canvas.height); path.lineTo(cx, cy); path.lineTo(cx, 0); }
        } else if (trioPattern === 't-left') {
          if (index === 0) { path.moveTo(0, 0); path.lineTo(cx, 0); path.lineTo(cx, cy); path.lineTo(0, cy); }
          else if (index === 1) { path.moveTo(0, cy); path.lineTo(cx, cy); path.lineTo(cx, canvas.height); path.lineTo(0, canvas.height); }
          else { path.moveTo(cx, 0); path.lineTo(canvas.width, 0); path.lineTo(canvas.width, canvas.height); path.lineTo(cx, canvas.height); }
        } else if (trioPattern === 't-right') {
          if (index === 0) { path.moveTo(cx, 0); path.lineTo(canvas.width, 0); path.lineTo(canvas.width, cy); path.lineTo(cx, cy); }
          else if (index === 1) { path.moveTo(cx, cy); path.lineTo(canvas.width, cy); path.lineTo(canvas.width, canvas.height); path.lineTo(cx, canvas.height); }
          else { path.moveTo(0, 0); path.lineTo(cx, 0); path.lineTo(cx, canvas.height); path.lineTo(0, canvas.height); }
        }
        path.closePath();
        ctx.clip(path);
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
          const itemAspectRatio = destW / destH;
          const imgAspectRatio = img.width / img.height;
          let sWidth, sHeight;
          if (itemAspectRatio > imgAspectRatio) {
            sWidth = img.width;
            sHeight = sWidth / itemAspectRatio;
          } else {
            sHeight = img.height;
            sWidth = sHeight * itemAspectRatio;
          }
          sWidth /= zoom;
          sHeight /= zoom;
          const sx = (img.width - sWidth) / 2 + (item.offsetX || 0);
          const sy = (img.height - sHeight) / 2 + (item.offsetY || 0);
          ctx.drawImage(img, sx, sy, sWidth, sHeight, destX, destY, destW, destH);
        } else {
          ctx.fillStyle = 'rgba(100,100,100,0.5)'; // Loading indicator
          ctx.fillRect(destX, destY, destW, destH);
        }
      }
      ctx.restore();
    });

    if (lineThickness > 0) {
      ctx.strokeStyle = backgroundColor;
      ctx.lineWidth = lineThickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (mode === 'trio') {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        switch (trioPattern) {
          case 'y-down':
            ctx.moveTo(0, 0); ctx.lineTo(cx, cy);
            ctx.moveTo(canvas.width, 0); ctx.lineTo(cx, cy);
            ctx.moveTo(cx, canvas.height); ctx.lineTo(cx, cy);
            break;
          case 'y-up':
            ctx.moveTo(0, canvas.height); ctx.lineTo(cx, cy);
            ctx.moveTo(canvas.width, canvas.height); ctx.lineTo(cx, cy);
            ctx.moveTo(cx, 0); ctx.lineTo(cx, cy);
            break;
          case 't-left':
            ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
            ctx.moveTo(0, cy); ctx.lineTo(cx, cy);
            break;
          case 't-right':
            ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
            ctx.moveTo(canvas.width, cy); ctx.lineTo(cx, cy);
            break;
        }
      } else if (mode === 'stack') {
        for (let i = 1; i < numItems; i++) {
          if (stackDirection === 'vertical') { ctx.moveTo(0, i * itemHeight); ctx.lineTo(canvas.width, i * itemHeight); }
          else { ctx.moveTo(i * itemWidth, 0); ctx.lineTo(i * itemWidth, canvas.height); }
        }
      } else if (mode === 'grid') {
        const cols = Math.sqrt(numItems);
        for (let i = 1; i < cols; i++) {
          ctx.moveTo(i * itemWidth, 0); ctx.lineTo(i * itemWidth, canvas.height);
          ctx.moveTo(0, i * itemHeight); ctx.lineTo(canvas.width, i * itemHeight);
        }
      }
      ctx.stroke();
    }

    if (showBorder) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderThickness;
      const inset = ctx.lineWidth / 2;
      ctx.strokeRect(inset, inset, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
    }
  };

  // Re-draw canvas whenever relevant state changes
  useEffect(() => {
    drawCanvas();
  }, [canvasItems, mode, stackDirection, lineThickness, canvasWidth, canvasHeight, backgroundColor, showBorder, borderColor, borderThickness, trioPattern, loadedImages]);

  // --- REFACTORED FILE PROCESSING LOGIC ---
  const processFiles = (files) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const imagePromises = imageFiles.map(file => {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({
          id: crypto.randomUUID(),
          url: url,
          name: file.name,
          width: img.width,
          height: img.height,
        });
        img.onerror = (err) => reject(err);
        img.src = url;
      });
    });

    Promise.all(imagePromises).then(newImages => {
      setUploadedImages(prev => [...prev, ...newImages]);
    }).catch(err => console.error("Error loading image:", err));
  };

  const handleFileUpload = (event) => {
    processFiles(event.target.files);
  };

  // Handle image URL submission
  const handleImageUrlSubmit = () => {
    if (imageUrl.trim() === '') return;

    const url = imageUrl.trim();
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const newImage = {
        id: crypto.randomUUID(),
        url: url,
        name: 'URL Image',
        width: img.width,
        height: img.height
      };
      setUploadedImages(prev => [...prev, newImage]);
      setImageUrl('');
      setUrlError('');
    };
    img.onerror = () => {
      console.error("Could not load image from URL.");
      setUrlError("Could not load image. Check URL or CORS policy.");
      setTimeout(() => setUrlError(''), 5000);
    };
    img.src = url;
  };

  const handleCanvasMouseDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let clickedIndex = -1;

    if (mode === 'trio') {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      const pathDefs = {
        'y-down': [
          [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: cx, y: cy }],
          [{ x: 0, y: 0 }, { x: 0, y: h }, { x: cx, y: h }, { x: cx, y: cy }],
          [{ x: w, y: 0 }, { x: cx, y: cy }, { x: cx, y: h }, { x: w, y: h }]
        ],
        'y-up': [
          [{ x: 0, y: h }, { x: w, y: h }, { x: cx, y: cy }],
          [{ x: 0, y: 0 }, { x: cx, y: 0 }, { x: cx, y: cy }, { x: 0, y: h }],
          [{ x: w, y: 0 }, { x: w, y: h }, { x: cx, y: cy }, { x: cx, y: 0 }]
        ],
        't-left': [
          [{ x: 0, y: 0 }, { x: cx, y: 0 }, { x: cx, y: cy }, { x: 0, y: cy }],
          [{ x: 0, y: cy }, { x: cx, y: cy }, { x: cx, y: h }, { x: 0, y: h }],
          [{ x: cx, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: cx, y: h }]
        ],
        't-right': [
          [{ x: cx, y: 0 }, { x: w, y: 0 }, { x: w, y: cy }, { x: cx, y: cy }],
          [{ x: cx, y: cy }, { x: w, y: cy }, { x: w, y: h }, { x: cx, y: h }],
          [{ x: 0, y: 0 }, { x: cx, y: 0 }, { x: cx, y: h }, { x: 0, y: h }]
        ]
      };

      const currentPathPolygons = pathDefs[trioPattern];
      if (currentPathPolygons) {
        const tempCtx = canvas.getContext('2d');
        for (let i = 0; i < currentPathPolygons.length; i++) {
          const polygon = currentPathPolygons[i];
          const path = new Path2D();
          path.moveTo(polygon[0].x, polygon[0].y);
          for (let j = 1; j < polygon.length; j++) {
            path.lineTo(polygon[j].x, polygon[j].y);
          }
          path.closePath();

          if (tempCtx.isPointInPath(path, x, y)) {
            clickedIndex = i;
            break;
          }
        }
      }
    } else {
      const numItems = canvasItems.length;
      let itemWidth = 0;
      let itemHeight = 0;
      if (mode === 'stack') {
        if (stackDirection === 'vertical') {
          itemWidth = canvas.width;
          itemHeight = canvas.height / numItems;
        } else {
          itemWidth = canvas.width / numItems;
          itemHeight = canvas.height;
        }
      } else if (mode === 'grid') {
        const cols = Math.sqrt(numItems);
        itemWidth = canvas.width / cols;
        itemHeight = canvas.height / cols;
      }

      for (let index = 0; index < canvasItems.length; index++) {
        let itemX, itemY;
        if (mode === 'stack') {
          if (stackDirection === 'vertical') {
            itemX = 0;
            itemY = index * itemHeight;
          } else {
            itemX = index * itemWidth;
            itemY = 0;
          }
        } else { // grid
          const cols = Math.sqrt(numItems);
          const row = Math.floor(index / cols);
          const col = index % cols;
          itemX = col * itemWidth;
          itemY = row * itemHeight;
        }

        if (x >= itemX && x <= itemX + itemWidth && y >= itemY && y <= itemY + itemHeight) {
          clickedIndex = index;
          break;
        }
      }
    }

    if (clickedIndex !== -1) {
      if (selectedImageIndex !== null && uploadedImages[selectedImageIndex]) {
        const newCanvasItems = [...canvasItems];
        const selectedImage = uploadedImages[selectedImageIndex];
        const originalItem = newCanvasItems[clickedIndex];

        newCanvasItems[clickedIndex] = {
          id: originalItem.id,
          url: selectedImage.url,
          name: selectedImage.name,
          width: selectedImage.width,
          height: selectedImage.height,
          type: 'image',
          zoom: 1,
          offsetX: 0,
          offsetY: 0
        };
        setCanvasItems(newCanvasItems);
        setSelectedImageIndex(null);
      } else if (canvasItems[clickedIndex].type === 'image') {
        setDraggingItem(clickedIndex);
        setDragStart({ x: event.clientX, y: event.clientY });
      }
    }
  };

  const handleCanvasMouseMove = (event) => {
    if (draggingItem === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const item = canvasItems[draggingItem];
    if (item.type !== 'image' || !item.width || !item.height) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Recalculate dimensions to find scaling factor
    const numItems = canvasItems.length;
    let destW = 0, destH = 0;

    if (mode === 'trio') {
      destW = canvas.width;
      destH = canvas.height;
    } else if (mode === 'stack') {
      if (stackDirection === 'vertical') {
        destW = canvas.width;
        destH = canvas.height / numItems;
      } else {
        destW = canvas.width / numItems;
        destH = canvas.height;
      }
    } else if (mode === 'grid') {
      const cols = Math.sqrt(numItems);
      destW = canvas.width / cols;
      destH = canvas.height / cols;
    }

    const zoom = item.zoom || 1;
    const itemAspectRatio = destW / destH;
    const imgAspectRatio = item.width / item.height;

    let sWidth, sHeight;
    if (itemAspectRatio > imgAspectRatio) {
      sWidth = item.width;
      sHeight = sWidth / itemAspectRatio;
    } else {
      sHeight = item.height;
      sWidth = sHeight * itemAspectRatio;
    }
    sWidth /= zoom;
    sHeight /= zoom;

    const screenToSourceScaleX = (sWidth / destW) * scaleX;
    const screenToSourceScaleY = (sHeight / destH) * scaleY;

    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;

    setCanvasItems(prevItems => {
      const newItems = [...prevItems];
      const updatedItem = { ...newItems[draggingItem] };

      let newOffsetX = (updatedItem.offsetX || 0) - (dx * screenToSourceScaleX);
      let newOffsetY = (updatedItem.offsetY || 0) - (dy * screenToSourceScaleY);

      const maxX = (item.width - sWidth) / 2;
      const maxY = (item.height - sHeight) / 2;

      if (maxX > 0) {
        newOffsetX = Math.max(-maxX, Math.min(maxX, newOffsetX));
      } else {
        newOffsetX = 0;
      }

      if (maxY > 0) {
        newOffsetY = Math.max(-maxY, Math.min(maxY, newOffsetY));
      } else {
        newOffsetY = 0;
      }

      updatedItem.offsetX = newOffsetX;
      updatedItem.offsetY = newOffsetY;

      newItems[draggingItem] = updatedItem;
      return newItems;
    });

    setDragStart({ x: event.clientX, y: event.clientY });
  };

  const handleCanvasMouseUp = () => {
    setDraggingItem(null);
  };

  const handleZoomChange = (itemIndex, newZoom) => {
    setCanvasItems(prevItems => {
      const newItems = [...prevItems];
      newItems[itemIndex].zoom = newZoom;
      return newItems;
    });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawCanvas();
      setTimeout(() => {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'stitch-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 100);
    }
  };

  const handlePreview = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawCanvas();
      setTimeout(() => {
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewImageUrl(dataUrl);
        setIsPreviewOpen(true);
      }, 100);
    }
  };

  const handleResetCanvas = () => {
    const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#2dd4bf', '#ec4899'];
    const newItems = Array.from({ length: numberOfSlots }, (_, i) => ({
      id: `placeholder-${Date.now()}-${i}`,
      type: 'placeholder',
      color: colors[i % colors.length],
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }));
    setCanvasItems(newItems);
  };

  const handleClearGallery = () => {
    setUploadedImages([]);
    setSelectedImageIndex(null);
  };

  const handleNumericInputCommit = (setter, value) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setter(numValue);
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);
    processFiles(event.dataTransfer.files);
  };


  return (
    <>
      <style>{`
        ::selection {
          background-color: #8b5cf6;
          color: #f5f5f5;
        }
      `}</style>
      <div className="h-screen bg-zinc-950 text-zinc-100 font-inter p-4 flex flex-col">
        <header className="w-full max-w-8xl mx-auto grid grid-cols-3 items-center mb-4 flex-shrink-0">
          <div />
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 text-center">Stitch</h1>
          <nav className="flex items-center space-x-2 bg-zinc-900 p-1 rounded-xl shadow-lg justify-self-end">
            <button
              onClick={() => setMode('stack')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${mode === 'stack' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
              title="Stack Images"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rows-3"><path d="M21 6H3" /><path d="M21 12H3" /><path d="M21 18H3" /></svg>
              <span className="ml-2">Stack</span>
            </button>
            <button
              onClick={() => setMode('grid')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${mode === 'grid' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
              title="Grid Images"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-grid"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
              <span className="ml-2">Grid</span>
            </button>
            <button
              onClick={() => setMode('trio')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${mode === 'trio' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
              title="Trio Images"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 20h20L12 2z" transform="rotate(15 12 12)" /></svg>
              <span className="ml-2">Trio</span>
            </button>
          </nav>
        </header>

        {/* Main content area */}
        <main className="w-full max-w-8xl mx-auto flex flex-col lg:flex-row gap-4 flex-grow min-h-0">
          {/* Left sidebar for image inputs and carousel */}
          <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 flex flex-col space-y-4">
            {/* Add Images section */}
            <div className="bg-zinc-900 p-4 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold mb-3 text-zinc-200">Add Images</h2>
              <div className="flex flex-col space-y-3">
                {/* File upload section */}
                <div className="flex flex-col">
                  <label
                    htmlFor="file-upload"
                    className={`w-full flex items-center justify-center px-6 py-10 border-2 border-dashed rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors duration-200 ${isDraggingOver ? 'border-purple-500' : 'border-zinc-700'}`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-zinc-500 mr-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><line x1="21" x2="15" y1="15" y2="9" /></svg>
                    <span className="text-zinc-400 text-sm font-medium">Click or drag to add</span>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* URL input section */}
                <div className="flex flex-col">
                  <div className="flex w-full gap-2">
                    <input
                      id="url-input"
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste image URL"
                      className="flex-grow p-2 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-0"
                    />
                    <button
                      onClick={handleImageUrlSubmit}
                      className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 flex-shrink-0"
                      title="Add URL"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L10 6.07" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L14 17.93" /></svg>
                    </button>
                  </div>
                  {urlError && <p className="text-red-500 text-xs mt-2">{urlError}</p>}
                </div>
              </div>
            </div>

            {/* Vertical carousel for added images */}
            <div className="bg-zinc-900 p-4 rounded-2xl shadow-lg flex-grow flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="text-lg font-bold text-zinc-200">Gallery</h3>
                {uploadedImages.length > 0 && (
                  <button
                    onClick={handleClearGallery}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
                    title="Clear Gallery"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                    Clear
                  </button>
                )}
              </div>
              {uploadedImages.length > 0 && (
                <p className="text-xs text-zinc-400 mb-2 -mt-1">Select an image, then click a section on the canvas to place it.</p>
              )}
              <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                <div className="flex flex-col space-y-2 p-1">
                  {uploadedImages.length > 0 ? (
                    uploadedImages.map((image, index) => (
                      <div
                        key={image.id}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative w-full h-20 rounded-lg cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900' : ''}`}
                        title={image.name}
                      >
                        <div className="w-full h-full rounded-md flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 overflow-hidden">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 italic text-center text-sm py-8">No images added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Center content area */}
          <div className="flex-1 bg-zinc-900 rounded-2xl shadow-lg p-4 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-200">Image Preview</h2>
                <button
                  onClick={handleResetCanvas}
                  className="flex items-center justify-center w-6 h-6 p-1 rounded-full bg-zinc-700 text-red-400 hover:bg-zinc-600 transition-colors duration-200"
                  title="Reset Canvas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                </button>
                <button
                  onClick={handlePreview}
                  className="flex items-center justify-center w-6 h-6 p-1 rounded-full bg-zinc-700 text-blue-400 hover:bg-zinc-600 transition-colors duration-200"
                  title="Preview Full Image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-fullscreen"><path d="M3 7V3h4" /><path d="M21 7V3h-4" /><path d="M7 21H3v-4" /><path d="M17 21h4v-4" /></svg>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center w-6 h-6 p-1 rounded-full bg-zinc-700 text-purple-400 hover:bg-zinc-600 transition-colors duration-200"
                  title="Download Image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                </button>
              </div>
              {mode === 'stack' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setStackDirection('vertical')}
                    className={`p-1.5 rounded-md transition-colors duration-200 ${stackDirection === 'vertical' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    title="Vertical Stack"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-custom-rows">
                      <rect width="18" height="6" x="3" y="4" rx="1" />
                      <rect width="18" height="6" x="3" y="14" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setStackDirection('horizontal')}
                    className={`p-1.5 rounded-md transition-colors duration-200 ${stackDirection === 'horizontal' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    title="Horizontal Stack"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-columns-3"><rect width="6" height="18" x="3" y="3" rx="1" /><rect width="6" height="18" x="15" y="3" rx="1" /></svg>
                  </button>
                </div>
              )}
              {mode === 'trio' && (
                <div className="flex space-x-2">
                  <button onClick={() => setTrioPattern('y-down')} className={`p-1.5 rounded-md ${trioPattern === 'y-down' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Y-Down Pattern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M12 12L2 2M12 12l10-10" /></svg></button>
                  <button onClick={() => setTrioPattern('y-up')} className={`p-1.5 rounded-md ${trioPattern === 'y-up' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`} title="Y-Up Pattern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v10M12 12L2 22M12 12l10 10" /></svg></button>
                  <button onClick={() => setTrioPattern('t-left')} className={`p-1.5 rounded-md ${trioPattern === 't-left' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`} title="T-Left Pattern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h10M12 2v20" /></svg></button>
                  <button onClick={() => setTrioPattern('t-right')} className={`p-1.5 rounded-md ${trioPattern === 't-right' ? 'bg-zinc-700 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800'}`} title="T-Right Pattern"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12H12M12 2v20" /></svg></button>
                </div>
              )}
            </div>
            <div className="flex-grow bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-auto min-h-0">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onDragStart={(e) => e.preventDefault()}
                className="cursor-grab active:cursor-grabbing"
              ></canvas>
            </div>
          </div>

          {/* Right sidebar for configuration */}
          <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 flex flex-col space-y-4">
            <div className="bg-zinc-900 p-4 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold mb-3 text-zinc-200">Configuration</h2>
              <div className="flex flex-col space-y-3">
                {mode !== 'trio' && <div>
                  <label className="text-sm font-medium mb-2 text-zinc-400 block">{mode === 'stack' ? 'Number of Images' : 'Grid Size'}</label>
                  <div className="flex flex-wrap gap-2">
                    {(mode === 'stack' ? stackSlots : gridSlots).map(num => (
                      <button
                        key={num}
                        onClick={() => setNumberOfSlots(num)}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${numberOfSlots === num ? 'bg-purple-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                      >
                        {mode === 'grid' ? gridLabels[num] : num}
                      </button>
                    ))}
                  </div>
                </div>}
                <div>
                  <label className="text-sm font-medium mb-2 text-zinc-400 block">Size Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mode === 'stack' ? stackPresets : gridPresets).map(([name, dims]) => (
                      <button key={name} onClick={() => handlePresetClick(dims)} className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors">
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="canvas-width" className="text-sm font-medium mb-1 text-zinc-400 block">Width</label>
                    <input
                      id="canvas-width"
                      type="number"
                      value={localWidth}
                      onChange={(e) => setLocalWidth(e.target.value)}
                      onBlur={() => handleNumericInputCommit(setCanvasWidth, localWidth)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNumericInputCommit(setCanvasWidth, localWidth)}
                      className="w-full p-1.5 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="canvas-height" className="text-sm font-medium mb-1 text-zinc-400 block">Height</label>
                    <input
                      id="canvas-height"
                      type="number"
                      value={localHeight}
                      onChange={(e) => setLocalHeight(e.target.value)}
                      onBlur={() => handleNumericInputCommit(setCanvasHeight, localHeight)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNumericInputCommit(setCanvasHeight, localHeight)}
                      className="w-full p-1.5 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="line-thickness" className="text-sm font-medium mb-1 text-zinc-400 block">Spacing</label>
                    <input
                      id="line-thickness"
                      type="number"
                      value={localSpacing}
                      onChange={(e) => setLocalSpacing(e.target.value)}
                      onBlur={() => handleNumericInputCommit(setLineThickness, localSpacing)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNumericInputCommit(setLineThickness, localSpacing)}
                      className="w-full p-1.5 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="bg-color" className="text-sm font-medium mb-1 text-zinc-400 block">Background</label>
                    <input
                      id="bg-color"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-full h-9 p-1 rounded-md bg-zinc-800 border border-zinc-700 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-zinc-400">
                    <input
                      type="checkbox"
                      checked={showBorder}
                      onChange={(e) => setShowBorder(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-zinc-700 border-zinc-600 rounded focus:ring-purple-500 focus:ring-offset-zinc-900"
                    />
                    <span>Show Border</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="border-thickness" className="text-sm font-medium mb-1 text-zinc-400 block">Border Size</label>
                    <input
                      id="border-thickness"
                      type="number"
                      value={localBorderThickness}
                      onChange={(e) => setLocalBorderThickness(e.target.value)}
                      onBlur={() => handleNumericInputCommit(setBorderThickness, localBorderThickness)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNumericInputCommit(setBorderThickness, localBorderThickness)}
                      className="w-full p-1.5 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200"
                      disabled={!showBorder}
                    />
                  </div>
                  <div>
                    <label htmlFor="border-color" className="text-sm font-medium mb-1 text-zinc-400 block">Border Color</label>
                    <input
                      id="border-color"
                      type="color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="w-full h-9 p-1 rounded-md bg-zinc-800 border border-zinc-700 cursor-pointer"
                      disabled={!showBorder}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col space-y-3 mt-4">
                {canvasItems.map((item, index) => item.type === 'image' && (
                  <div key={item.id}>
                    <label htmlFor={`zoom-${index}`} className="text-sm font-medium mb-1 text-zinc-400">Image {index + 1} Zoom</label>
                    <input
                      id={`zoom-${index}`}
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={draftZooms[index] ?? item.zoom}
                      onChange={(e) => setDraftZooms(prev => ({ ...prev, [index]: parseFloat(e.target.value) }))}
                      onMouseUp={() => handleZoomChange(index, draftZooms[index])}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>

        {/* --- PREVIEW MODAL --- */}
        {isPreviewOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 cursor-zoom-out"
            onClick={() => setIsPreviewOpen(false)}
          >
            <img
              src={previewImageUrl}
              alt="Stitched Image Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 bg-zinc-900 bg-opacity-70 text-white rounded-full p-2 hover:bg-opacity-100 transition-all"
              title="Close Preview"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
