import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import fs from "fs";

function overridesSavePlugin() {
  return {
    name: "overrides-save",
    configureServer(server: any) {
      server.middlewares.use(
        "/__save-overrides",
        async (req: any, res: any) => {
          if (req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks).toString();
            fs.writeFileSync(
              resolve(__dirname, "public/overrides.json"),
              body
            );
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("ok");
          } else {
            res.writeHead(405);
            res.end("Method not allowed");
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), overridesSavePlugin()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
