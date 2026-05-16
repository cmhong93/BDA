declare module 'dotenv' {
  const dotenv: { config: () => void };
  export default dotenv;
}

declare module 'openai' {
  export default class OpenAI {
    constructor(options: { apiKey: string });
    responses: { create(input: unknown): Promise<unknown> };
  }
}

declare module 'zod' {
  export const z: any;
}

declare module 'html-to-text' {
  export function htmlToText(html: string, options?: unknown): string;
}

declare module 'googleapis' {
  export namespace gmail_v1 {
    export type Gmail = any;
    export type Schema$Message = any;
    export type Schema$MessagePart = any;
  }
  export const google: any;
}

declare module 'sqlite3' {
  const sqlite3: any;
  export default sqlite3;
}

declare module 'sqlite' {
  export type Database = any;
  export function open(options: unknown): Promise<Database>;
}

declare module 'node:fs' {
  export const promises: any;
}

declare module 'node:path' {
  const path: any;
  export default path;
}

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare const Buffer: {
  from(value: string, encoding?: string): { toString(encoding?: string): string };
};
