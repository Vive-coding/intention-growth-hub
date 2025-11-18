# LangSmith Production Setup Guide

## Overview

LangSmith provides tracing and monitoring for LangChain agents in production. This guide covers setting up LangSmith integration for the GoodHabit app.

## Prerequisites

1. LangSmith account at https://smith.langchain.com
2. Production environment with environment variable support (Railway, Vercel, Render, etc.)

## Setup Steps

### Step 1: Get LangSmith API Key

1. Go to https://smith.langchain.com
2. Sign in or create an account
3. Navigate to Settings → API Keys
4. Create a new API key or copy an existing one
5. Save the key securely (you won't be able to see it again)

### Step 2: Configure Environment Variables

Add these environment variables to your production environment:

#### Required Variables

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<your_api_key_here>
```

#### Optional (Recommended) Variables

```bash
LANGCHAIN_PROJECT=intention-growth-hub-production
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

### Step 3: Platform-Specific Setup

#### Railway

1. Open your Railway project dashboard
2. Click on the Variables tab
3. Add each environment variable:
   - `LANGCHAIN_TRACING_V2` = `true`
   - `LANGCHAIN_API_KEY` = `<your_api_key>`
   - `LANGCHAIN_PROJECT` = `intention-growth-hub-production`
4. Redeploy the service (happens automatically after adding variables)

#### Vercel

1. Open your Vercel project dashboard
2. Go to Settings → Environment Variables
3. Add each variable for the **Production** environment
4. Redeploy your app

#### Render

1. Open your Render service dashboard
2. Go to the Environment tab
3. Add each key-value pair
4. Save changes and redeploy

#### Docker/Other

Add to your `.env` file or environment configuration, then restart the service.

### Step 4: Verify Setup

After deployment, verify the integration:

1. **Check Server Logs**: Look for LangSmith initialization messages (no errors about missing API keys)

2. **Make a Test Request**: Send a message in the chat and wait for a response

3. **View Traces**: Go to https://smith.langchain.com → Projects → `intention-growth-hub-production`

4. **Confirm Traces Appear**: You should see traces within a few minutes of the request

## What Gets Traced

With LangSmith enabled, you'll see:

- **User Messages**: Complete conversation history
- **Agent Responses**: Full text responses from the coach
- **Tool Calls**: Every tool invocation (create_goal_with_habits, log_habit_completion, etc.)
- **LLM Prompts**: The exact prompts sent to the model
- **Metadata**: userId, threadId, agentMode, timestamps

## Troubleshooting

### No Traces Appearing

**Check**: Is `LANGCHAIN_TRACING_V2` set to `true` (not `"true"` with quotes)?

**Solution**: Set the variable without quotes: `LANGCHAIN_TRACING_V2=true`

### "API Key Invalid" Error

**Check**: Verify the API key is correct and has no extra spaces

**Solution**: Copy the key again from LangSmith and ensure no whitespace before/after

### Traces Going to Wrong Project

**Check**: Verify `LANGCHAIN_PROJECT` is set

**Solution**: Set `LANGCHAIN_PROJECT=intention-growth-hub-production` explicitly

### Still Not Working

**Check Server Logs**: Look for LangSmith-related errors during initialization

**Common Issues**:
- API key not set or incorrect
- Network connectivity issues
- Rate limiting (check LangSmith dashboard)

## Testing Locally (Optional)

To test LangSmith integration before deploying to production:

1. Add to your local `.env` file:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<your_key>
LANGCHAIN_PROJECT=intention-growth-hub-dev
```

2. Start the development server:

```bash
npm run dev
```

3. Make a test chat request

4. Check https://smith.langchain.com → Projects → `intention-growth-hub-dev`

## Using Traces for Debugging

### View a Trace

1. Go to LangSmith dashboard
2. Select your project
3. Click on any trace to see:
   - Complete conversation flow
   - Tool calls with inputs/outputs
   - LLM prompts and responses
   - Execution time for each step
   - Any errors or warnings

### Filter Traces

- By user ID
- By time range
- By status (success/error)
- By specific tools used

### Share Traces

Click "Share" on any trace to generate a public URL for debugging with team members.

## Best Practices

1. **Use Separate Projects**: Keep dev and production traces separate with different `LANGCHAIN_PROJECT` values

2. **Monitor Regularly**: Check traces weekly to identify:
   - Common failure patterns
   - Slow tool calls
   - Unexpected agent behavior

3. **Set Up Alerts**: Configure LangSmith alerts for:
   - High error rates
   - Slow responses (>10s)
   - Specific tool failures

4. **Retention Policy**: LangSmith keeps traces for 14 days by default (configurable in paid plans)

## Cost Considerations

- LangSmith has a free tier with limited traces
- Production usage may require a paid plan
- Check pricing at https://www.langchain.com/pricing

## Security Notes

- Never commit API keys to git
- Rotate keys periodically (every 90 days recommended)
- Use separate keys for dev/staging/production
- Monitor unauthorized trace access in LangSmith dashboard

## Support

For issues with LangSmith itself:
- Documentation: https://docs.smith.langchain.com
- Discord: https://discord.gg/langchain
- GitHub: https://github.com/langchain-ai/langsmith-sdk

