module.exports = {
  apps: [
    {
      name: "finmanager-api",
      script: "node_modules/.bin/tsx",
      args: "src/server/index.ts",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true,
    },
    {
      name: "finmanager-pdf",
      script: "pdf-service/venv/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8080",
      cwd: "./pdf-service",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/pdf-error.log",
      out_file: "logs/pdf-out.log",
      merge_logs: true,
    },
  ],
};
