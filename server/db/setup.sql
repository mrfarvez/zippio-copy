-- Run this once as a PostgreSQL administrator, then set DATABASE_URL in .env.
CREATE USER zippio_app WITH PASSWORD 'replace-with-a-local-password';
CREATE DATABASE zippio OWNER zippio_app;
