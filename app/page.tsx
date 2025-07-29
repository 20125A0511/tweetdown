'use client';

import { useState } from 'react';
import Image from 'next/image';

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
        {/* Header with X Logo */}
        <div className="header">
          <div className="logo-container">
            <Image
              src="/media/logo.svg"
              alt="X Logo"
              width={48}
              height={48}
              className="logo"
            />
          </div>
          <h1 className="title">TweetDown</h1>
          <p className="subtitle">Download videos from X (Twitter) with ease</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <label htmlFor="url" className="input-label">
              X (Twitter) URL
            </label>
            <div className="input-wrapper">
              <input
                type="url"
                id="url"
                className="input-field"
                placeholder="https://x.com/username/status/123456789"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <div className="input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
                </svg>
              </div>
            </div>
            <p className="input-hint">
              Paste any X (Twitter) post URL that contains a video
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
                <span>Extracting...</span>
              </div>
            ) : (
              <>
                <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Extract Video
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="error">
            <svg className="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {videoData && videoData.success && (
          <div className="result-container">
            <div className="video-info">
              <div className="success-header">
                <svg className="success-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h2 className="result-title">Video Extracted Successfully!</h2>
              </div>
              
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
                <h3 className="section-title">
                  <svg className="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Available Qualities
                </h3>
                <div className="resolution-grid">
                  {videoData.videos.map((video, index) => (
                    <div key={index} className="resolution-item">
                      <button
                        className={`resolution-button ${selectedVideo === video.url ? 'active' : ''}`}
                        onClick={() => setSelectedVideo(video.url)}
                      >
                        <span className="quality-label">{video.quality}</span>
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
                <h3 className="section-title">
                  <svg className="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Options
                </h3>
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
                <svg className="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>If download doesn't start automatically, right-click the video player and select "Save video as..."</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <Image
              src="/media/logo-white.png"
              alt="X Logo"
              width={24}
              height={24}
              className="footer-logo-img"
            />
            <span>TweetDown</span>
          </div>
          <p className="disclaimer">
            Download videos from X (Twitter) easily and securely
          </p>
          <p className="copyright">
            For personal use only. Respect content creators' rights.
          </p>
        </div>
      </footer>
    </div>
  );
} 