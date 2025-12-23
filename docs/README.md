# BABE Fight Documentation

This folder contains all documentation for the BABE Fight golf game application.

## Architecture & Deployment

- **[AZURE_ARCHITECTURE.md](AZURE_ARCHITECTURE.md)** - Comprehensive guide to Azure Container Apps architecture, deployment, and operations
- **[CONTAINER_APPS_DEPLOY.md](CONTAINER_APPS_DEPLOY.md)** - Step-by-step deployment instructions for Azure Container Apps

## Project Management

- **[backlogs.md](backlogs.md)** - Feature backlog and future improvements
- **[commit_log.md](commit_log.md)** - Development history and change log

## Setup Instructions

The **[setup/Instructions/](setup/Instructions/)** folder contains detailed implementation guides:

- **00_Initial_fix.md** - Initial bug fixes and corrections
- **00_InitialApplicationFrame.md** - Application framework setup
- **01_CourseInformation.md** - Golf course data structure and implementation
- **02_HandicapStroke_Allocation_Algorithm.md** - Handicap calculation logic

## Quick Links

### For Development
- See [../README.md](../README.md) for project overview
- Run locally: `npm run dev` (from backend/ and frontend/)
- Local development script: `../scripts/run-local.sh`

### For Deployment
- Deploy to Azure: `../scripts/deploy-container-apps.sh`
- Update deployed app: `../scripts/update-app.sh`
- Architecture overview: [AZURE_ARCHITECTURE.md](AZURE_ARCHITECTURE.md)

### For Scripts
- All deployment and utility scripts are in [../scripts/](../scripts/)
