# Filadex - 3D Printing Filament Management System

Filadex is an open-source filament management system for 3D printing enthusiasts. Born from the need for a comprehensive solution to track and manage 3D printing filaments, Filadex offers a clean, intuitive interface for monitoring your filament inventory, usage statistics, and storage information.

![Filadex Logo](https://raw.githubusercontent.com/the-luap/filadex/main/public/logo.svg)

## Screenshots

| Light Mode | Dark Mode |
|------------|-----------|
| ![Light Mode](https://raw.githubusercontent.com/the-luap/filadex/main/screenshot-white.png) | ![Dark Mode](https://raw.githubusercontent.com/the-luap/filadex/main/screenshot-black.png) |

## Features

- **Filament Inventory Management**: Track all your filaments in one place
- **Material & Color Visualization**: See your collection distribution at a glance
- **Detailed Filament Properties**: Record manufacturer, material type, color, weight, and more
- **Usage Tracking**: Monitor remaining filament percentages
- **Statistics Dashboard**: Get insights into your filament collection
- **Filtering & Sorting**: Easily find the filament you need
- **Responsive Design**: Works on desktop and mobile devices
- **Self-hosted**: Keep your data private and secure
- **User Management**: Admin interface for managing users
- **Filament Sharing**: Share your filament collection with others (globally or by material type)
- **Public Filament View**: Shared filament collections include material/color charts and filtering capabilities
- **Dark/Light Mode**: Choose your preferred theme
- **Multi-language Support**: Currently supports English and German

## Quick Start

```bash
# Create a .env file with your configuration
cat > .env << EOL
# Database Configuration
POSTGRES_USER=filadex
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=filadex
PGHOST=db
PGPORT=5432

# Application Configuration
PORT=8080
DEFAULT_ADMIN_PASSWORD=admin  # Password for the default admin user
LOG_LEVEL=INFO  # Options: DEBUG, INFO, WARN, ERROR
EOL

# Run with Docker Compose
docker-compose up -d
```

The application will be available at http://localhost:8080 with default credentials:
- Username: `admin`
- Password: `admin` (you'll be prompted to change this on first login)

## Environment Variables

### Database Configuration
- `POSTGRES_USER`: PostgreSQL username
- `POSTGRES_PASSWORD`: PostgreSQL password
- `POSTGRES_DB`: PostgreSQL database name
- `PGHOST`: PostgreSQL host (default: db)
- `PGPORT`: PostgreSQL port (default: 5432)

### Application Configuration
- `PORT`: Port the application will run on (default: 8080)
- `DEFAULT_ADMIN_PASSWORD`: Default password for the admin user (default: admin)
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)
- `DEFAULT_LANGUAGE`: Default language for new users (default: en)

## Docker Compose Example

```yaml
version: '3'

services:
  app:
    image: theluap/filadex:latest
    ports:
      - "8080:8080"
    environment:
      - PGHOST=db
      - PGPORT=5432
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-admin}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

## Project Links

- **GitHub Repository**: [https://github.com/the-luap/filadex](https://github.com/the-luap/filadex)
- **Issues & Feature Requests**: [https://github.com/the-luap/filadex/issues](https://github.com/the-luap/filadex/issues)

## License

This project is licensed under the MIT License.

---

Made with ❤️ for the 3D printing community
