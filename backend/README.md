# 🚀 Base Server

A clean and scalable **Node.js + TypeScript server boilerplate** for building modern backend applications.

Designed with a focus on **clean architecture, maintainability, developer experience, and production-ready development practices**.

---

## ✨ Features

* ⚡ **TypeScript** for type-safe development
* 🚀 **Express.js** REST API foundation
* 🍃 **MongoDB + Mongoose** integration
* 🧪 **Jest** testing setup
* 📝 **Winston** application logging
* 🧹 **ESLint + Prettier** for code quality
* 🌍 **dotenv-flow** environment management
* 🗃️ Database migration support
* 🐳 Docker support
* 🪝 Git hooks with Husky
* 📁 Scalable project structure
* 🔧 Development tooling and scripts

---

## 🛠️ Tech Stack

| Technology | Purpose                 |
| ---------- | ----------------------- |
| Node.js    | Runtime                 |
| TypeScript | Application development |
| Express.js | Web framework           |
| MongoDB    | Database                |
| Mongoose   | ODM                     |
| Jest       | Testing                 |
| Winston    | Logging                 |
| ESLint     | Code quality            |
| Prettier   | Formatting              |
| Docker     | Containerization        |
| Husky      | Git hooks               |

---

## 📁 Project Structure

```text
Base-Server/
│
├── .husky/              # Git hooks
├── .vscode/             # VS Code configuration
├── cli/                 # CLI utilities
├── docker/              # Docker configuration
├── docs/                # Documentation
├── logs/                # Application logs
├── migrations/          # Database migrations
├── scripts/             # Utility scripts
├── setup/               # Setup utilities
│
├── src/
│   ├── config/          # Application configuration
│   ├── controllers/     # Request controllers
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── models/          # Database models
│   ├── middlewares/     # Express middleware
│   ├── utils/           # Utility functions
│   └── server.ts        # Application entry point
│
├── .env.example
├── docker/
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

* Node.js
* npm
* MongoDB

### 1. Clone the repository

```bash
git clone https://github.com/SAADSAEED007/Base-Server.git
cd Base-Server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create your local environment file:

```bash
cp .env.example .env
```

Then update the required values inside `.env`.

### 4. Start the development server

```bash
npm run start:dev
```

The server runs on:

```text
http://localhost:5000
```

---

## 📜 Available Scripts

| Command                 | Description                |
| ----------------------- | -------------------------- |
| `npm run start:dev`     | Start development server   |
| `npm run build`         | Compile TypeScript         |
| `npm run start`         | Start production server    |
| `npm run test`          | Run tests                  |
| `npm run lint`          | Check linting issues       |
| `npm run lint:fix`      | Fix linting issues         |
| `npm run format:check`  | Check code formatting      |
| `npm run format:fix`    | Format the codebase        |
| `npm run migrate:dev`   | Run development migrations |
| `npm run migrate:prod`  | Run production migrations  |
| `npm run dockerize:dev` | Build Docker image         |

---

## 🧪 Testing

Run the test suite with:

```bash
npm run test
```

The project uses **Jest** for unit and application testing.

---

## 🐳 Docker

The project includes Docker support for containerized development.

Build the development image:

```bash
npm run dockerize:dev
```

---

## 🏗️ Architecture

The server follows a modular architecture that separates:

```text
Routes
   ↓
Controllers
   ↓
Services
   ↓
Models
   ↓
MongoDB
```

This separation makes it easier to maintain, test, and extend the application as the project grows.

---

## 🔐 Environment Configuration

Environment-specific values are kept outside the source code.

Use:

```text
.env.example
```

as a template for your local `.env` configuration.

> Never commit sensitive credentials, API keys, or production secrets.

---

## 🎯 Purpose

**Base Server** is intended to serve as a reusable starting point for backend projects.

Instead of repeatedly setting up the same backend infrastructure, developers can use this foundation and focus on building their application's actual business logic.

---

## 📈 Designed For

This boilerplate can be extended for:

* REST APIs
* SaaS applications
* AI-powered applications
* Authentication systems
* Admin dashboards
* Mobile application backends
* Microservices
* Database-driven applications

---

## 🤝 Contributing

Contributions and improvements are welcome.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Commit your changes
6. Push the branch
7. Open a Pull Request

---

## 👨‍💻 Author

**Muhammad Saad Saeed**

Full-Stack Developer & UI/UX Specialist

🌐 Portfolio: https://www.codewithsid.site

💻 GitHub: https://github.com/SAADSAEED007

---

## 📄 License

This project is licensed under the **MIT License**.

---

⭐ If this boilerplate helps you start a project faster, consider giving the repository a star.
