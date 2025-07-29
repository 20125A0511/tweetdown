# TweetDown 

A modern web application to download videos from Twitter/X tweets with multiple quality options.

## Features ✨

- **Multiple Quality Options**: Download videos in 1080p, 720p, 480p, and 360p
- **Video Preview**: Watch videos before downloading
- **Modern UI**: Beautiful, responsive design with Twitter/X branding
- **Real-time Extraction**: Uses Twitter API v2 for reliable video extraction
- **Smart Caching**: Reduces API calls and improves performance
- **Rate Limit Handling**: Graceful handling of Twitter API rate limits

## Live Demo 🌐

Visit the live application: [TweetDown](https://tweet-down.vercel.app/)



## Tech Stack 🛠️

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: CSS3 with modern gradients and animations
- **API**: Twitter API v2 with OAuth2 authentication
- **Deployment**: Vercel (recommended) or any Node.js hosting

## Getting Started 🚀

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Twitter API credentials (optional for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/20125A0511/tweetdown.git
   cd tweetdown
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)
   Create a `.env.local` file:
   ```env
   TWITTER_API_KEY=your_api_key_here
   TWITTER_API_SECRET=your_api_secret_here
   ```
   
   **Note**: The app works without these credentials using fallback methods (FxTwitter and syndication APIs). Twitter API credentials provide better quality detection but are optional.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage 📖

1. **Paste a Twitter/X URL**: Copy any tweet URL that contains a video
2. **Click "Extract Video"**: The app will analyze the tweet and find available videos
3. **Preview the Video**: Watch the video in the embedded player
4. **Choose Quality**: Select from available resolutions (1080p, 720p, 480p, 360p)
5. **Download**: Click the download button for your preferred quality

## API Endpoints 🔌

### POST `/api/extract`

Extracts video information from a Twitter/X tweet.

**Request Body:**
```json
{
  "url": "https://x.com/username/status/123456789"
}
```

**Response:**
```json
{
  "success": true,
  "title": "Tweet text here",
  "previewImage": "https://pbs.twimg.com/...",
  "videos": [
    {
      "url": "https://video.twimg.com/...",
      "type": "video/mp4",
      "quality": "1080p",
      "bitrate": 2176000
    }
  ],
  "tweetId": "123456789"
}
```

## Deployment 🚀

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Deploy automatically

### Deploy to Other Platforms

The app can be deployed to any Node.js hosting platform:
- Netlify
- Railway
- Heroku
- DigitalOcean App Platform

## Environment Variables 🔧

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TWITTER_API_KEY` | Twitter API Key from developer portal | No | Uses fallback methods |
| `TWITTER_API_SECRET` | Twitter API Secret from developer portal | No | Uses fallback methods |

### Getting Twitter API Credentials

1. **Visit Twitter Developer Portal**: https://developer.twitter.com/en/portal/dashboard
2. **Create a new app** or use an existing one
3. **Get your API Key and Secret** from the app settings
4. **Add them to your environment variables**

### Fallback Methods (No API Keys Required)

The app uses these methods when Twitter API credentials are not provided:
- **FxTwitter API**: Extracts videos from fxtwitter.com/fixupx.com
- **Syndication API**: Uses Twitter's public syndication endpoint
- **Caching**: 60-minute cache to reduce requests

## Rate Limits ⚠️

- **Twitter API Free Tier**: 300 requests per 15 minutes
- **Fallback Methods**: FxTwitter API (no limits)
- **Caching**: 60-minute cache to reduce API calls

## Contributing 🤝

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request



## Disclaimer ⚖️

This tool is for personal use only. Please respect:
- Copyright laws
- Content creators' rights
- Twitter/X Terms of Service
- Rate limits and fair use policies

## Support 💬

If you encounter any issues:
1. Check the [Issues](https://github.com/20125A0511/tweetdown/issues) page
2. Create a new issue with detailed information
3. Include the tweet URL and error message

## Acknowledgments 🙏

- Twitter/X for providing the API
- FxTwitter for fallback video extraction
- Next.js team for the amazing framework
- The open-source community

---
Made this because , too many ads on existing video downloaders :)
