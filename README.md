# Filadex - 3D Printing Filament Management System

<div align="center">
  <img src="public/logo.svg" alt="Filadex Logo" width="200" height="200" style="color: #4f46e5;">
</div>

Filadex is an open-source filament management system for 3D printing enthusiasts. Born from the need for a comprehensive solution to track and manage 3D printing filaments, Filadex offers a clean, intuitive interface for monitoring your filament inventory, usage statistics, and storage information. This project is fully AI-coded, showcasing the potential of AI-assisted development in creating practical, user-friendly applications.

## 📸 Screenshots

<div align="center">
  <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
    <div style="flex: 1; min-width: 300px;">
      <p><strong>Light Mode</strong></p>
      <img src="screenshot-white.png" alt="Filadex Light Mode" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    </div>
    <div style="flex: 1; min-width: 300px;">
      <p><strong>Dark Mode</strong></p>
      <img src="screenshot-black.png" alt="Filadex Dark Mode" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    </div>
  </div>
</div>

## 🌟 Features

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

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL database
- Docker & Docker Compose (optional, for containerized deployment)

## 🚀 Installation

### Option 1: Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/filadex.git
cd filadex
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=postgres://username:password@localhost:5432/filadex
```

4. **Initialize the database**

```bash
npm run db:push
node init-data.js
```

5. **Start the development server**

```bash
npm run dev
```

The application will be available at http://localhost:5000

### Option 2: Docker Deployment

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/filadex.git
cd filadex
```

2. **Configure environment variables**

Create a `.env` file in the root directory with the following variables:

```
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
INIT_SAMPLE_DATA=false  # Set to 'true' to initialize with sample data
```

3. **Build and start the containers**

```bash
docker-compose up -d
```

The application will be available at http://localhost:8080 or at the domain configured in your docker-compose.yml file.

## 🔧 Configuration

### Database Configuration

Filadex uses PostgreSQL as its database. You can configure the connection in the `.env` file:

```
# Direct connection string
DATABASE_URL=postgres://username:password@localhost:5432/filadex

# Or individual connection parameters
POSTGRES_USER=filadex
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=filadex
PGHOST=db
PGPORT=5432
```

### Application Configuration

You can configure various aspects of the application using environment variables:

```
# Server Configuration
PORT=8080                     # Port the application will run on
LOG_LEVEL=INFO                # Logging level (DEBUG, INFO, WARN, ERROR)

# Authentication
DEFAULT_ADMIN_PASSWORD=admin  # Default password for the admin user
JWT_SECRET=your_secret_key    # Secret key for JWT token generation

# Localization
DEFAULT_LANGUAGE=en           # Default language for new users (en, de)

# Data Initialization
INIT_SAMPLE_DATA=false        # Set to 'true' to initialize with sample data
```

### Port Configuration

By default, the application runs on port 5000 in development mode. You can change this by setting the `PORT` environment variable.

For Docker deployment, you can configure the port in the `docker-compose.yml` file.

## 📱 Usage

### Authentication and User Management

1. **First Login**: The system comes with a default admin user (username: `admin`, password: `admin`)
2. **Password Change**: On first login, you will be required to change the default password
3. **User Management**: Admin users can access the user management interface by clicking the users icon in the header
4. **Creating Users**: Admins can create new users, set permissions, and manage existing accounts
5. **Sharing Filaments**: Users can share their filament collection by clicking the share icon in the header
   - Share all filaments or select specific material types to share
   - Copy the shareable link with one click
   - Shared collections include material/color charts and filtering capabilities
   - Public view doesn't require authentication

### Filament Management

1. **Adding Filaments**: Click the "Add Filament" button to add a new filament to your inventory
2. **Editing Filaments**: Click the edit icon on a filament card to update its details
3. **Filtering**: Use the sidebar filters to find specific filaments by material, manufacturer, or color
4. **Statistics**: View your collection statistics in the statistics accordion
5. **Visualization**: See your material and color distribution in the pie chart

### CSV Resources and Import/Export

Filadex comes with pre-populated CSV files in the `resources` directory that can be used to quickly set up your filament database:

1. **Materials List** (`materials_init.csv`): Contains various filament material types (PLA, PETG, ABS, etc.)
2. **Filament Colors** (`filament_colors_init.csv`): Contains color names and hex codes organized by manufacturer
3. **Vendors List** (`vendors_init.csv`): Contains a list of filament manufacturers/vendors

To use these resources:

1. Navigate to the Settings dialog by clicking the gear icon in the header
2. Find the Import/Export section for the data type you want to import (Materials, Colors, or Manufacturers)
3. Click "Import CSV" and select the corresponding file from the resources directory
4. The application will import the data, skipping any duplicates

You can also export your current data to CSV files for backup or sharing with the community. The community is encouraged to enhance these resource files by adding more materials, colors, and vendors while avoiding duplicate entries.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📝 Project Background

The inspiration for Filadex came from BambuLab's announcement of a filament management system. While waiting for their official release, I decided to create an open-source alternative that provides simple management with useful statistics. The project evolved to include user management and self-hosting capabilities, making it a versatile solution for the 3D printing community.

What makes Filadex unique is that it was fully coded with the assistance of AI. This project demonstrates how AI can be leveraged to create functional, well-structured applications while maintaining high code quality and user experience standards.

Now, I'm excited to share Filadex with the community and welcome contributions to make it even better!

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📚 Documentation

### API Documentation

Filadex provides a comprehensive API that allows you to interact with all aspects of the application programmatically. The API documentation is available in the [API.md](docs/API.md) file, which includes:

- Detailed information about all available endpoints
- Request and response formats
- Authentication requirements
- Error handling
- Import/export functionality
- And more

### Translation Documentation

Filadex supports multiple languages:

1. **Available Languages**
   - English (en)
   - German (de)

2. **Language Selection**
   - Users can select their preferred language from the language selector in the header
   - Language preference is stored in user settings and persists across sessions
   - The application will automatically detect the browser language on first visit

3. **Adding New Languages**
   - Language files are located in `client/src/i18n/locales/`
   - To add a new language, create a new file following the same structure as the existing ones
   - See our [Translation Guide](docs/TRANSLATION_GUIDE.md) for detailed instructions
   - Check the [Translation Glossary](docs/TRANSLATION_GLOSSARY.md) for terminology consistency
   - For developers, see the [Technical Translation Guide](docs/TRANSLATION_TECHNICAL.md)
   - Submit a pull request to contribute translations

4. **Environment Variables**
   - `DEFAULT_LANGUAGE`: Set the default language for new users (default: "en")

## 🗺️ Roadmap

The following features are planned for future releases:

1. **Additional Languages**
   - Add support for more languages (French, Spanish, Italian, etc.)
   - Improve translation coverage across the application

2. **Advanced Filament Management**
   - Batch operations for filaments (delete, update)
   - Filament usage history tracking
   - Print job association with filaments

3. **Enhanced Sharing Features**
   - QR code generation for shared collections
   - Password protection for shared collections
   - Temporary sharing links with expiration

See the [TODO.md](TODO.md) file for a detailed list of pending tasks and improvements.

## 🙏 Acknowledgements

- All the contributors who have helped shape this project
- The 3D printing community for inspiration and feedback
- Open-source libraries and tools that made this project possible

---

<div align="center">
  <p>Made with ❤️ for the 3D printing community</p>
</div>
