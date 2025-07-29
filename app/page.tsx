'use client';

import { useState } from 'react';

interface VideoData {
  url: string;
  type: string;
  quality: string;
  bitrate?: number;
}

interface ApiResponse {
  success: boolean;
  title: string;
  previewImage?: string;
  videos: VideoData[];
  error?: string;
  tweetId?: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoData, setVideoData] = useState<ApiResponse | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a Twitter URL');
      return;
    }

    setLoading(true);
    setError('');
    setVideoData(null);
    setSelectedVideo('');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract video');
      }

      setVideoData(data);
      // Select the highest quality video by default
      if (data.videos && data.videos.length > 0) {
        setSelectedVideo(data.videos[0].url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (videoUrl: string, quality: string) => {
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `twitter-video-${quality}-${videoData?.tweetId || 'video'}.mp4`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Some browsers need the element to be in the DOM
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: open in new tab
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const copyToClipboard = (videoUrl: string) => {
    navigator.clipboard.writeText(videoUrl).then(() => {
      // You could add a toast notification here
      alert('Video URL copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">TweetDown</h1>
        <p className="subtitle">Download videos from Twitter/X tweets in multiple resolutions</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="url" className="input-label">
              Twitter/X Tweet URL
            </label>
            <input
              type="url"
              id="url"
              className="input-field"
              placeholder="https://x.com/username/status/123456789"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <p className="input-hint">
              Paste a Twitter or X.com link that contains a video
            </p>
          </div>

          <button 
            type="submit" 
            className="button" 
            disabled={loading}
          >
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                Extracting video...
              </div>
            ) : (
              'Extract Video'
            )}
          </button>
        </form>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {videoData && videoData.success && (
          <div className="result-container">
            <div className="video-info">
              <h2 className="result-title">Video Extracted Successfully!</h2>
              
              <div className="tweet-text">
                {videoData.title}
              </div>

              {/* Video Preview */}
              {selectedVideo && (
                <div className="video-preview">
                  <video 
                    controls 
                    className="video-player"
                    poster={videoData.previewImage}
                    key={selectedVideo}
                  >
                    <source src={selectedVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Resolution Options */}
              <div className="resolution-section">
                <h3 className="section-title">Available Resolutions:</h3>
                <div className="resolution-grid">
                  {videoData.videos.map((video, index) => (
                    <div key={index} className="resolution-item">
                      <button
                        className={`resolution-button ${selectedVideo === video.url ? 'active' : ''}`}
                        onClick={() => setSelectedVideo(video.url)}
                      >
                        {video.quality}
                        {video.bitrate && (
                          <span className="bitrate">
                            {Math.round(video.bitrate / 1000)}kbps
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Options */}
              <div className="download-section">
                <h3 className="section-title">Download Options:</h3>
                <div className="download-grid">
                  {videoData.videos.map((video, index) => (
                    <div key={index} className="download-item">
                      <button
                        className="download-button"
                        onClick={() => handleDownload(video.url, video.quality)}
                      >
                        <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download {video.quality}
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(video.url)}
                        title="Copy video URL"
                      >
                        <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="instructions">
                <p><strong>Note:</strong> If the download doesn't start automatically, right-click on the video player above and select "Save video as..."</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>TweetDown - Download Twitter/X videos easily</p>
        <p className="disclaimer">
          This tool is for personal use only. Please respect copyright and content creators' rights.
        </p>
      </footer>
    </div>
  );
} 