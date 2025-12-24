import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextra from "nextra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
});

const isDev = process.env.NODE_ENV === "development";

export default withNextra({
  // 只在生产环境启用静态导出
  ...(isDev
    ? {}
    : {
        output: "export",
        distDir: "out",
        outputFileTracingRoot: join(__dirname, ".."),
        trailingSlash: true,
      }),
  images: {
    unoptimized: true,
  },
});
