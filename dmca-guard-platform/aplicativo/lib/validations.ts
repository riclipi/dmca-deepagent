
import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  phone: z.string().optional(),
  document: z.string().optional(),
  dateOfBirth: z.string().optional()
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
})

export const brandProfileSchema = z.object({
  brandName: z.string().min(2, 'Nome da marca deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  officialUrls: z.array(z.string().url('URL inválida')),
  socialMedia: z.object({
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    onlyfans: z.string().optional(),
    other: z.string().optional()
  }).optional(),
  keywords: z.array(z.string())
})

export const monitoringSessionSchema = z.object({
  name: z.string().min(2, 'Nome da sessão deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  brandProfileId: z.string(),
  targetPlatforms: z.array(z.string()),
  useProfileKeywords: z.boolean().default(true),
  customKeywords: z.array(z.string()).default([]),
  excludeKeywords: z.array(z.string()).default([]),
  scanFrequency: z.number().min(1).max(168), // 1 hora a 1 semana
  // Backward compatibility
  searchTerms: z.array(z.string()).optional()
})

export const safeKeywordConfigSchema = z.object({
  baseName: z.string().min(2, 'Nome base deve ter pelo menos 2 caracteres'),
  minLength: z.number().min(3).max(10).default(4),
  maxVariations: z.number().min(5).max(100).default(30),
  dangerousPatterns: z.array(z.string()).default([]),
  includeLeetspeakLight: z.boolean().default(true),
  includeSeparators: z.boolean().default(true),
  includeSpacing: z.boolean().default(true)
})

export const keywordReviewSchema = z.object({
  reviewId: z.string(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional()
})

export const bulkKeywordReviewSchema = z.object({
  reviewIds: z.array(z.string()).min(1, 'Pelo menos um review deve ser selecionado'),
  action: z.enum(['approve', 'reject', 'bulk_approve', 'bulk_reject']),
  notes: z.string().optional()
})

export const sessionStatusUpdateSchema = z.object({
  status: z.enum(['IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR']).optional(),
  currentKeyword: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  totalKeywords: z.number().min(0).optional(),
  processedKeywords: z.number().min(0).optional(),
  resultsFound: z.number().min(0).optional()
})

export const sessionActionSchema = z.object({
  action: z.enum(['start', 'pause', 'stop', 'reset'])
})

export const takedownRequestSchema = z.object({
  detectedContentId: z.string(),
  platform: z.string(),
  recipientEmail: z.string().email('Email inválido'),
  customMessage: z.string().optional()
})

export const domainWhitelistSchema = z.object({
  domain: z.string().min(3, 'Domínio deve ter pelo menos 3 caracteres')
    .max(255, 'Domínio muito longo')
    .transform(value => { // Use transform for normalization before refine
      try {
        let normalized = value.toLowerCase().trim();
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
          normalized = 'http://' + normalized;
        }
        return new URL(normalized).hostname;
      } catch (e) {
        return value; // Return original value if URL parsing fails, refine will catch it
      }
    })
    .refine(value => {
      // Basic check for common TLDs (not exhaustive) and general domain structure
      // This regex is a common one for basic domain validation.
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/;
      return domainRegex.test(value);
    }, 'Formato de domínio inválido. Use example.com'),
});

export const updateTakedownRequestSchema = z.object({
  subject: z.string().min(5, 'Assunto deve ter pelo menos 5 caracteres').max(255, 'Assunto muito longo'),
  message: z.string().min(20, 'Mensagem deve ter pelo menos 20 caracteres').max(10000, 'Mensagem muito longa')
});
