module.exports = {
  apps: [{
    name: 'radiocheck-api',
    cwd: '/var/www/radiocheck/backend',
    script: 'venv/bin/uvicorn',
    args: 'server:app --host 0.0.0.0 --port 8001',
    interpreter: 'none',
    env: {
      PATH: '/var/www/radiocheck/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
    }
  }]
}
