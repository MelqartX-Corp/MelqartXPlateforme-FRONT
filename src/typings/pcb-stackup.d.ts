declare module 'pcb-stackup' {
  export interface StackupLayerInput {
    gerber: string | NodeJS.ReadableStream | Buffer;
    filename: string;
    type?: string;
    side?: 'top' | 'bottom' | 'all';
    options?: Record<string, any>;
  }

  export interface StackupColorOptions {
    fr4?: string;
    cu?: string;
    cf?: string;
    sm?: string;
    ss?: string;
    sp?: string;
    outline?: string;
  }

  export interface StackupOptions {
    maskWithOutline?: boolean;
    outlineGapFill?: number;
    useOutlineDate?: boolean;
    attributes?: Record<string, string>;
    color?: StackupColorOptions;
  }

  export interface StackupSideOutput {
    svg: string;
    viewBox: [number, number, number, number];
    width: number;
    height: number;
    units: string;
  }

  export interface StackupLayerOutput {
    type: string;
    side: 'top' | 'bottom' | 'all';
    filename: string;
    gerber?: string;
    options?: any;
    converter?: any;
    svg?: string;
  }

  export interface StackupResult {
    top: StackupSideOutput;
    bottom: StackupSideOutput;
    layers: StackupLayerOutput[];
  }

  type StackupCallback = (error: Error | null, result: StackupResult) => void;

  function pcbStackup(
    layers: StackupLayerInput[],
    callback: StackupCallback
  ): void;

  function pcbStackup(
    layers: StackupLayerInput[],
    options: StackupOptions,
    callback: StackupCallback
  ): void;

  export default pcbStackup;
}
