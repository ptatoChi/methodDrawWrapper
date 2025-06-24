import { EventEmitter } from '@angular/core';

export interface MethodDrawState {
  mode: string;
  zoom: number;
  selectedElements: any[];
  currentLayer: any;
  undoStackSize: number;
  redoStackSize: number;
}

export class MethodDrawBridge {
  private editor: any;
  private svgCanvas: any;

  // Angular event emitters
  public stateChanged = new EventEmitter<MethodDrawState>();
  public selectionChanged = new EventEmitter<any[]>();
  public contentChanged = new EventEmitter<void>();
  public modeChanged = new EventEmitter<string>();
  public zoomChanged = new EventEmitter<number>();

  constructor(editor: any, svgCanvas: any) {
    this.editor = editor;
    this.svgCanvas = svgCanvas;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for Method-Draw events and emit Angular events
    const svgCanvas = this.svgCanvas;
    
    // Selection changes
    svgCanvas.bind('selected', (_: any, elems: any[]) => {
      this.selectionChanged.emit(elems);
      this.emitCurrentState();
    });

    // Content changes (drawing, deletion, etc)
    svgCanvas.bind('changed', () => {
      this.contentChanged.emit();
      this.emitCurrentState();
    });

    // Mode changes
    const originalSetMode = svgCanvas.setMode;
    svgCanvas.setMode = (mode: string) => {
      originalSetMode.call(svgCanvas, mode);
      this.modeChanged.emit(mode);
      this.emitCurrentState();
    };

    // Zoom changes
    const originalSetZoom = svgCanvas.setZoom;
    svgCanvas.setZoom = (zoom: number) => {
      originalSetZoom.call(svgCanvas, zoom);
      this.zoomChanged.emit(zoom);
      this.emitCurrentState();
    };
  }

  private emitCurrentState() {
    const state: MethodDrawState = {
      mode: this.svgCanvas.getMode(),
      zoom: this.svgCanvas.getZoom(),
      selectedElements: this.svgCanvas.getSelectedElems(),
      currentLayer: this.svgCanvas.getCurrentDrawing().getCurrentLayer(),
      undoStackSize: this.svgCanvas.undoMgr ? this.svgCanvas.undoMgr.getUndoStackSize() : 0,
      redoStackSize: this.svgCanvas.undoMgr ? this.svgCanvas.undoMgr.getRedoStackSize() : 0
    };
    this.stateChanged.emit(state);
  }

  // Public API methods
  public getState(): MethodDrawState {
    return {
      mode: this.svgCanvas.getMode(),
      zoom: this.svgCanvas.getZoom(),
      selectedElements: this.svgCanvas.getSelectedElems(),
      currentLayer: this.svgCanvas.getCurrentDrawing().getCurrentLayer(),
      undoStackSize: this.svgCanvas.undoMgr ? this.svgCanvas.undoMgr.getUndoStackSize() : 0,
      redoStackSize: this.svgCanvas.undoMgr ? this.svgCanvas.undoMgr.getRedoStackSize() : 0
    };
  }

  public setMode(mode: string) {
    this.svgCanvas.setMode(mode);
  }

  public setZoom(zoom: number) {
    this.svgCanvas.setZoom(zoom);
  }

  public undo() {
    if (this.svgCanvas.undoMgr) {
      this.svgCanvas.undoMgr.undo();
    }
  }

  public redo() {
    if (this.svgCanvas.undoMgr) {
      this.svgCanvas.undoMgr.redo();
    }
  }

  public clear() {
    this.svgCanvas.clear();
  }

  public getSvgString(): string {
    return this.svgCanvas.getSvgString();
  }

  public importSvgString(svgString: string): boolean {
    return this.svgCanvas.setSvgString(svgString);
  }

  // Performance optimizations
  public suspendRendering() {
    // Add a class that disables transitions during bulk operations
    const svgRoot = this.svgCanvas.getSvgRoot();
    if (svgRoot) {
      svgRoot.classList.add('method-draw-suspend-updates');
    }
  }

  public resumeRendering() {
    const svgRoot = this.svgCanvas.getSvgRoot();
    if (svgRoot) {
      svgRoot.classList.remove('method-draw-suspend-updates');
    }
  }

  // Batch operations helper
  public async batch(operations: () => Promise<void>) {
    this.suspendRendering();
    try {
      await operations();
    } finally {
      this.resumeRendering();
    }
  }
} 