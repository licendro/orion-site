// Config pm2 de l'API de licences : pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [{
    name: 'orion-api',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '150M',       // redémarre si elle dépasse 150 Mo
    node_args: '--max-old-space-size=96',
    env: { NODE_ENV: 'production' },
    time: true,
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
  }],
};
