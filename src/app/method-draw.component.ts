import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
// @ts-ignore
import { createMethodDrawEditor } from './createMethodDrawEditor';

@Component({
  selector: 'method-draw',
  template: `<div #container class="editor-host"></div>`,
})
export class MethodDrawComponent implements AfterViewInit {
  @ViewChild('container') containerRef!: ElementRef;
  editor: any;

  async ngAfterViewInit() {
    this.editor = await createMethodDrawEditor(this.containerRef.nativeElement);
  }

  exportSvg() {
    return this.editor?.exportSvg();
  }

  importSvg(svg: string) {
    this.editor?.importSvg(svg);
  }

  clear() {
    this.editor?.clear();
  }
}
