import { useState, useEffect, useCallback } from 'react';
import { 
  getCountries, 
  getStatesByCountry, 
  getCountryNamePt, 
  getCountryNameEn,
  Country, 
  State 
} from '../../services/countryService';

interface UseCountryStatesReturn {
  // Data
  countries: Country[];
  states: State[];
  
  // Loading states
  loadingCountries: boolean;
  loadingStates: boolean;
  
  // Selected values
  selectedCountry: string;
  selectedState: string;
  
  // Actions
  setSelectedCountry: (country: string) => void;
  setSelectedState: (state: string) => void;
  
  // Helpers
  getCountryDisplayName: (englishName: string) => string;
  getCountryApiName: (displayName: string) => string;
}

export function useCountryStates(
  initialCountry?: string,
  initialState?: string
): UseCountryStatesReturn {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [selectedCountry, setSelectedCountryInternal] = useState(initialCountry || '');
  const [selectedState, setSelectedState] = useState(initialState || '');

  // Carrega países na inicialização
  useEffect(() => {
    const loadCountries = async () => {
      setLoadingCountries(true);
      try {
        const data = await getCountries();
        // Ordena por nome traduzido
        const sorted = [...data].sort((a, b) => 
          getCountryNamePt(a.name).localeCompare(getCountryNamePt(b.name), 'pt-BR')
        );
        setCountries(sorted);
      } catch (error) {
        console.error('Erro ao carregar países:', error);
      } finally {
        setLoadingCountries(false);
      }
    };

    loadCountries();
  }, []);

  // Carrega estados quando país muda
  useEffect(() => {
    const loadStates = async () => {
      if (!selectedCountry) {
        setStates([]);
        return;
      }

      setLoadingStates(true);
      setStates([]);
      
      try {
        // Converte nome do país para inglês (para API)
        const countryApiName = getCountryNameEn(selectedCountry);
        const data = await getStatesByCountry(countryApiName);
        
        // Ordena alfabeticamente
        const sorted = [...data].sort((a, b) => 
          a.name.localeCompare(b.name, 'pt-BR')
        );
        setStates(sorted);
      } catch (error) {
        console.error('Erro ao carregar estados:', error);
      } finally {
        setLoadingStates(false);
      }
    };

    loadStates();
  }, [selectedCountry]);

  // Quando país muda, limpa estado selecionado
  const setSelectedCountry = useCallback((country: string) => {
    setSelectedCountryInternal(country);
    setSelectedState(''); // Limpa estado ao trocar país
  }, []);

  return {
    countries,
    states,
    loadingCountries,
    loadingStates,
    selectedCountry,
    selectedState,
    setSelectedCountry,
    setSelectedState,
    getCountryDisplayName: getCountryNamePt,
    getCountryApiName: getCountryNameEn,
  };
}

