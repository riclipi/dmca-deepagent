'use client';

import { generateNameVariants } from '@/lib/name-generator';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BrandProfileData {
  id?: string;
  brandName: string;
  description?: string;
  officialUrls: string[];
  socialMedia?: {
    instagram: string;
    twitter: string;
    onlyfans: string;
    other: string;
  };
  keywords: string[];
}

interface BrandProfileFormProps {
  initialData?: BrandProfileData;
  onSubmit?: (data: any) => Promise<void>;
  isEditing?: boolean;
}

export function BrandProfileForm({ initialData, onSubmit, isEditing = false }: BrandProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    brandName: '',
    description: '',
    officialUrls: [''],
    socialMedia: {
      instagram: '',
      twitter: '',
      onlyfans: '',
      other: ''
    },
    keywords: [] as string[]
  });

  const [currentKeyword, setCurrentKeyword] = useState('');
  const [keywordVariants, setKeywordVariants] = useState<string[]>([]);

  // Initialize form with data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        brandName: initialData.brandName || '',
        description: initialData.description || '',
        officialUrls: initialData.officialUrls?.length > 0 
          ? initialData.officialUrls.map(url => url.replace(/^https?:\/\//, ''))
          : [''],
        socialMedia: {
          instagram: initialData.socialMedia?.instagram || '',
          twitter: initialData.socialMedia?.twitter || '',
          onlyfans: initialData.socialMedia?.onlyfans || '',
          other: initialData.socialMedia?.other || ''
        },
        keywords: initialData.keywords || []
      });
    }
  }, [initialData]);

  // Handler para campos simples
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handler para redes sociais
  const handleSocialMediaChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: { ...prev.socialMedia, [platform]: value }
    }));
  };

  // Handler para URLs
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...formData.officialUrls];
    newUrls[index] = value.replace(/^https?:\/\//, '');
    setFormData(prev => ({ ...prev, officialUrls: newUrls }));
  };

  const addUrlField = () => {
    setFormData(prev => ({ 
      ...prev, 
      officialUrls: [...prev.officialUrls, ''] 
    }));
  };

  const removeUrlField = (index: number) => {
    if (formData.officialUrls.length > 1) {
      const newUrls = formData.officialUrls.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, officialUrls: newUrls }));
    }
  };

  // Handler para palavras-chave
  const handleAddKeyword = () => {
    if (currentKeyword.trim() && !formData.keywords.includes(currentKeyword.trim())) {
      const newKeyword = currentKeyword.trim();
      setFormData(prev => ({ 
        ...prev, 
        keywords: [...prev.keywords, newKeyword] 
      }));
      setKeywordVariants(generateNameVariants(newKeyword));
      setCurrentKeyword('');
    }
  };

  const removeKeyword = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Preparar dados para envio
      const submitData = {
        ...formData,
        officialUrls: formData.officialUrls
          .filter(url => url.trim())
          .map(url => url.startsWith('http') ? url : `https://${url}`)
      };

      if (onSubmit) {
        await onSubmit(submitData);
      } else {
        // Default behavior - create new profile
        const response = await fetch('/api/brand-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        router.push('/brand-profiles');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nome da Marca */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Nome da Marca *
          </label>
          <input
            type="text"
            required
            value={formData.brandName}
            onChange={(e) => handleInputChange('brandName', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: Minha Marca"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Descrição
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descreva sua marca..."
          />
        </div>

        {/* URLs Oficiais */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            URLs Oficiais
          </label>
          {formData.officialUrls.map((url, index) => (
            <div key={index} className="flex items-center mb-2">
              <span className="px-3 py-2 bg-gray-100 border border-r-0 rounded-l-md text-sm text-gray-600">
                https://
              </span>
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                className="flex-1 px-4 py-2 border border-l-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="exemplo.com"
              />
              {formData.officialUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrlField(index)}
                  className="ml-2 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addUrlField}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            + Adicionar URL
          </button>
        </div>

        {/* Redes Sociais */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Redes Sociais
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(formData.socialMedia).map(([platform, value]) => (
              <div key={platform}>
                <label className="block text-xs font-medium mb-1 capitalize">
                  {platform}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleSocialMediaChange(platform, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`@${platform}_handle`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Palavras-chave */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            Palavras-chave de Monitoramento
          </label>
          <div className="flex items-center mb-2">
            <input
              type="text"
              value={currentKeyword}
              onChange={(e) => setCurrentKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite uma palavra-chave"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
            >
              Adicionar
            </button>
          </div>
          
          {/* Lista de palavras-chave */}
          {formData.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(index)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Variações geradas */}
          {keywordVariants.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="text-sm font-semibold mb-2">
                Variações geradas ({keywordVariants.length} encontradas):
              </h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                {keywordVariants.slice(0, 24).map((variant, index) => (
                  <span key={index} className="px-2 py-1 bg-white rounded border text-gray-700">
                    {variant}
                  </span>
                ))}
                {keywordVariants.length > 24 && (
                  <span className="px-2 py-1 bg-gray-200 rounded text-gray-600">
                    +{keywordVariants.length - 24} mais...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex items-center justify-between pt-6">
          <button
            type="button"
            onClick={() => router.push('/brand-profiles')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.brandName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting 
              ? 'Salvando...' 
              : isEditing 
                ? 'Atualizar Perfil' 
                : 'Criar Perfil'
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// Export default para compatibilidade
export default function BrandProfileFormPage() {
  return <BrandProfileForm />;
}