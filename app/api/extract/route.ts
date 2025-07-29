import { NextRequest, NextResponse } from 'next/server';

interface TwitterVideo {
  url: string;
  bitrate?: number;
  content_type: string;
}

interface VideoVariant {
  url: string;
  type: string;
  quality: string;
  bitrate?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Twitter API credentials
const TWITTER_API_KEY = 'ygkbCuk6kChsEH2vYbF50gXwl';
const TWITTER_API_SECRET = 'AVt4qLVxQaZ86i08GWpljXzK2de5ecpiK77eb4GrEFphYwOmIh';

// Simple in-memory cache to avoid hitting rate limits
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Bearer token cache
let bearerToken: string | null = null;
let tokenExpiry: number = 0;

// Get Bearer Token for Twitter API v2
async function getBearerToken(): Promise<string> {
  // Return cached token if still valid
  if (bearerToken && Date.now() < tokenExpiry) {
    return bearerToken;
  }

  const credentials = Buffer.from(`${TWITTER_API_KEY}:${TWITTER_API_SECRET}`).toString('base64');
  
  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    console.error('Failed to get bearer token:', response.status);
    throw new Error('Failed to authenticate with Twitter API');
  }

  const data = await response.json();
  bearerToken = data.access_token;
  tokenExpiry = Date.now() + (60 * 60 * 1000); // Token valid for 1 hour
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Clean the URL - remove query parameters that might interfere
    const cleanUrl = url.split('?')[0];
    
    // Validate Twitter URL and extract tweet ID
    const twitterRegex = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
    const match = cleanUrl.match(twitterRegex);
    
    if (!match) {
      return NextResponse.json({ error: 'Invalid Twitter URL' }, { status: 400 });
    }

    const tweetId = match[3];
    console.log('Extracting video from tweet ID:', tweetId);

    // Check cache first
    const cachedEntry = cache.get(tweetId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
      console.log('Returning cached result for tweet:', tweetId);
      return NextResponse.json(cachedEntry.data);
    }

    // Try multiple methods to get the video
    let videoData: VideoVariant[] = [];
    let tweetText = '';
    let previewImage = '';
    let rateLimited = false;

    // Method 1: Use Twitter API v2 with authentication
    try {
      console.log('Getting bearer token...');
      const token = await getBearerToken();
      console.log('Got bearer token');

      // Get tweet details using v2 API
      const tweetUrl = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys,author_id&media.fields=duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,variants,alt_text&tweet.fields=created_at,text,public_metrics`;
      
      const tweetResponse = await fetch(tweetUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'v2TweetLookupJS',
        }
      });

      if (tweetResponse.status === 429) {
        console.log('Rate limited by Twitter API v2');
        rateLimited = true;
        const retryAfter = tweetResponse.headers.get('x-rate-limit-reset');
        if (retryAfter) {
          const resetTime = new Date(parseInt(retryAfter) * 1000);
          console.log('Rate limit resets at:', resetTime);
        }
      } else if (tweetResponse.ok) {
        const tweetData = await tweetResponse.json();
        console.log('Got tweet data from v2 API');

        // Extract tweet text
        if (tweetData.data?.text) {
          tweetText = tweetData.data.text;
        }

        // Process media
        if (tweetData.includes?.media) {
          tweetData.includes.media.forEach((media: any) => {
            console.log('Processing media:', media.type);
            
            if (media.type === 'video' || media.type === 'animated_gif') {
              // Get preview image
              if (media.preview_image_url && !previewImage) {
                previewImage = media.preview_image_url;
              }

              // Process video variants
              if (media.variants) {
                console.log(`Found ${media.variants.length} video variants`);
                media.variants.forEach((variant: any) => {
                  if (variant.content_type === 'video/mp4' && variant.url) {
                    const bitrate = parseInt(variant.bit_rate) || 0;
                    let quality = 'SD';
                    
                    // Determine quality based on bitrate
                    if (bitrate >= 2176000) quality = '1080p';
                    else if (bitrate >= 832000) quality = '720p';
                    else if (bitrate >= 256000) quality = '480p';
                    else quality = '360p';

                    videoData.push({
                      url: variant.url,
                      type: 'video/mp4',
                      quality: quality,
                      bitrate: bitrate
                    });
                  }
                });
              }
            }
          });
        }

        // Sort by bitrate (highest quality first)
        videoData.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        console.log('Total videos found from Twitter API v2:', videoData.length);
      } else {
        console.error('Twitter API v2 failed with status:', tweetResponse.status);
        const errorData = await tweetResponse.json();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Twitter API v2 error:', error);
    }

    // Method 2: If v2 API fails or is rate limited, try v1.1 API
    if (videoData.length === 0 && !rateLimited) {
      try {
        console.log('Trying Twitter API v1.1...');
        const token = await getBearerToken();
        
        const v1Url = `https://api.twitter.com/1.1/statuses/show.json?id=${tweetId}&tweet_mode=extended&include_entities=true`;
        
        const v1Response = await fetch(v1Url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });

        if (v1Response.status === 429) {
          console.log('Rate limited by Twitter API v1.1');
          rateLimited = true;
        } else if (v1Response.ok) {
          const v1Data = await v1Response.json();
          console.log('Got data from v1.1 API');
          
          // Extract tweet text
          tweetText = v1Data.full_text || v1Data.text || '';
          
          // Check extended entities for media
          if (v1Data.extended_entities?.media) {
            v1Data.extended_entities.media.forEach((media: any) => {
              if (media.type === 'video' || media.type === 'animated_gif') {
                console.log('Found video in extended entities');
                
                // Get preview image
                if (media.media_url_https && !previewImage) {
                  previewImage = media.media_url_https;
                }
                
                // Process video info
                if (media.video_info?.variants) {
                  media.video_info.variants.forEach((variant: any) => {
                    if (variant.content_type === 'video/mp4' && variant.url) {
                      const bitrate = parseInt(variant.bitrate) || 0;
                      let quality = 'SD';
                      
                      if (bitrate >= 2176000) quality = '1080p';
                      else if (bitrate >= 832000) quality = '720p';
                      else if (bitrate >= 256000) quality = '480p';
                      else quality = '360p';
                      
                      if (!videoData.some(v => v.url === variant.url)) {
                        videoData.push({
                          url: variant.url,
                          type: 'video/mp4',
                          quality: quality,
                          bitrate: bitrate
                        });
                      }
                    }
                  });
                }
              }
            });
          }
          
          // Sort by bitrate
          videoData.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          console.log('Total videos found from v1.1 API:', videoData.length);
        } else {
          console.error('Twitter API v1.1 failed with status:', v1Response.status);
        }
      } catch (error) {
        console.error('Twitter API v1.1 error:', error);
      }
    }

    // Method 3: Try FxTwitter/FixupX API as fallback (doesn't require auth)
    if (videoData.length === 0) {
      try {
        console.log('Trying FxTwitter API as fallback...');
        
        // FxTwitter provides better embedding and might have video data
        const fxUrl = cleanUrl.replace('twitter.com', 'fxtwitter.com').replace('x.com', 'fixupx.com');
        const fxResponse = await fetch(fxUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
          },
          redirect: 'follow'
        });
        
        if (fxResponse.ok) {
          const html = await fxResponse.text();
          console.log('Got FxTwitter response');
          
          // Look for Open Graph video meta tags
          const videoMetaRegex = /<meta[^>]*property="og:video"[^>]*content="([^"]+)"/g;
          const videoMatches = Array.from(html.matchAll(videoMetaRegex));
          
          videoMatches.forEach(match => {
            const videoUrl = match[1];
            if (videoUrl && videoUrl.includes('.mp4') && !videoData.some(v => v.url === videoUrl)) {
              videoData.push({
                url: videoUrl,
                type: 'video/mp4',
                quality: 'SD',
                bitrate: 0
              });
            }
          });
          
          // Also look for twitter:player:stream
          const streamRegex = /<meta[^>]*property="twitter:player:stream"[^>]*content="([^"]+)"/;
          const streamMatch = html.match(streamRegex);
          if (streamMatch && !videoData.some(v => v.url === streamMatch[1])) {
            videoData.push({
              url: streamMatch[1],
              type: 'video/mp4',
              quality: 'SD',
              bitrate: 0
            });
          }
          
          // Get description
          const descRegex = /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/;
          const descMatch = html.match(descRegex);
          if (descMatch && !tweetText) {
            tweetText = descMatch[1];
          }
          
          // Get image
          const imageRegex = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/;
          const imageMatch = html.match(imageRegex);
          if (imageMatch && !previewImage) {
            previewImage = imageMatch[1];
          }
        }
      } catch (error) {
        console.error('FxTwitter error:', error);
      }
    }

    // Remove duplicates based on URL
    const uniqueVideos = videoData.filter((video, index, self) => 
      index === self.findIndex(v => v.url === video.url)
    );

    // If we have videos but no quality information, try to deduce it
    if (uniqueVideos.length > 0 && uniqueVideos.every(v => v.quality === 'SD' || !v.bitrate)) {
      // Sort by URL patterns that might indicate quality
      uniqueVideos.forEach(video => {
        if (video.url.includes('1280x720') || video.url.includes('/720/')) video.quality = '720p';
        else if (video.url.includes('1920x1080') || video.url.includes('/1080/')) video.quality = '1080p';
        else if (video.url.includes('640x360') || video.url.includes('/360/')) video.quality = '360p';
        else if (video.url.includes('854x480') || video.url.includes('/480/')) video.quality = '480p';
      });
    }

    console.log(`Final result: ${uniqueVideos.length} unique videos found`);

    if (uniqueVideos.length === 0) {
      // Provide helpful error message
      let errorMessage = 'No video found in this tweet.';
      
      if (rateLimited) {
        errorMessage = 'Twitter API rate limit reached. The free tier allows 300 requests per 15 minutes.\n\nPlease try again in a few minutes, or try these alternatives:\n\n1) Use a different Twitter video downloader service\n2) Try using the tweet URL with "fxtwitter.com" or "fixupx.com" instead of "x.com"\n3) Wait 15 minutes for the rate limit to reset';
      } else {
        errorMessage = 'No video found in this tweet. This could be because:\n\n1) The tweet doesn\'t contain a video\n2) The video is from a private account\n3) The tweet has been deleted\n4) The account is suspended\n\nPlease try:\n- Checking if the tweet actually contains a video\n- Using a different tweet with a video\n- Making sure the account is public';
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        rateLimited: rateLimited
      }, { status: 404 });
    }

    // Prepare successful response
    const responseData = {
      success: true,
      title: tweetText || 'Twitter Video',
      previewImage: previewImage,
      videos: uniqueVideos,
      tweetId: tweetId
    };

    // Cache the successful response
    cache.set(tweetId, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error extracting video:', error);
    return NextResponse.json({ 
      error: 'Failed to extract video. Please try again later.' 
    }, { status: 500 });
  }
} 