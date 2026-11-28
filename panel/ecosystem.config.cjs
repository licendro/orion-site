// pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [{
    name: 'orion-panel',
    script: 'server.js',
    cwd: __dirname,
    max_memory_restart: '120M',
    node_args: '--max-old-space-size=80',
    env: { NODE_ENV: 'production' },
    time: true,
  }],
};
