# BABE Fight - Azure Deployment Guide

## 🚀 Azure Web App Deployment (Linux + VS Code)

This application is configured to run on **Azure App Service on Linux** with both frontend and backend in one service.

---

## 📋 Prerequisites

1. **Azure Account** with active subscription
2. **VS Code** with Azure App Service extension installed
3. **Node.js 20 LTS** installed locally

### Install VS Code Extension:
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search and install: **Azure App Service**
4. Sign in to Azure account

---

## 🚀 Deploy Using VS Code (Easiest Method)

### Step 1: Create Web App from VS Code

1. Click **Azure icon** in VS Code sidebar
2. Under **App Service**, click **+** (Create New Web App)
3. Enter app name: `babe-fight` (must be globally unique)
4. Select **Node 20 LTS** as runtime
5. Select **Linux** as OS
6. Choose pricing tier: **B1 Basic** (minimum for WebSockets)
7. Wait for creation to complete

### Step 2: Build Frontend

```bash
cd /Users/smithm/GitHub/BABE_Fight
npm run build
```

### Step 3: Deploy

1. **Right-click** on the project root folder in VS Code
2. Select **Deploy to Web App...**
3. Choose the web app you just created
4. Confirm deployment
5. Wait for deployment to complete (2-3 minutes)

### Step 4: Configure App Settings

1. In VS Code Azure panel, expand your web app
2. Right-click **Application Settings** → **Add New Setting**
3. Add these settings one by one:
   ```
   PORT = 8080
   NODE_ENV = production
   ```

4. **Enable WebSockets**:
   - Right-click your web app → **Open in Portal**
   - Go to **Configuration** → **General settings**
   - Set **Web sockets** = **On**
   - Click **Save**

### Step 5: Restart & Test

1. In VS Code, right-click your web app → **Restart**
2. Access your app: `https://babe-fight.azurewebsites.net`
3. Test health: `https://babe-fight.azurewebsites.net/health`

---

## 🔧 Alternative: Azure Portal Deployment

### Option A: Using Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Web App**:
   - **Name**: `babe-fight` (or your preferred name)
   - **Runtime**: Node 20 LTS
   - **Operating System**: Linux
   - **Region**: Choose closest to users
   - **Pricing**: B1 Basic or higher (for WebSockets support)

### Deploy via VS Code:
- Right-click project → **Deploy to Web App**
- Select your web app

---

## 🛠 Required Configuration

---

## 🛠 Required Configuration

### Application Settings (Required):

```
PORT = 8080
NODE_ENV = production
```

### General Settings (Critical):

1. **Web sockets** = **On** ✅
2. **Startup Command**: Leave empty (uses package.json start script)
3. **Always On**: Recommended for production

---

## 📤 VS Code Deployment Tips

### First Deployment:
- VS Code automatically runs `npm install` and `npm run build`
- Deployment takes 2-3 minutes

### Subsequent Deployments:
- Just right-click → Deploy
- Much faster (30-60 seconds)

### View Logs in VS Code:
1. Right-click your web app
2. Select **Start Streaming Logs**
3. Watch real-time deployment and runtime logs

---

## ✅ Verify Deployment

1. **Check Health Endpoint:**
   ```
   https://babe-fight.azurewebsites.net/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Access Application:**
   ```
   https://babe-fight.azurewebsites.net
   ```

3. **Monitor Logs:**
   ```bash
   az webapp log tail --name babe-fight --resource-group babe-fight-rg
   ```

---

## 📊 Important Notes

### Database
- SQLite database file is stored in `/home/data/babe-fight.db`
- Azure Web App's file system is persistent in `/home` directory
- Database will persist across restarts

### WebSockets
- Ensure WebSockets are **enabled** in Azure configuration
- Required for real-time score updates and player sync

### Performance
- **B1 Basic** tier minimum (supports WebSockets)
- **S1 Standard** recommended for production (auto-scaling support)

### CORS
- Currently set to `*` (allow all origins)
- For production, update in backend code to restrict to your domain

---

## 🐛 Troubleshooting

### Application won't start:

**In VS Code:**
1. Right-click web app → **Start Streaming Logs**
2. Look for errors in the log stream

**In Azure Portal:**
1. Go to **Monitoring** → **Log stream**
2. Or **Diagnose and solve problems**

### Common Issues:

**"Application Error":**
- Check if WebSockets are enabled
- Verify PORT=8080 is set in Application Settings
- Check logs for Node.js errors

**Build fails during deployment:**
- Ensure `frontend/dist` is created during build
- Check that all dependencies are in package.json
- Try building locally first: `npm run build`

**WebSocket connection fails:**
- Verify WebSockets = **On** in General Settings
- Check browser console for errors
- Ensure using HTTPS (not HTTP)

### Quick Fixes:

```bash
# Rebuild and redeploy
npm run build
# Then right-click → Deploy in VS Code

# View live logs
# Right-click web app → Start Streaming Logs
```

---

## 🔄 Update/Redeploy

To deploy updates:

1. Make your code changes
2. Test locally with `./run-local.sh`
3. Build: `npm run build`
4. Right-click project → **Deploy to Web App**
5. Confirm when prompted

That's it! No git commands needed with VS Code deployment.

---

## 💰 Cost Estimation

- **B1 Basic**: ~$13/month (1 core, 1.75GB RAM)
- **S1 Standard**: ~$70/month (auto-scaling, custom domains)

[Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

---

## 🔐 Security Recommendations

1. **Environment Variables**: Set via Azure Portal, not in code
2. **HTTPS**: Enabled by default on `.azurewebsites.net`
3. **Custom Domain**: Configure SSL certificate for production
4. **CORS**: Restrict origins in production environment

---

## 📚 Additional Resources

- [Azure Web Apps Documentation](https://docs.microsoft.com/azure/app-service/)
- [Node.js on Azure](https://docs.microsoft.com/azure/app-service/quickstart-nodejs)
- [WebSocket Support](https://docs.microsoft.com/azure/app-service/web-sites-configure)

---

## 🆘 Support

For issues, check:
1. Azure Portal logs
2. Application Insights (if configured)
3. GitHub Issues: https://github.com/SmithMMTK/BABE_Fight/issues
