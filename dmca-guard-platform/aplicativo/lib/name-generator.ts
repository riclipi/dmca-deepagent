/**
 * Gera variações avançadas de nomes para monitoramento de perfis.
 * Implementa 15+ técnicas diferentes para gerar 50+ variações realistas.
 */
export function generateNameVariants(baseName: string): string[] {
  if (!baseName) return [];
  
  const raw = baseName.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const variants = new Set<string>();

  // 1. VARIAÇÕES BÁSICAS
  variants.add(parts.join(''));        // larycubas
  variants.add(parts.join(' '));       // lary cubas
  parts.forEach(part => variants.add(part)); // lary, cubas

  // 2. SEPARADORES MÚLTIPLOS
  const separators = ['.', '_', '-', '__', '..', '--', '...', '___'];
  separators.forEach(sep => {
    if (parts.length > 1) {
      variants.add(parts.join(sep));
    }
  });

  // 3. LEETSPEAK AVANÇADO (múltiplas versões)
  const leetMaps: Record<string, string>[] = [
    { a: '4', e: '3', i: '1', o: '0', s: '5', l: '1', b: '8', t: '7', g: '9' },
    { a: '@', e: '3', i: '!', o: '0', s: '$', l: '1', b: '6', t: '+', g: '9' },
    { a: '4', e: 'e', i: '1', o: 'o', s: '5', l: 'l', b: 'b', t: '7', g: '9' }
  ];

  function applyLeet(str: string, leetMap: Record<string, string>) {
    return str.split('').map(char => leetMap[char] || char).join('');
  }

  // Aplica diferentes versões de leetspeak
  const baseVariants = Array.from(variants);
  baseVariants.forEach(variant => {
    leetMaps.forEach(leetMap => {
      variants.add(applyLeet(variant, leetMap));
    });
  });

  // 4. NÚMEROS COMUNS (anos, idades, datas)
  const commonNumbers = ['123', '2024', '2023', '01', '02', '03', '99', '2000', '1995', '1990', '21', '22', '23', '24', '25'];
  baseVariants.forEach(variant => {
    commonNumbers.forEach(num => {
      variants.add(variant + num);
      variants.add(num + variant);
    });
  });

  // 5. ABREVIAÇÕES E INICIAIS
  if (parts.length > 1) {
    variants.add(parts.map(p => p[0]).join(''));           // lc
    variants.add(parts.map(p => p.slice(0, 2)).join(''));  // lacub
    variants.add(parts.map(p => p.slice(0, 3)).join(''));  // larcub
    
    // Iniciais com separadores
    const initials = parts.map(p => p[0]).join('');
    separators.forEach(sep => {
      variants.add(parts.map(p => p[0]).join(sep));
    });
  }

  // 6. INVERSÕES E REORGANIZAÇÕES
  if (parts.length > 1) {
    const reversed = [...parts].reverse();
    variants.add(reversed.join(''));
    variants.add(reversed.join('.'));
    variants.add(reversed.join('_'));
    
    // Primeira palavra + inicial da segunda
    variants.add(parts[0] + parts[1][0]);
    variants.add(parts[0] + parts[1].slice(0, 2));
  }

  // 7. SUFIXOS E PREFIXOS COMUNS
  const suffixes = ['official', 'real', 'true', 'original', 'the', 'oficial', 'br', 'pt'];
  const prefixes = ['the', 'real', 'oficial', 'original'];
  
  baseVariants.forEach(variant => {
    suffixes.forEach(suffix => {
      variants.add(variant + suffix);
      variants.add(variant + '_' + suffix);
      variants.add(variant + '.' + suffix);
    });
    
    prefixes.forEach(prefix => {
      variants.add(prefix + variant);
      variants.add(prefix + '_' + variant);
      variants.add(prefix + '.' + variant);
    });
  });

  // 8. DUPLICAÇÕES E REPETIÇÕES
  baseVariants.forEach(variant => {
    variants.add(variant + variant);           // larycubaslarycubas
    if (variant.length <= 6) {
      variants.add(variant + '2');            // larycubas2
      variants.add(variant + 'x');            // larycubasx
    }
  });

  // 9. CARACTERES ESPECIAIS EXTRAS
  const specialChars = ['x', 'z', 'k', 'y'];
  baseVariants.forEach(variant => {
    specialChars.forEach(char => {
      variants.add(variant + char);
      variants.add(char + variant);
    });
  });

  // 10. FRAGMENTOS E COMBINAÇÕES
  if (parts.length > 1) {
    parts.forEach((part, index) => {
      const otherParts = parts.filter((_, i) => i !== index);
      otherParts.forEach(other => {
        variants.add(part + other);
        variants.add(other + part);
        variants.add(part + '_' + other);
        variants.add(part + '.' + other);
      });
    });
  }

  // 11. VARIAÇÕES POR PARTE INDIVIDUAL
  parts.forEach(part => {
    if (part.length > 3) {
      variants.add(part.slice(0, -1));        // lar (remove última letra)
      variants.add(part.slice(1));            // ary (remove primeira letra)
      variants.add(part.slice(0, 4));         // lary (primeiras 4 letras)
    }
  });

  // 12. NÚMEROS INTERCALADOS
  baseVariants.forEach(variant => {
    if (variant.length > 2) {
      const mid = Math.floor(variant.length / 2);
      variants.add(variant.slice(0, mid) + '1' + variant.slice(mid));
      variants.add(variant.slice(0, mid) + '2' + variant.slice(mid));
      variants.add(variant.slice(0, mid) + '3' + variant.slice(mid));
    }
  });

  // FILTRO FINAL E LIMPEZA
  return Array.from(variants)
    .map(v => v.trim())
    .filter(v => !!v && v.length >= 2 && v.length <= 30) // Permite variantes menores
    .filter(v => !/^\d+$/.test(v)) // Remove números puros
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 100); // Limita a 100 variações top
}
