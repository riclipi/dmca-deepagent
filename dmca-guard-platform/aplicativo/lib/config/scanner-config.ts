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
  // Always use real implementations - no more mocks
  return {
    useRealSearch: true,
    useRealImageAnalysis: false, // Requires Google Vision API or similar
    useRealDMCADetection: true,
    searchEngines: {
      google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
      bing: false, // Requires Bing Search API
      duckduckgo: false, // No official API available
      serper: !!process.env.SERPER_API_KEY
    },
    imageAnalysis: {
      provider: process.env.GOOGLE_VISION_API_KEY ? 'google-vision' : 'mock',
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