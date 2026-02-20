# ElectroBun App - Build, Install & Run Guide

## Prerequisites

- **Bun** installed (latest version with `bunx` support)
- **Node.js dependencies**: All listed in `package.json` are installed
- **Linux/macOS/Windows** environment (this guide focuses on Linux)

## Step 1: Build the Application

### Option A: Development Build (Dev)
```bash
cd /home/thanhkt/CODE/electrobun-test/electrobun-app
bun run build
```

**Output**: Creates `build/dev-linux-x64/electrobun-app-dev/` directory
- **Artifact size**: ~145 MB
- **Use case**: Testing during development
- **Issue**: May have missing dependencies (like `libasar.so`)

### Option B: Canary Build (Production-like)
```bash
cd /home/thanhkt/CODE/electrobun-test/electrobun-app
bun run build:canary
```

**Output**:
- Creates `build/canary-linux-x64/` directory
- Creates `artifacts/` folder with:
  - `canary-linux-x64-electrobun-app-canary-Setup.tar.gz` (146 MB)
  - `canary-linux-x64-electrobun-app-canary.tar.zst` (146 MB update file)
  - `canary-linux-x64-update.json`

### Option C: Stable Build
```bash
bun run build:stable
```

**Output**: Same as canary but for stable release channel.

---

## Step 2: Install the Application

### From Canary Artifacts
```bash
# Extract the installer
mkdir -p /tmp/install-extract
cd /tmp/install-extract
tar -xzf /home/thanhkt/CODE/electrobun-test/electrobun-app/artifacts/canary-linux-x64-electrobun-app-canary-Setup.tar.gz

# Run the installer
./installer
```

**What the installer does**:
- Extracts app to `~/.local/share/com.electrobun.app/canary/self-extraction/`
- Creates desktop shortcut (optional)
- Sets up application folders

**Verify installation**:
```bash
ls -la ~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/
```

You should see files including:
- `launcher` (main executable)
- `bun` (Bun runtime)
- `libNativeWrapper.so`
- `libasar.so` ✅ (required dependency)

### Manual Extraction (Alternative)
```bash
cd ~/.local/share/com.electrobun.app/canary/self-extraction/
tar -xf 2aef5ole1kcq8.tar
```

---

## Step 3: Run the Application

### From Installed Location
```bash
~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/launcher
```

### With Timeout (for testing)
```bash
timeout 30 ~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/launcher
```

### Expected Output
```
Launcher starting on linux...
...
Server started at http://localhost:50000
Database migrations completed.
🚀 Server running at http://0.0.0.0:3000
📡 LAN access: http://172.21.45.48:3000
✅ ElectroBun app started!
```

---

## Step 4: Access the Application

### Local Access
```
http://localhost:3000
```

### LAN Access (from another device)
```
http://{YOUR_HOST_IP}:3000
```

Example: If output shows `📡 LAN access: http://172.21.45.48:3000`
- From another computer: `http://172.21.45.48:3000`

---

## Complete Workflow (One Command)

```bash
#!/bin/bash
set -e

# Build
echo "=== Building canary version ==="
cd /home/thanhkt/CODE/electrobun-test/electrobun-app
bun run build:canary

# Install
echo "=== Installing ==="
mkdir -p /tmp/install-extract
cd /tmp/install-extract
tar -xzf /home/thanhkt/CODE/electrobun-test/electrobun-app/artifacts/canary-linux-x64-electrobun-app-canary-Setup.tar.gz
./installer

# Extract app archive
echo "=== Extracting app archive ==="
cd ~/.local/share/com.electrobun.app/canary/self-extraction/
TAR_FILE=$(ls *.tar 2>/dev/null | head -1)
if [ ! -z "$TAR_FILE" ]; then
  tar -xf "$TAR_FILE"
  rm "$TAR_FILE"
fi

# Run
echo "=== Starting application ==="
./electrobun-app-canary/bin/launcher
```

---

## Troubleshooting

### Issue: `libasar.so: cannot open shared object file`
**Cause**: Using dev build without all dependencies  
**Solution**: Use canary build instead
```bash
bun run build:canary
```

### Issue: App crashes on startup
**Check**:
1. Ensure all dependencies are in the `bin/` folder:
   ```bash
   ls ~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/
   ```

2. Look for missing shared libraries:
   ```bash
   ldd ~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/libNativeWrapper.so
   ```

### Issue: Cannot access from LAN
**Check**:
1. App is running and shows: `📡 LAN access: http://{IP}:3000`
2. Firewall allows port 3000:
   ```bash
   sudo ufw allow 3000
   ```
3. Use the correct IP (check with `hostname -I`)

### Issue: CEF/Graphics warnings
- These are normal warnings in headless/non-GPU environments
- If app starts with `✅ ElectroBun app started!`, it's working
- Browser window will still open and load the UI

---

## File Locations Summary

| File/Folder | Location |
|---|---|
| Source code | `/home/thanhkt/CODE/electrobun-test/electrobun-app/src/` |
| Build output (dev) | `/home/thanhkt/CODE/electrobun-test/electrobun-app/build/dev-linux-x64/` |
| Build output (canary) | `/home/thanhkt/CODE/electrobun-test/electrobun-app/build/canary-linux-x64/` |
| Artifacts (install files) | `/home/thanhkt/CODE/electrobun-test/electrobun-app/artifacts/` |
| Installed app | `~/.local/share/com.electrobun.app/canary/self-extraction/` |
| App executable | `~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/bin/launcher` |

---

## What the Build Generates

### Canary Build Contents
```
artifacts/
├── canary-linux-x64-electrobun-app-canary-Setup.tar.gz  ← Download this
├── canary-linux-x64-electrobun-app-canary.tar.zst       ← Update file
└── canary-linux-x64-update.json                          ← Version info
```

### Inside the .tar.gz
- **installer**: Self-extracting archive installer
- **README.txt**: Installation instructions

### After Installation & Extraction
```
~/.local/share/com.electrobun.app/canary/self-extraction/electrobun-app-canary/
├── bin/
│   ├── launcher           ← Run this to start the app
│   ├── bun               ← Bun runtime
│   ├── libNativeWrapper.so
│   ├── libasar.so        ← Required dependency
│   ├── cef/              ← Chromium Embedded Framework
│   └── ...
└── Resources/
    └── main.js
```

---

## Architecture Overview

1. **Build Phase** (`vite build && electrobun build`)
   - Vite bundles React frontend to `dist/`
   - ElectroBun packages frontend + Hono backend + CEF
   
2. **Install Phase** (`./installer`)
   - Self-extracting archive unpacks app
   - Sets up `~/.local/share/` directory structure

3. **Run Phase** (`launcher`)
   - Launches Bun runtime with app code
   - Starts Hono server on port 3000
   - Opens CEF browser window with localhost:3000

4. **Access Phase**
   - Local: `http://localhost:3000`
   - LAN: `http://{HOST_IP}:3000`
