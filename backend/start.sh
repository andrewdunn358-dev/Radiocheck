#!/bin/bash
cd /var/www/radiocheck/backend
source venv/bin/activate
source .env
exec uvicorn server:app --host 0.0.0.0 --port 8001
