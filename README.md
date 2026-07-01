# Quran Desktop

A beautiful, modern, and highly interactive Quran application for your desktop. Built for focus, memorization, and continuous learning, available completely offline for Windows, macOS, and Linux.

## Features

- **Offline Support**: Read the Quran and access your library anywhere without an internet connection.
- **Multiple Mushafs**: Choose between Madani Standard (continuous reading) and Madani Tajweed (page-accurate rendering).
- **Tajweed Support**: Fully rendered Tajweed rules natively processed for accurate recitation.
- **Memorization Planner**: Create customized memorization schedules and track your progress.
- **Group Khatm (Sauka)**: Participate in community readings and complete the Quran together.
- **Cross-Platform**: Natively compiled for Windows, macOS, and Linux using Tauri.
- **Cloud Sync**: Securely sync your bookmarks, reading progress, and settings across devices (powered by Appwrite).

## Installation

You can download the latest installer for your operating system from the [Releases](https://github.com/iredox10/quran-desktop/releases) page.

- **Windows**: Download the `.msi` or `.exe` installer.
- **macOS**: Download the `.dmg` or `.app` file.
- **Linux**: Download the `.deb` or `.AppImage` file.

## Development Setup

To build and run Quran Desktop locally on your machine, you need to set up the development environment.

### Prerequisites

1.  **Node.js**: Install the latest LTS version of [Node.js](https://nodejs.org/).
2.  **Rust**: Install [Rust](https://www.rust-lang.org/tools/install) (required for Tauri).
3.  **Tauri Prerequisites**: Depending on your operating system, you may need to install specific C++ build tools or Linux dependencies (like WebKitGTK). See the official [Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/).

### Getting Started

1.  Clone the repository:
    ```bash
    git clone https://github.com/iredox10/quran-desktop.git
    cd quran-desktop
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run tauri dev
    ```

### Tech Stack
- **Frontend**: React, Vite, Zustand, Tailwind CSS, Framer Motion
- **Desktop Runtime**: Tauri V2
- **Backend/Sync**: Appwrite

## Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.

## Support & Contact

If you have any questions or would like to connect:
- **Email**: idreesadam200@gmail.com
- **LinkedIn**: [Idris Adam](https://www.linkedin.com/in/idris-adam-3ab197117/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
