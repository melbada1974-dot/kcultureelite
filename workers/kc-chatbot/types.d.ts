/// <reference types="@cloudflare/vitest-pool-workers" />

declare module "*.md" {
  const content: string;
  export default content;
}
