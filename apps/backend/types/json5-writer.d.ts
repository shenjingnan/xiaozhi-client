declare module "json5-writer" {
  interface Json5Writer {
    write(value: unknown): void;
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
    ast: unknown;
  }

  export function load(jsonStr: string): Json5Writer;
}
