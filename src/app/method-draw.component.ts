import { Component, OnInit, OnDestroy, ElementRef, Output, EventEmitter, ViewChild, AfterViewInit } from '@angular/core';
import { MethodDrawBridge, MethodDrawState } from './method-draw-bridge';
import { createMethodDrawEditor } from './createMethodDrawEditor';

@Component({
  selector: 'method-draw',
  template: `
    <div #container class="editor-host"></div>
  `,
  styles: [':host { display: block; width: 100%; height: 100%; }']
})
export class MethodDrawComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef;
  @Output() stateChanged = new EventEmitter<MethodDrawState>();
  @Output() selectionChanged = new EventEmitter<any[]>();
  @Output() contentChanged = new EventEmitter<void>();
  @Output() modeChanged = new EventEmitter<string>();
  @Output() zoomChanged = new EventEmitter<number>();

  private editor: any;
  private bridge!: MethodDrawBridge;

  constructor() {}

  async ngAfterViewInit() {
    if (!this.containerRef) {
      console.error('Container reference not found');
      return;
    }

    try {
      this.editor = await createMethodDrawEditor(this.containerRef.nativeElement, {
        // Keep default toolset and options
      });
      
      // Initialize bridge
      this.bridge = new MethodDrawBridge(this.editor, this.editor.svgCanvas);
      
      // Forward events
      this.bridge.stateChanged.subscribe(state => this.stateChanged.emit(state));
      this.bridge.selectionChanged.subscribe(elems => this.selectionChanged.emit(elems));
      this.bridge.contentChanged.subscribe(() => this.contentChanged.emit());
      this.bridge.modeChanged.subscribe(mode => this.modeChanged.emit(mode));
      this.bridge.zoomChanged.subscribe(zoom => this.zoomChanged.emit(zoom));
    } catch (error) {
      console.error('Failed to initialize Method-Draw:', error);
    }
  }

  ngOnDestroy() {
    // Clean up
    if (this.editor) {
      this.editor.destroy();
    }
  }

  // Public API methods
  public getState(): MethodDrawState {
    return this.bridge?.getState();
  }

  public setMode(mode: string) {
    this.bridge?.setMode(mode);
  }

  public setZoom(zoom: number) {
    this.bridge?.setZoom(zoom);
  }

  public undo() {
    this.bridge?.undo();
  }

  public redo() {
    this.bridge?.redo();
  }

  public clear() {
    this.bridge?.clear();
  }

  public exportSvg(): string {
    return this.bridge?.getSvgString() || '';
  }

  public importSvg(svgString: string): boolean {
    return this.bridge?.importSvgString(svgString) || false;
  }

  public async batchOperation(operations: () => Promise<void>) {
    if (this.bridge) {
      await this.bridge.batch(operations);
    }
  }
}
