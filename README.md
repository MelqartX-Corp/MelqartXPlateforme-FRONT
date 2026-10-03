# MELQARTX - Global Supply Chain Platform

MELQARTX is a modern, premium web application designed for global supply chain management. It features a sophisticated UI/UX with glassmorphism, dynamic animations, and a robust Angular-based architecture.

## 🚀 Key Features

- **Premium UI/UX**: Modern split-screen layout with glassmorphism and ambient background animations.
- **Dynamic Loading Screen**: A beautiful, animated splash screen that greets users during application initialization.
- **Advanced Authentication**: Secure Login and Registration flows, including a multi-step **Forgot Password** process with OTP verification and password strength metering.
- **Role-Based Navigation**: Customized experiences for Clients and Administrators.
- **Real-time Dashboard**: Live monitoring of supply chain operations (Client & Admin views).
- **Comprehensive Management**: Tools for quotes, orders, documentation, and organizational management.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- **Node.js**: (Version 18.x or 20.x recommended)
- **NPM**: (Usually bundled with Node.js)
- **Angular CLI**: `npm install -g @angular/cli`

---

## 🏃 Getting Started

Follow these steps to get the project up and running:

### 1. Installation

Clone the repository and install the necessary dependencies:

```bash
# Navigate to the project directory
cd "New folder (2)"

# Install dependencies
npm install
```

### 2. Development Server

Run the application in development mode:

```bash
# Start the dev server
npm start
```

Once the server is running, navigate to `http://localhost:4200/` in your browser. The application will automatically reload if you change any of the source files.

---

## 📦 Build & Deployment

To build the project for production:

```bash
# Generate a production build
npm run build
```

The build artifacts will be stored in the `dist/` directory.

---

## 📂 Project Structure

- `src/app/components`: Reusable UI components (Layout, UI kit, Loading screen).
- `src/app/pages`: Main application views (Auth, Dashboard, Client, Admin).
- `src/app/services`: Core logic and API integration (Authentication, Data services).
- `src/app/app.routes.ts`: Central routing configuration.
- `src/index.html`: Main HTML entry point.
- `tailwind.config.js`: Tailwind CSS design system configuration.

---

## 🎨 Design Reference

The project design is inspired by high-end enterprise platforms, focusing on visual excellence and peak usability.
Original Design: [Figma - Web application interfaces](https://www.figma.com/design/VgDZOp5OSbD7ISa2KwlHcE/Web-application-interfaces)

---

Developed with ❤️ by the MELQARTX Team.
