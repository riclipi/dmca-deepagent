/**
 * Scanner Configuration
 * Controls whether to use real or mock implementations
 */

export interface ScannerConfig {
  useRealSearch: boolean;
  useRealImageAnalysis: boolean;
  useRealDMCADetection: boolean;
  searchEngines: {
    google: boolean;
    bing: boolean;
    duckduckgo: boolean;
    serper: boolean;
  };
  imageAnalysis: {
    provider: 'google-vision' | 'aws-rekognition' | 'mock';
    apiKey?: string;
  };
}

export function getScannerConfig(): ScannerConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, force real implementations
  if (isProduction) {
    return {
      useRealSearch: true,
      useRealImageAnalysis: false, // Set to true when image analysis API is configured
      useRealDMCADetection: true,
      searchEngines: {
        google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
        bing: false, // Add Bing API when available
        duckduckgo: false, // DuckDuckGo doesn't have official API
        serper: !!process.env.SERPER_API_KEY
      },
      imageAnalysis: {
        provider: 'mock', // Change to real provider when configured
        apiKey: process.env.GOOGLE_VISION_API_KEY
      }
    };
  }
  
  // In development, allow mocks unless explicitly disabled
  return {
    useRealSearch: process.env.USE_REAL_SEARCH === 'true',
    useRealImageAnalysis: process.env.USE_REAL_IMAGE_ANALYSIS === 'true',
    useRealDMCADetection: process.env.USE_REAL_DMCA === 'true',
    searchEngines: {
      google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
      bing: false,
      duckduckgo: false,
      serper: !!process.env.SERPER_API_KEY
    },
    imageAnalysis: {
      provider: 'mock',
      apiKey: process.env.GOOGLE_VISION_API_KEY
    }
  };
}

export function validateScannerConfig(config: ScannerConfig): void {
  if (process.env.NODE_ENV === 'production') {
    if (!config.useRealSearch) {
      throw new Error('Real search must be enabled in production');
    }
    
    const hasActiveSearchEngine = Object.values(config.searchEngines).some(Boolean);
    if (!hasActiveSearchEngine) {
      throw new Error('At least one search engine must be configured in production');
    }
  }
}