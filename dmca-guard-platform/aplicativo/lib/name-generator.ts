/**
 * Gera variações avançadas de nomes para monitoramento de perfis.
 * Inclui: concatenação, ponto, underline, hífen, leetspeak, removendo espaços.
 */
export function generateNameVariants(baseName: string): string[] {
  if (!baseName) return [];
  const raw = baseName.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);

  // Base: junto e separado
  let bases = [
    parts.join(''),    // larycubas
    parts.join(' '),   // lary cubas
    ...parts           // lary, cubas
  ];

  // Combinando com separadores
  const separators = ['.', '_', '-', '', '__', '..', '--'];
  let variants = new Set<string>();

  for (let sep of separators) {
    if (parts.length > 1) {
      variants.add(parts.join(sep));
    }
  }
  // Também adiciona o nome junto (sem sep)
  variants.add(parts.join(''));

  // Leetspeak map
  const leetMap: Record<string, string> = {
    a: '4', e: '3', i: '1', o: '0', s: '5', l: '1', b: '8', y: 'y', c: 'c', u: 'u'
  };

  // Função para transformar em leet
  function toLeet(str: string) {
    return str.split('').map(char => leetMap[char] || char).join('');
  }

  // Gera leet para cada variante
  Array.from(variants).forEach(variant => {
    variants.add(toLeet(variant));
  });

  // Adiciona abreviados
  if (parts.length > 1) {
    variants.add(parts.map(p => p[0]).join(''));        // lc
    variants.add(parts.map(p => p.slice(0, 3)).join(''));// lar cub
  }

  // Remove duplicatas e variantes pequenas
  return Array.from(variants)
    .map(v => v.trim())
    .filter(v => !!v && v.length >= 4)
    .sort((a, b) => a.localeCompare(b));
}
