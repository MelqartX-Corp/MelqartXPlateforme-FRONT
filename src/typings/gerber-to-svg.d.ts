declare module 'gerber-to-svg' {
  interface GerberToSvgOptions {
    attributes?: Record<string, any>;
    objectMode?: boolean;
  }

  function gerberToSvg(
    gerber: string | NodeJS.ReadableStream | Buffer,
    options?: GerberToSvgOptions | ((err: Error | null, svg: string) => void),
    callback?: (err: Error | null, svg: string) => void
  ): any;

  export default gerberToSvg;
}
