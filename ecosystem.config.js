module.exports = {
  apps: [
    {
      name: 'tradescout-app',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      listen_timeout: 8000,
      kill_timeout: 8000,
      shutdown_with_message: true,
    },
  ],
};
