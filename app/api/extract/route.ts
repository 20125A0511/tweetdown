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

// Enhanced cache with longer duration and better persistence
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes (increased from 30 minutes)

// Rate limit tracking
const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 50; // More conservative limit

// Bearer token cache
let bearerToken: string | null = null;
let tokenExpiry: number = 0;

// Check rate limits
function checkRateLimit(tweetId: string): boolean {
  const now = Date.now();
  const tracker = rateLimitTracker.get(tweetId);
  
  if (!tracker || now > tracker.resetTime) {
    // Reset or initialize tracker
    rateLimitTracker.set(tweetId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (tracker.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  tracker.count++;
  return true;
}

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

    // Check cache first (before any API calls)
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

    // Method 1: Try FxTwitter/FixupX API FIRST (doesn't require auth and has no rate limits)
    try {
      console.log('Trying FxTwitter API first (no rate limits)...');
      
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
            // Try to determine quality from URL
            let quality = 'SD';
            if (videoUrl.includes('1280x720') || videoUrl.includes('/720/')) quality = '720p';
            else if (videoUrl.includes('1920x1080') || videoUrl.includes('/1080/')) quality = '1080p';
            else if (videoUrl.includes('640x360') || videoUrl.includes('/360/')) quality = '360p';
            else if (videoUrl.includes('854x480') || videoUrl.includes('/480/')) quality = '480p';
            
            videoData.push({
              url: videoUrl,
              type: 'video/mp4',
              quality: quality,
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
        if (descMatch) {
          tweetText = descMatch[1];
        }
        
        // Get image
        const imageRegex = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/;
        const imageMatch = html.match(imageRegex);
        if (imageMatch) {
          previewImage = imageMatch[1];
        }
        
        console.log(`Found ${videoData.length} videos from FxTwitter`);
      }
    } catch (error) {
      console.error('FxTwitter error:', error);
    }

    // Method 2: Try alternative video extraction API (no auth required)
    if (videoData.length === 0) {
      try {
        console.log('Trying alternative extraction method...');
        
        // Try using a tweet syndication endpoint that doesn't require auth
        const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=`;
        
        const syndicationResponse = await fetch(syndicationUrl);
        
        if (syndicationResponse.ok) {
          const syndicationData = await syndicationResponse.json();
          console.log('Got syndication data');
          
          // Extract tweet text
          if (syndicationData.text) {
            tweetText = syndicationData.text;
          }
          
          // Look for video in entities
          if (syndicationData.video) {
            const videoInfo = syndicationData.video;
            if (videoInfo.variants) {
              videoInfo.variants.forEach((variant: any) => {
                if (variant.type === 'video/mp4' && variant.src) {
                  const bitrate = parseInt(variant.bitrate) || 0;
                  let quality = 'SD';
                  
                  if (bitrate >= 2176000) quality = '1080p';
                  else if (bitrate >= 832000) quality = '720p';
                  else if (bitrate >= 256000) quality = '480p';
                  else quality = '360p';
                  
                  if (!videoData.some(v => v.url === variant.src)) {
                    videoData.push({
                      url: variant.src,
                      type: 'video/mp4',
                      quality: quality,
                      bitrate: bitrate
                    });
                  }
                }
              });
            }
            
            // Get preview image
            if (videoInfo.poster && !previewImage) {
              previewImage = videoInfo.poster;
            }
          }
          
          // Sort by bitrate
          videoData.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          console.log(`Found ${videoData.length} videos from syndication`);
        }
      } catch (error) {
        console.error('Syndication API error:', error);
      }
    }

    // Method 3: Only use Twitter API if we still have no videos (to minimize rate limit issues)
    if (videoData.length === 0) {
      // Check our internal rate limits first
      if (!checkRateLimit(tweetId)) {
        console.log('Internal rate limit exceeded for tweet:', tweetId);
        return NextResponse.json({ 
          error: 'Too many requests. Please try again in a few minutes.',
          rateLimited: true,
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 60000) // minutes
        }, { status: 429 });
      }

      // Try Twitter API v2 with authentication
      try {
        console.log('No videos found yet, trying Twitter API v2...');
        const token = await getBearerToken();
        
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
          if (tweetData.data?.text && !tweetText) {
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
        }
      } catch (error) {
        console.error('Twitter API v2 error:', error);
      }
    }

    // Remove duplicates based on URL
    const uniqueVideos = videoData.filter((video, index, self) => 
      index === self.findIndex(v => v.url === video.url)
    );

    console.log(`Final result: ${uniqueVideos.length} unique videos found`);

    if (uniqueVideos.length === 0) {
      // Provide helpful error message
      let errorMessage = 'No video found in this tweet.';
      
      if (rateLimited) {
        errorMessage = 'Twitter API rate limit reached. Please try again in 15 minutes.\n\nAlternative: Replace "x.com" with "fxtwitter.com" in your URL and try again.';
      } else {
        errorMessage = 'No video found in this tweet. This could be because:\n\n1) The tweet doesn\'t contain a video\n2) The video is from a private account\n3) The tweet has been deleted\n4) The account is suspended\n\nPlease check if the tweet actually contains a video.';
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