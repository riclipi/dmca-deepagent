
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
  searchTerms: z.array(z.string()),
  scanFrequency: z.number().min(1).max(168) // 1 hora a 1 semana
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
