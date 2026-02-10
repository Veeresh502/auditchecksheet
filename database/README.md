# Database Directory

This directory contains PostgreSQL database scripts and configurations.

## Files

- `init.sql` - Initial database schema setup (executed on first Docker run)
- Migrations are handled by the backend application

## Development

### Start PostgreSQL
```bash
docker-compose up -d postgres
```

### Stop PostgreSQL
```bash
docker-compose down
```

### Access via psql
```bash
psql postgresql://ddams_user:ddams_password@localhost:5432/ddams_db
```

### Access via pgAdmin
- URL: http://localhost:5050
- Email: admin@ddams.com
- Password: admin
