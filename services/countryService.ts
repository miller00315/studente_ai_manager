// Service para buscar países e estados da API CountriesNow
// API: https://countriesnow.space/

export interface Country {
  name: string;
  iso2: string;
  iso3: string;
}

export interface State {
  name: string;
  state_code: string;
}

const API_BASE_URL = 'https://countriesnow.space/api/v0.1';

// Cache para evitar requisições repetidas
let countriesCache: Country[] | null = null;
const statesCache: Map<string, State[]> = new Map();

/**
 * Busca todos os países disponíveis
 */
export async function getCountries(): Promise<Country[]> {
  if (countriesCache) {
    return countriesCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/countries/positions`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.msg || 'Erro ao buscar países');
    }

    // A API retorna países com nome e códigos ISO
    countriesCache = data.data.map((item: any) => ({
      name: item.name,
      iso2: item.iso2 || '',
      iso3: item.iso3 || ''
    }));

    return countriesCache || [];
  } catch {
    return getDefaultCountries();
  }
}

/**
 * Busca estados/províncias de um país específico
 */
export async function getStatesByCountry(countryName: string): Promise<State[]> {
  if (!countryName) {
    return [];
  }

  // Verifica cache
  const cached = statesCache.get(countryName.toLowerCase());
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/countries/states`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ country: countryName }),
    });

    const data = await response.json();

    if (data.error) {
      return [];
    }

    const states: State[] = data.data.states.map((state: any) => ({
      name: state.name,
      state_code: state.state_code || ''
    }));

    // Salva no cache
    statesCache.set(countryName.toLowerCase(), states);

    return states;
  } catch {
    return [];
  }
}

/**
 * Lista de países padrão (fallback)
 */
function getDefaultCountries(): Country[] {
  return [
    { name: 'Brazil', iso2: 'BR', iso3: 'BRA' },
    { name: 'Portugal', iso2: 'PT', iso3: 'PRT' },
    { name: 'United States', iso2: 'US', iso3: 'USA' },
    { name: 'Argentina', iso2: 'AR', iso3: 'ARG' },
    { name: 'Uruguay', iso2: 'UY', iso3: 'URY' },
    { name: 'Paraguay', iso2: 'PY', iso3: 'PRY' },
    { name: 'Chile', iso2: 'CL', iso3: 'CHL' },
    { name: 'Colombia', iso2: 'CO', iso3: 'COL' },
    { name: 'Peru', iso2: 'PE', iso3: 'PER' },
    { name: 'Ecuador', iso2: 'EC', iso3: 'ECU' },
    { name: 'Venezuela', iso2: 'VE', iso3: 'VEN' },
    { name: 'Bolivia', iso2: 'BO', iso3: 'BOL' },
    { name: 'Canada', iso2: 'CA', iso3: 'CAN' },
    { name: 'Mexico', iso2: 'MX', iso3: 'MEX' },
    { name: 'Spain', iso2: 'ES', iso3: 'ESP' },
    { name: 'France', iso2: 'FR', iso3: 'FRA' },
    { name: 'Germany', iso2: 'DE', iso3: 'DEU' },
    { name: 'Italy', iso2: 'IT', iso3: 'ITA' },
    { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR' },
    { name: 'Japan', iso2: 'JP', iso3: 'JPN' },
    { name: 'China', iso2: 'CN', iso3: 'CHN' },
    { name: 'Australia', iso2: 'AU', iso3: 'AUS' },
    { name: 'New Zealand', iso2: 'NZ', iso3: 'NZL' },
    { name: 'Angola', iso2: 'AO', iso3: 'AGO' },
    { name: 'Mozambique', iso2: 'MZ', iso3: 'MOZ' },
    { name: 'Cape Verde', iso2: 'CV', iso3: 'CPV' },
  ];
}

/**
 * Tradução de nomes de países (Inglês -> Português)
 */
export const COUNTRY_TRANSLATIONS: Record<string, string> = {
  'Brazil': 'Brasil',
  'Portugal': 'Portugal',
  'United States': 'Estados Unidos',
  'Argentina': 'Argentina',
  'Uruguay': 'Uruguai',
  'Paraguay': 'Paraguai',
  'Chile': 'Chile',
  'Colombia': 'Colômbia',
  'Peru': 'Peru',
  'Ecuador': 'Equador',
  'Venezuela': 'Venezuela',
  'Bolivia': 'Bolívia',
  'Canada': 'Canadá',
  'Mexico': 'México',
  'Spain': 'Espanha',
  'France': 'França',
  'Germany': 'Alemanha',
  'Italy': 'Itália',
  'United Kingdom': 'Reino Unido',
  'Japan': 'Japão',
  'China': 'China',
  'Australia': 'Austrália',
  'New Zealand': 'Nova Zelândia',
  'Angola': 'Angola',
  'Mozambique': 'Moçambique',
  'Cape Verde': 'Cabo Verde',
  'Guinea-Bissau': 'Guiné-Bissau',
  'Sao Tome and Principe': 'São Tomé e Príncipe',
  'East Timor': 'Timor-Leste',
};

/**
 * Tradução reversa (Português -> Inglês) para API
 */
export const COUNTRY_TRANSLATIONS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_TRANSLATIONS).map(([en, pt]) => [pt, en])
);

/**
 * Obtém o nome do país em português
 */
export function getCountryNamePt(englishName: string): string {
  return COUNTRY_TRANSLATIONS[englishName] || englishName;
}

/**
 * Obtém o nome do país em inglês (para API)
 */
export function getCountryNameEn(portugueseName: string): string {
  return COUNTRY_TRANSLATIONS_REVERSE[portugueseName] || portugueseName;
}

