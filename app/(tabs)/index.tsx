import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useState, } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_KEY = 'a60e257adc0dfad1e261cabb10a77ee1';

type WeatherData = {
  name: string;
  main: { temp: number };
  weather: { description: string; icon: string }[];
};



export default function WeatherScreen() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const debouncedFetch = useCallback(
    debounce((text: string) => {
      fetchCitySuggestions(text);
    }, 500),
    []
  );
  


  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem('weatherHistory');
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Błąd podczas ładowania historii:', e);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    const saveHistory = async () => {
      try {
        await AsyncStorage.setItem('weatherHistory', JSON.stringify(history));
      } catch (e) {
        console.error('Błąd podczas zapisywania historii:', e);
      }
    };

    saveHistory();
  }, [history]);



  const getWeather = async (
    cityName?: string, 
    updateCityState: boolean = true,
    addToHistory: boolean = true) => {

    const query = cityName ?? city;
    if (!query.trim()) return;
  
    setLoading(true);
    setError(null);
    setWeather(null);
  
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${API_KEY}&units=metric&lang=pl`
      );
      const data = await response.json();
  
      if (data.cod !== 200) {
        throw new Error(data.message);
      }
  
      setWeather(data);
      if (addToHistory) {
        setHistory((prev) => {
          const newHistory = [query, ...prev.filter((c) => c.toLowerCase() !== query.toLowerCase())];
          return newHistory.slice(0, 5);
        });
      }      
     
      if (cityName && updateCityState) {
        setCity(cityName);
      };
    } catch (err) {
      setError('Nie znaleziono miasta. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };
  


  const fetchCitySuggestions = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
  
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`
      );
      const data = await res.json();
  
      const cityNames = data.map((item: any) => item.name).filter(
        (value: string, index: number, self: string[]) => self.indexOf(value) === index
      );
  
      setSuggestions(cityNames);
    } catch (e) {
      setSuggestions([]);
    }
  };
  



  const getWeatherByLocation = async () => {
    setLoading(true);
    setError(null);
    setWeather(null);
  
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Brak uprawnień do lokalizacji.');
        setLoading(false);
        return;
      }
  
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
  
      
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
  
      const cityName = place.city || place.subregion || place.region || place.name;
  
      if (!cityName) {
        throw new Error('Nie udało się ustalić miasta na podstawie lokalizacji.');
      }
  
      
      await getWeather(cityName, false, false);
      setCity(cityName); 
  
    } catch (err) {
      console.error(err);
      setError('Nie udało się pobrać lokalizacji ani miasta.');
    } finally {
      setLoading(false);
    }
  };
  
  
  
  


  useEffect(() => {
    const fetchAndResetInput = async () => {
      await getWeatherByLocation();
  
      
      setTimeout(() => {
        setCity('');
      }, 100);
    };
  
    fetchAndResetInput();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌤️ Pogoda</Text>

      <TextInput
        style={styles.input}
        placeholder="Wpisz miasto..."
        autoCorrect={false}
        autoComplete="off"
        autoCapitalize="none"
        value={city}
        onChangeText={(text) => {
          setCity(text);
          debouncedFetch(text);
        }}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          getWeather();
        }}  
      />

      

{suggestions.length > 0 && (
  <View style={styles.suggestionsContainer}>
    {suggestions.map((item) => (
      <TouchableOpacity
        key={item}
        onPress={() => {
          setCity(item);
          setSuggestions([]);
          Keyboard.dismiss();
          getWeather(item);
        }}
        style={styles.suggestionItem}
      >
        <Text>{item}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}

      

<TouchableOpacity style={styles.button} onPress={() => getWeather()}>
  <Text style={styles.buttonText}>Pobierz pogodę</Text>
</TouchableOpacity>


      {history.map((item) => (
  <TouchableOpacity
    key={item}
    style={styles.historyRow}
    onPress={() => {
      setCity(item);
      getWeather(item);  
    }}
  >
    <Text style={styles.historyButtonText}>
      {item}
    </Text>

    <TouchableOpacity
      onPress={(e) => {
        e.stopPropagation();
        setHistory(prev => prev.filter(c => c !== item));
      }}
      style={styles.deleteButtonSmall}
    >
      <Text style={styles.deleteButtonText}>✕</Text>
    </TouchableOpacity>
  </TouchableOpacity>
))}





      

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {error && <Text style={styles.error}>{error}</Text>}

      {weather && (
        <View style={styles.result}>
          <Text style={styles.city}>{weather.name}</Text>
          <Text style={styles.temp}>{Math.round(weather.main.temp)}°C</Text>
          <Text>{weather.weather[0].description}</Text>
          <Image
            source={{
              uri: `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`,
            }}
            style={{ width: 100, height: 100 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    position: 'relative',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#00796b',
    marginTop: 40
  },
  input: {
    borderWidth: 1,
    borderColor: '#00796b',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00796b',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  error: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  result: {
    alignItems: 'center',
    marginTop: 30,
    backgroundColor: '#ffffffcc',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  city: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00796b',
  },
  temp: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#00796b',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  
  historyButtonText: {
    color: '#333',
    fontSize: 16,
  },
  
  deleteButtonSmall: {
    marginLeft: 10,
    backgroundColor: '#ddd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  
  deleteButtonText: {
    color: '#900',
    fontSize: 16,
    fontWeight: 'bold',
  },

  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
    marginTop: 5,
    alignSelf: 'stretch',
  },
  
  suggestionItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  
  
  
});
