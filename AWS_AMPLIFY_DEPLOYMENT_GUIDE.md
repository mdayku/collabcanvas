# 🚀 AWS Amplify Deployment Guide for CollabCanvas

## Prerequisites
1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js** and **npm** installed
4. **Git repository** (already have: https://github.com/mdayku/collabcanvas.git)

## Step-by-Step Deployment

### 1. 📦 Install AWS Amplify CLI
```bash
npm install -g @aws-amplify/cli
amplify configure
```

### 2. 🏗️ Initialize Amplify in Project
```bash
# In your project directory
amplify init

# Recommended settings:
# Project name: collabcanvas
# Environment: prod
# Default editor: Visual Studio Code
# Type of app: javascript
# Framework: react
# Source Directory Path: src
# Distribution Directory Path: dist
# Build Command: npm run build
# Start Command: npm run dev
```

### 3. ☁️ Deploy via Amplify Console (Recommended)

#### Option A: GitHub Integration (Easiest)
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Select "GitHub" and authorize
4. Choose `mdayku/collabcanvas` repository
5. Select `main` branch
6. Configure build settings (use the `amplify.yml` file)
7. Add environment variables (see template below)
8. Deploy!

#### Option B: Manual Deploy
```bash
# Add hosting
amplify add hosting
# Choose "Amazon CloudFront and S3"

# Deploy
amplify push
amplify publish
```

### 4. 🔧 Environment Variables Setup

**In Amplify Console → App Settings → Environment Variables:**

```
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 5. 🔄 AI Function Migration Options

#### Option A: AWS Lambda Function
1. Create new Lambda function in AWS Console
2. Copy code from `amplify-lambda-ai.js`
3. Create API Gateway endpoint
4. Update frontend to use new endpoint

#### Option B: Amplify Functions (Simpler)
```bash
amplify add function
# Name: aiHandler
# Template: Hello World
# Advanced settings: No

# Replace generated function with our AI code
# Deploy: amplify push
```

### 6. 🌐 Custom Domain Setup (Optional)
```bash
amplify add hosting
# Choose "Amazon CloudFront and S3"
# Configure custom domain in Amplify Console
```

### 7. 📊 Build Configuration

The `amplify.yml` file is already configured with:
- Node.js build process
- Vite production build
- Asset optimization
- Cache settings

### 8. 🔍 Post-Deployment Checklist

- [ ] Website loads correctly
- [ ] Supabase connection working
- [ ] AI agent functionality working  
- [ ] Canvas saves and loads properly
- [ ] Real-time collaboration working
- [ ] All environment variables configured
- [ ] SSL certificate active
- [ ] Custom domain (if configured)

## Migration Benefits

### 🎯 Why AWS Amplify?
- **Better Performance**: Global CDN with edge locations
- **Cost Optimization**: Pay only for what you use
- **Scalability**: Auto-scaling for traffic spikes
- **Integration**: Easy AWS service integration
- **Monitoring**: Built-in analytics and logging
- **Security**: AWS security best practices

### 📊 Cost Comparison
- **Vercel**: $20/month for Pro plan
- **Amplify**: ~$1-15/month depending on usage
- **Savings**: 50-95% cost reduction for most apps

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check Node.js version compatibility
2. **Environment Variables**: Ensure all vars are set in Amplify Console
3. **CORS Issues**: Add proper headers to Lambda function
4. **Supabase Connection**: Verify URLs and keys

### Support Resources:
- [AWS Amplify Documentation](https://docs.amplify.aws)
- [Amplify Discord](https://discord.gg/amplify)
- [AWS Support](https://console.aws.amazon.com/support/)

## Next Steps After Migration

1. **Custom Domain**: Set up your domain
2. **Monitoring**: Configure CloudWatch alerts
3. **Backup**: Set up automated backups
4. **CDN Optimization**: Fine-tune caching rules
5. **Security**: Review IAM permissions
