declare module "json5-writer" {
  interface Json5Writer {
    write(value: any): void;
    toSource(options?: {
      quote?: "single" | "double";
      trailingComma?: boolean;
      quoteKeys?: boolean | undefined;
    }): string;
    toJSON(options?: {
      quote?: "single" | "double";
      trailingComma?: boolean;
      quoteKeys?: boolean | undefined;
    }): string;
    ast: any;
  }

  export function load(jsonStr: string): Json5Writer;
}
