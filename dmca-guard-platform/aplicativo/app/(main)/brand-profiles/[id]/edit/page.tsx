'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BrandProfileForm } from '../../brand-profile-form';

interface BrandProfile {
  id: string;
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

export default function EditBrandProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrandProfile = async () => {
      if (!params.id) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/brand-profiles/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Você precisa estar logado para acessar este perfil.');
          } else if (response.status === 404) {
            setError('Perfil não encontrado ou você não tem permissão para editá-lo.');
          } else {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
          }
          return;
        }

        const data = await response.json();
        setBrandProfile(data);
      } catch (err) {
        console.error('Erro ao buscar brand profile:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchBrandProfile();
  }, [params.id]);

  const handleUpdate = async (formData: any) => {
    if (!params.id) return;

    try {
      const response = await fetch(`/api/brand-profiles/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      router.push('/brand-profiles');
    } catch (err) {
      console.error('Erro ao atualizar brand profile:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };


  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Erro</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => router.push('/brand-profiles')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Voltar para Perfis
          </button>
        </div>
      </div>
    );
  }

  if (!brandProfile) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-600">Perfil não encontrado</h1>
          <button 
            onClick={() => router.push('/brand-profiles')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Voltar para Perfis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Editar Perfil de Marca</h1>
        <p className="text-muted-foreground">
          Atualize as informações do perfil "{brandProfile.brandName}"
        </p>
      </div>

      <BrandProfileForm 
        initialData={brandProfile}
        onSubmit={handleUpdate}
        isEditing={true}
      />
    </div>
  );
}