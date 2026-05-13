module.exports = {
  apps: [
    {
      name: "judicore-search",
      script: "uvicorn",
      args: "main:app --host 127.0.0.1 --port 7860 --workers 1",
      interpreter: "/opt/judicore/services/search/venv/bin/python",
      cwd: "/opt/judicore/services/search",
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        LANCE_DIR: "/opt/judicore/lancedb_store",
        TOPK_RERANK: "11",
        TOPK_HYBRID: "80",
        CHROME_PATH: process.env.CHROME_PATH || "",
      },
      error_file: "/opt/judicore/logs/search-error.log",
      out_file: "/opt/judicore/logs/search-out.log",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
