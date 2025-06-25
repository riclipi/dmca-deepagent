import { generateNameVariants } from '@/lib/name-generator';
import { useState } from 'react';

export default function BrandProfileForm() {
  const [officialUrls, setOfficialUrls] = useState<string[]>(['']);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [keywordVariants, setKeywordVariants] = useState<string[]>([]);

  // Handler para adicionar URL
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...officialUrls];
    newUrls[index] = value.replace(/^https?:\/\//, ''); // Remove prefixo se o usuário digitar
    setOfficialUrls(newUrls);
  };

  // Handler para adicionar palavra-chave
  const handleAddKeyword = () => {
    if (currentKeyword.trim()) {
      setKeywords([...keywords, currentKeyword.trim()]);
      setKeywordVariants(generateNameVariants(currentKeyword.trim()));
      setCurrentKeyword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ao salvar, concatena 'https://' com o valor digitado
    const urlsToSave = officialUrls.map(url => 'https://' + url.replace(/^https?:\/\//, ''));
    // ...envia urlsToSave para o backend...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ...outros campos... */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">URLs Oficiais</label>
        {officialUrls.map((url, idx) => (
          <div key={idx} className="flex items-center mb-2">
            <span className="px-2 py-1 bg-muted rounded-l text-muted-foreground border border-r-0 border-input text-xs">https://</span>
            <input
              type="text"
              className="border border-input rounded-r px-2 py-1 w-full focus:outline-none"
              value={url}
              onChange={e => handleUrlChange(idx, e.target.value)}
              placeholder="seudominio.com"
              autoComplete="off"
            />
          </div>
        ))}
        {/* ...botão para adicionar/remover URLs... */}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Palavras-chave</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="border border-input rounded px-2 py-1 w-full focus:outline-none"
            value={currentKeyword}
            onChange={e => setCurrentKeyword(e.target.value)}
            placeholder="Digite uma palavra-chave"
            autoComplete="off"
          />
          <button type="button" className="btn btn-primary" onClick={handleAddKeyword}>Adicionar</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {keywords.map((kw, i) => (
            <span key={i} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">{kw}</span>
          ))}
        </div>
        {keywordVariants.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground block mb-1">Variações criadas por IA ✨</span>
            <div className="flex flex-wrap gap-2">
              {keywordVariants.map((variant, i) => (
                <span key={i} className="bg-accent text-foreground px-2 py-1 rounded text-xs border border-accent-foreground/20">{variant}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* ...restante do formulário... */}
    </form>
  );
}