# CodeRed Installation Guide

## 📋 Prerequisites

Before installing CodeRed, ensure you have the following installed on your system:

- **Node.js** (version 14 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
  
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

## 🚀 Installation Methods

### Method 1: Automatic Setup (Recommended)

This is the easiest way to get started. The setup scripts will automatically install all dependencies.

#### For Mac/Linux:

1. Extract the CodeRed.zip file
2. Open Terminal and navigate to the CodeRed folder:
   ```bash
   cd path/to/CodeRed
   ```
3. Run the setup script:
   ```bash
   ./setup.sh
   ```

#### For Windows:

1. Extract the CodeRed.zip file
2. Open Command Prompt or PowerShell and navigate to the CodeRed folder:
   ```cmd
   cd path\to\CodeRed
   ```
3. Run the setup script:
   ```cmd
   setup.bat
   ```

### Method 2: Manual Setup

If you prefer to install dependencies manually:

1. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```
   This will create a `node_modules/` folder inside the `server/` directory.

2. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```
   This will create a `node_modules/` folder inside the `client/` directory.

## 🎮 Running the Game

After installation, you need to run both the server and client:

### Terminal 1 - Start the Server:
```bash
cd server
npm start
```
The server will start on `http://localhost:3001`

### Terminal 2 - Start the Client:
```bash
cd client
npm start
```
The client will automatically open in your browser at `http://localhost:3000`

## 📁 Folder Structure After Installation

```
CodeRed/
├── server/
│   ├── node_modules/        ← Created after npm install
│   ├── index.js
│   ├── gameState.js
│   ├── socketHandlers.js
│   ├── utils.js
│   └── package.json
│
├── client/
│   ├── node_modules/        ← Created after npm install
│   ├── public/
│   ├── src/
│   └── package.json
│
├── setup.sh
├── setup.bat
└── README.md
```

## 🔧 Troubleshooting

### Issue: "npm: command not found"
**Solution:** Install Node.js from https://nodejs.org/

### Issue: "Permission denied" when running setup.sh
**Solution:** Make the script executable:
```bash
chmod +x setup.sh
./setup.sh
```

### Issue: Port 3000 or 3001 already in use
**Solution:** 
- Close any applications using these ports, or
- Change the ports in the configuration files

### Issue: Dependencies fail to install
**Solution:**
1. Delete `node_modules/` folders (if they exist)
2. Delete `package-lock.json` files (if they exist)
3. Run `npm install` again

## 🌐 Playing with Friends

To play with friends on the same network:

1. Find your local IP address:
   - **Mac/Linux:** `ifconfig | grep inet`
   - **Windows:** `ipconfig`

2. Update `client/src/socket.js` to use your IP instead of localhost:
   ```javascript
   const SOCKET_URL = 'http://YOUR_IP_ADDRESS:3001';
   ```

3. Friends can access the game at `http://YOUR_IP_ADDRESS:3000`

## 📦 What are node_modules?

`node_modules/` folders contain all the third-party libraries and dependencies that CodeRed needs to run. These folders:
- Are created automatically when you run `npm install`
- Are kept separate for server and client
- Are **NOT** included in the zip file to keep download size small
- Are listed in `.gitignore` and should not be committed to version control

## ✅ Verify Installation

After installation, verify everything works:

1. Check server is running:
   - Visit `http://localhost:3001/health`
   - You should see: `{"status":"ok","timestamp":"..."}`

2. Check client is running:
   - Visit `http://localhost:3000`
   - You should see the CodeRed landing page

## 🆘 Need Help?

If you encounter any issues:
1. Check that Node.js is installed correctly
2. Ensure both server and client are running
3. Check the terminal/console for error messages
4. Try deleting `node_modules/` and running `npm install` again

Happy Bug Hunting! 
