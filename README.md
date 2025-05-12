# Filadex - 3D Printing Filament Management System

<div align="center">
  <img src="client/public/logo.svg" alt="Filadex Logo" width="200" height="200">
</div>

Filadex is an open-source filament management system for 3D printing enthusiasts. Born from the need for a comprehensive solution to track and manage 3D printing filaments, Filadex offers a clean, intuitive interface for monitoring your filament inventory, usage statistics, and storage information.

## 🌟 Features

- **Filament Inventory Management**: Track all your filaments in one place
- **Material & Color Visualization**: See your collection distribution at a glance
- **Detailed Filament Properties**: Record manufacturer, material type, color, weight, and more
- **Usage Tracking**: Monitor remaining filament percentages
- **Statistics Dashboard**: Get insights into your filament collection
- **Filtering & Sorting**: Easily find the filament you need
- **Responsive Design**: Works on desktop and mobile devices
- **Self-hosted**: Keep your data private and secure

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
POSTGRES_USER=filadex
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=filadex
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
DATABASE_URL=postgres://username:password@localhost:5432/filadex
```

### Port Configuration

By default, the application runs on port 5000 in development mode. You can change this in the `server/index.ts` file.

For Docker deployment, you can configure the port in the `docker-compose.yml` file.

## 📱 Usage

1. **Adding Filaments**: Click the "Add Filament" button to add a new filament to your inventory
2. **Editing Filaments**: Click the edit icon on a filament card to update its details
3. **Filtering**: Use the sidebar filters to find specific filaments by material, manufacturer, or color
4. **Statistics**: View your collection statistics in the statistics accordion
5. **Visualization**: See your material and color distribution in the pie chart

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📝 Project Background

The inspiration for Filadex came from BambuLab's announcement of a filament management system. While waiting for their official release, I decided to create an open-source alternative that provides simple management with useful statistics. The project evolved to include user management and self-hosting capabilities, making it a versatile solution for the 3D printing community.

Now, I'm excited to share Filadex with the community and welcome contributions to make it even better!

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- All the contributors who have helped shape this project
- The 3D printing community for inspiration and feedback
- Open-source libraries and tools that made this project possible

---

<div align="center">
  <p>Made with ❤️ for the 3D printing community</p>
</div>
