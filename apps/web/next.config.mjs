import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

export default {
  output: "standalone",
  outputFileTracingRoot: path.join(appDirectory, "../.."),
  serverExternalPackages: ["minecraft-protocol"],
};
