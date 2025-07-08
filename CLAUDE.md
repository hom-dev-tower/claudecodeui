# Claude Code UI - Developer Guide

## Overview
Claude Code UI is a web-based interface for the Claude Code CLI, providing a modern chat interface and code editor for interacting with Claude. This application runs in a Docker environment with special mount configurations.

## Quick Start

### Development Mode
```bash
npm install
npm run dev
```

### Production Mode
```bash
npm run start
```

### Running Behind CloudFlare Tunnel
```bash
# Set environment variable
PUBLIC_URL=https://claude.vustudio.network npm run start
```

## Architecture

### Frontend (React + Vite)
- **Location**: `/src`
- **Key Components**:
  - `ChatInterface.jsx` - Main chat UI with Claude
  - `Sidebar.jsx` - Project navigation and management
  - `Shell.jsx` - Terminal emulator for Claude sessions
  - `MicButton.jsx` - Audio recording and transcription
  - `FileTree.jsx` - File browser and editor
  - `GitPanel.jsx` - Git operations interface

### Backend (Node.js + Express)
- **Location**: `/server`
- **Key Files**:
  - `index.js` - Main server with WebSocket support
  - `projects.js` - Project management and path resolution
  - `claude-cli.js` - Claude CLI integration
  - `whisperlive-client.js` - WhisperLive transcription client
  - `routes/git.js` - Git API endpoints

### WebSocket Endpoints
- `/ws` - Chat communication with Claude
- `/shell` - Terminal emulation

## Key Features

### 1. Audio Transcription
The application supports multiple transcription methods:

#### Whisper ASR Web Service (Recommended)
- **Enabled by default** in production
- Uses whisper-asr-webservice API
- Configuration in `.env`:
  ```
  USE_FASTER_WHISPER=true
  FASTER_WHISPER_URL=https://whispher.vustudio.network
  ```
- Based on faster-whisper implementation
- No API keys required
- Supports all audio formats including WebM
- Returns plain text transcriptions
- Works with enhancement modes when OPENAI_API_KEY is provided

#### OpenAI Whisper API
- Used when Whisper ASR Web Service is disabled
- Requires `OPENAI_API_KEY` in environment
- Supports enhancement modes: prompt, vibe, instructions, architect

#### WhisperLive (Deprecated)
- Not recommended due to audio format incompatibility
- Requires raw Float32Array audio at 16kHz
- WebM format not supported without ffmpeg conversion

### 2. Project Management
- **Create New Projects**: Can create directories if they don't exist
- **Path Resolution**: Intelligent handling of Docker mount paths
- **Display Names**: Custom names for projects without changing paths
- **Auto-Discovery**: Watches Claude's project folder for changes

### 3. Docker Path Handling
Special handling for Docker mount paths:
- `/mount-remote` - Network storage mount
- `/mount-remote2` - Secondary network storage
- `/config` - Configuration directory

The application intelligently converts between Claude's project naming (using dashes) and actual filesystem paths.

### 4. Git Integration
- Branch management and switching
- File status tracking
- Commit history viewing
- Safe handling of non-git directories

## Environment Variables

```bash
# Server Configuration
PORT=3008                    # Backend server port
VITE_PORT=3009              # Frontend dev server port
PUBLIC_URL=https://domain   # Public URL for CloudFlare tunnel

# Whisper ASR Web Service Configuration (Recommended)
USE_FASTER_WHISPER=true     # Enable Whisper transcription
FASTER_WHISPER_URL=https://whispher.vustudio.network  # Whisper ASR API URL

# OpenAI Configuration (optional)
OPENAI_API_KEY=sk-...       # For GPT enhancement of transcriptions

# WhisperLive Configuration (Deprecated)
# USE_WHISPERLIVE=false     # Not recommended
# WHISPERLIVE_URL=wss://url # Requires audio format conversion
```

## Common Issues & Solutions

### 1. Spawn ENOENT Errors
**Cause**: Working directory doesn't exist
**Solution**: Application now validates directories before spawning processes

### 2. Project Path Resolution
**Issue**: Projects with hyphens in directory names (e.g., `vu-one-web`)
**Solution**: Enhanced path resolution tries multiple interpretations

### 3. Mobile UI Issues
**Issue**: Modal positioning on mobile devices
**Solution**: Uses centered modals instead of bottom sheets

### 4. Project Creation Path
**Issue**: Projects created in wrong directory
**Solution**: Relative paths now created in `/config/workspace/`

### 5. Rename Bug
**Issue**: Projects disappearing after rename
**Solution**: Now preserves all project properties during rename

## Development Tips

### Running with Logs
```bash
npm run server > server.log 2>&1 &
tail -f server.log
```

### Testing Microphone
1. Ensure WhisperLive is configured in `.env`
2. Click microphone button in chat interface
3. Allow browser microphone permissions
4. Speak and click stop
5. Check server logs for transcription activity

### Debugging WebSocket Connections
- Check `/api/config` endpoint for WebSocket URL
- Monitor browser console for connection status
- Server logs show all WebSocket events

### File Watching
The server uses chokidar to watch the Claude projects folder:
- Ignores common build directories
- Debounced updates (300ms)
- Notifies all connected clients of changes

## Security Considerations

1. **Path Validation**: All file operations validate absolute paths
2. **Backup Creation**: Files are backed up before editing
3. **Permission Checks**: Graceful handling of permission errors
4. **No Secrets in Code**: API keys only in environment variables

## Mobile PWA Support
- Installable as Progressive Web App
- Responsive design with safe area handling
- Touch-optimized interface
- Service worker for offline capability

## Production Deployment

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Set production environment:
   ```bash
   export NODE_ENV=production
   export PUBLIC_URL=https://your-domain.com
   ```

3. Run the server:
   ```bash
   npm run server
   ```

4. Configure reverse proxy (nginx/CloudFlare) to handle WebSocket upgrades

## Future Enhancements
- [ ] Multi-user support with authentication
- [ ] Persistent chat history
- [ ] Code snippet library
- [ ] Custom AI model selection
- [ ] Collaborative editing features

## Contributing
When modifying this codebase:
1. Test both development and production modes
2. Verify Docker path handling works correctly
3. Test on mobile devices for responsive design
4. Update this documentation with significant changes