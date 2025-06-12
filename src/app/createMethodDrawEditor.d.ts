export function createMethodDrawEditor(
    container: HTMLElement,
    opts?: Record<string, any>
  ): Promise<{
    exportSvg: () => string;
    importSvg: (svg: string) => void;
    undo: () => void;
    redo: () => void;
    zoom: (factor: number) => void;
    clear: () => void;
    destroy: () => void;
  }>;
  