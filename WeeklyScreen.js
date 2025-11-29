import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import pLimit from 'p-limit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProgressBar from 'react-native-progress/Bar';
import SpeedGauge from './Components/SpeedGauge';

let TICKERS = ['OPCH', 'CRWD', 'MDB', 'ORCL', 'ADBE', 'SOFI', 'OXY', 'PEP', 'C', 'LLY', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'JNJ', 'PFE', 'WMT', 'XOM', 'KO', 'DIS', 'NKE', 'MCD', 'HD', 'IBM', 'CVX', 'UNH', 'BRK.B', 'BAC', 'NFLX', 'GE', 'BA', 'CAT', 'PG', 'NEE', 'ECL', 'DD', 'AMT', 'PLD', 'SPG', 'DUK', 'AEP', 'AXP'];

// Hardcoded upcoming 2025 CPI and PPI release dates (verify at https://www.bls.gov/schedule/2025/)
const ECONOMIC_RELEASE_DATES_2025 = [
  { name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL', date: '2025-08-12' },
  { name: 'PPI (All Commodities)', series: 'PPIACO', date: '2025-08-14' },
  { name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL', date: '2025-09-09' },
  { name: 'PPI (All Commodities)', series: 'PPIACO', date: '2025-09-11' },
  { name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL', date: '2025-10-14' },
  { name: 'PPI (All Commodities)', series: 'PPIACO', date: '2025-10-16' },
  { name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL', date: '2025-11-11' },
  { name: 'PPI (All Commodities)', series: 'PPIACO', date: '2025-11-13' },
  { name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL', date: '2025-12-09' },
  { name: 'PPI (All Commodities)', series: 'PPIACO', date: '2025-12-11' },
];

// American flag logo for CPI/PPI
const US_FLAG_LOGO = 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a4/Flag_of_the_United_States.svg/320px-Flag_of_the_United_States.svg.png';

// Limit to 2 concurrent requests to avoid rate limits
const limit = pLimit(2);

const WeeklyScreen = () => {
  const getInitialMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [weekStart, setWeekStart] = useState(getInitialMonday());
  const [earningsData, setEarningsData] = useState([]);
  const [companyProfiles, setCompanyProfiles] = useState({});
  const [stockPrices, setStockPrices] = useState({});
  const [economicData, setEconomicData] = useState([]); // Store CPI/PPI data
  const [error, setError] = useState('');
  const [missingTickers, setMissingTickers] = useState([]);
  const [nextEarnings, setNextEarnings] = useState({});
  const [allEarnings, setAllEarnings] = useState({});
  const [progress, setProgress] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigation = useNavigation();

  const FINNHUB_API_KEY = 'co2qok1r01qp2simakvgco2qok1r01qp2simal00';
  const ALPHA_VANTAGE_API_KEY = 'S8XWTJTKR8KA9K0W';

  const loadCachedData = async (key) => {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.timestamp < Date.now() - 24 * 3600 * 1000) return null;
        return parsed.data;
      }
      return null;
    } catch (err) {
      console.error(`Error loading ${key}:`, err);
      return null;
    }
  };

  const saveCachedData = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err) {
      console.error(`Error saving ${key}:`, err);
    }
  };

  const formatDay = (dateString) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = days[dateObj.getDay()];
    const formattedMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
    const formattedDay = String(dateObj.getDate()).padStart(2, '0');
    return `${dayName} ${formattedMonth}/${formattedDay}`;
  };

  const formatEstimateDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return `${month}/${day}/${year}`;
  };

  const formatReleaseTime = (hour) => {
    if (hour === 'amc') return 'After Market Closes';
    if (hour === 'bmo') return 'Before Market Opens';
    return '';
  };

  const formatWeekRange = (start, end) => {
    const startMonth = String(start.getMonth() + 1).padStart(2, '0');
    const startDay = String(start.getDate()).padStart(2, '0');
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    return `From ${startMonth}/${startDay} to ${endMonth}/${endDay}`;
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleRefresh = async () => {
    try {
      console.log('Attempting to clear AsyncStorage');
      await AsyncStorage.clear();
      console.log('AsyncStorage cleared successfully');
      setProgress(0);
      setWeekStart(new Date(weekStart));
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error clearing AsyncStorage:', err);
      setError('Failed to refresh data: ' + err.message);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered for data fetch');
    const fetchData = async () => {
      setProgress(0);
      const totalTasks = TICKERS.length * 2 + 2; // Profiles + Prices + CPI + PPI
      let completedTasks = 0;

      const updateProgress = () => {
        completedTasks++;
        setProgress(completedTasks / totalTasks);
      };

      const fetchCompanyProfiles = async () => {
        const cacheKey = 'companyProfiles';
        const cached = await loadCachedData(cacheKey);
        if (cached && Object.keys(cached).length === TICKERS.length) {
          setCompanyProfiles(cached);
          completedTasks += TICKERS.length;
          setProgress(completedTasks / totalTasks);
          return;
        }
        const profiles = {};
        const profilePromises = TICKERS.map(ticker =>
          limit(async () => {
            try {
              const response = await axios.get(
                `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`
              );
              const data = response.data;
              await delay(1000);
              profiles[ticker] = { name: data.name || ticker, logo: data.logo || null };
            } catch (err) {
              console.error(`Profile error for ${ticker}:`, err.response?.status);
              if (err.response?.status === 429) await delay(60000);
              profiles[ticker] = { name: ticker, logo: null };
            }
            updateProgress();
          })
        );
        await Promise.all(profilePromises);
        setCompanyProfiles(profiles);
        saveCachedData(cacheKey, profiles);
      };

      const fetchStockPrices = async () => {
        const cacheKey = 'stockPrices';
        const cached = await loadCachedData(cacheKey);
        if (cached && Object.keys(cached).length === TICKERS.length) {
          setStockPrices(cached);
          completedTasks += TICKERS.length;
          setProgress(completedTasks / totalTasks);
          return;
        }
        const prices = {};
        const pricePromises = TICKERS.map(ticker =>
          limit(async () => {
            try {
              const response = await axios.get(
                `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
              );
              const data = response.data;
              await delay(1000);
              prices[ticker] = data.c || null;
            } catch (err) {
              console.error(`Price error for ${ticker}:`, err.response?.status);
              if (err.response?.status === 429) await delay(60000);
              prices[ticker] = null;
            }
            updateProgress();
          })
        );
        await Promise.all(pricePromises);
        setStockPrices(prices);
        saveCachedData(cacheKey, prices);
      };

      const fetchAllEarnings = async () => {
        const cacheKey = 'allEarnings_2025';
        const cachedAllEarnings = await loadCachedData(cacheKey);
        if (cachedAllEarnings) {
          setAllEarnings(cachedAllEarnings);
          completedTasks += TICKERS.length;
          setProgress(completedTasks / totalTasks);
          return;
        }
        const earningsData = {};
        const earningsPromises = TICKERS.map(ticker =>
          limit(async () => {
            try {
              const fromDate = '2025-01-01';
              const toDate = '2025-12-31';
              const response = await axios.get(
                `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${toDate}&symbol=${ticker}&international=false&token=${FINNHUB_API_KEY}`
              );
              earningsData[ticker] = response.data.earningsCalendar || [];
              await delay(1000);
            } catch (err) {
              console.error(`Earnings error for ${ticker}:`, err.response?.status);
              if (err.response?.status === 429) await delay(60000);
              earningsData[ticker] = [];
            }
            updateProgress();
          })
        );
        await Promise.all(earningsPromises);
        setAllEarnings(earningsData);
        saveCachedData(cacheKey, earningsData);
      };

      const fetchEconomicData = async () => {
        const cacheKey = 'economicData_2025';
        const cached = await loadCachedData(cacheKey);
        if (cached) {
          setEconomicData(cached);
          completedTasks += 2;
          setProgress(completedTasks / totalTasks);
          return;
        }

        const economicReleases = [...ECONOMIC_RELEASE_DATES_2025];
        const economicEndpoints = [
          { function: 'CPI', name: 'CPI (All Urban Consumers)', series: 'CPIAUCSL' },
          { function: 'PPI', name: 'PPI (All Commodities)', series: 'PPIACO' },
        ];

        const economicPromises = economicEndpoints.map(endpoint =>
          limit(async () => {
            try {
              const response = await axios.get(
                `https://www.alphavantage.co/query?function=${endpoint.function}&interval=monthly&apikey=${ALPHA_VANTAGE_API_KEY}`
              );
              const data = response.data.data || [];
              const latestData = data.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
              economicReleases.forEach(release => {
                if (release.series === endpoint.series) {
                  release.value = latestData ? parseFloat(latestData.value).toFixed(2) : 'N/A';
                  release.latestDate = latestData ? latestData.date : 'N/A';
                }
              });
              await delay(1200); // Increased delay for Alpha Vantage's 5 requests/min limit
            } catch (err) {
              console.error(`Error fetching ${endpoint.name}:`, err.response?.status);
              if (err.response?.status === 429) await delay(60000);
              economicReleases.forEach(release => {
                if (release.series === endpoint.series) {
                  release.value = 'N/A';
                  release.latestDate = 'N/A';
                }
              });
            }
            updateProgress();
          })
        );

        await Promise.all(economicPromises);
        setEconomicData(economicReleases);
        saveCachedData(cacheKey, economicReleases);
      };

      try {
        await Promise.all([fetchCompanyProfiles(), fetchStockPrices(), fetchAllEarnings(), fetchEconomicData()]);
        console.log('Data fetch completed');
        setProgress(1);
      } catch (err) {
        console.error('Data fetch failed:', err);
        setError(err.message || 'Failed to fetch data');
      }
    };

    fetchData();
  }, [weekStart]);

  useEffect(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4);

    const filterEarningsForWeek = () => {
      const groupedByDate = {};
      const missing = [];
      const nextEarningsData = {};

      TICKERS.forEach(ticker => {
        const tickerEarnings = allEarnings[ticker] || [];
        const weekEarnings = tickerEarnings.filter(item => {
          const earningsDate = new Date(item.date);
          return earningsDate >= weekStart && earningsDate <= weekEnd;
        });

        if (weekEarnings.length === 0) missing.push(ticker);

        weekEarnings.forEach(item => {
          const dayKey = formatDay(item.date);
          if (!groupedByDate[dayKey]) groupedByDate[dayKey] = { date: dayKey, companies: [], economic: [] };
          groupedByDate[dayKey].companies.push({
            ticker: item.symbol,
            revenue: item.revenueEstimate ? `$${(item.revenueEstimate / 1000000000).toFixed(2)}B` : null,
            eps: item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : null,
            isPostMarket: item.hour === 'amc',
          });
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureEarnings = tickerEarnings.filter(item => new Date(item.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
        const nextEarnings = futureEarnings[0];
        if (nextEarnings) {
          nextEarningsData[ticker] = {
            date: nextEarnings.date,
            revenue: nextEarnings.revenueEstimate ? `$${(nextEarnings.revenueEstimate / 1000000000).toFixed(2)}B` : null,
            eps: nextEarnings.epsEstimate != null ? `$${nextEarnings.epsEstimate.toFixed(2)}` : null,
            hour: nextEarnings.hour || null,
          };
        } else {
          nextEarningsData[ticker] = { date: null, revenue: null, eps: null, hour: null };
        }
      });

      // Add CPI/PPI release dates to groupedByDate
      economicData.forEach(release => {
        const releaseDate = new Date(release.date);
        if (releaseDate >= weekStart && releaseDate <= weekEnd) {
          const dayKey = formatDay(release.date);
          if (!groupedByDate[dayKey]) groupedByDate[dayKey] = { date: dayKey, companies: [], economic: [] };
          groupedByDate[dayKey].economic.push({
            name: release.name,
            series: release.series,
          });
        }
      });

      const sortedData = Object.values(groupedByDate).sort((a, b) => {
        const dateA = new Date(a.date.split(' ')[1].split('/').reverse().join('-'));
        const dateB = new Date(b.date.split(' ')[1].split('/').reverse().join('-'));
        return dateA - dateB;
      });

      const sortedMissingTickers = [...missing].sort((a, b) => {
        const dateA = nextEarnings[a]?.date ? new Date(nextEarnings[a].date) : new Date('9999-12-31');
        const dateB = nextEarnings[b]?.date ? new Date(nextEarnings[b].date) : new Date('9999-12-31');
        return dateA - dateB;
      });

      setEarningsData(sortedData);
      setMissingTickers(sortedMissingTickers);
      setNextEarnings(nextEarningsData);
    };

    if (Object.keys(allEarnings).length > 0 || economicData.length > 0) filterEarningsForWeek();
  }, [weekStart, allEarnings, economicData]);

  const handlePrevWeek = () => setWeekStart(new Date(weekStart.setDate(weekStart.getDate() - 7)));
  const handleNextWeek = () => setWeekStart(new Date(weekStart.setDate(weekStart.getDate() + 7)));
  const handleCompanyPress = (ticker) => navigation.navigate('Particular', { ticker });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  const weekRange = formatWeekRange(weekStart, weekEnd);

  return (
    <View style={styles.container}>
      <SpeedGauge
        gaugeSizeFactor={0.41}
        strokeWidth={22}
        refreshTrigger={refreshKey}
        customStyles={{
          container: { 
            backgroundColor: '#e0f7fa',
            paddingVertical: 1,
            borderBottomWidth: 1,
            borderBottomColor: '#ccc',
          },
          speedText: { 
            fontSize: 9,
            color: '#007bff',
            fontWeight: 'bold',
          },
        }}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevWeek}>
          <Text style={styles.navButton}>PREV. WEEK</Text>
        </TouchableOpacity>
        <Text style={styles.weekRange}>{weekRange}</Text>
        <TouchableOpacity onPress={handleNextWeek}>
          <Text style={styles.navButton}>NEXT WEEK</Text>
        </TouchableOpacity>
      </View>
      {progress > 0 && progress < 1 && (
        <ProgressBar 
          progress={progress} 
          width={null} 
          style={styles.progressBar} 
          indeterminate={progress === 0} 
        />
      )}
      <ScrollView style={styles.scrollView}>
        {earningsData.length > 0 ? (
          earningsData.map((day, index) => (
            <View key={index} style={styles.dayContainer}>
              <Text style={styles.date}>{day.date}</Text>
              {day.economic.map((econ, idx) => (
                <View key={`econ-${idx}`} style={styles.economicCard}>
                  <View style={styles.companyRow}>
                    <Image 
                      source={{ uri: US_FLAG_LOGO }} 
                      style={styles.logo} 
                      resizeMode="contain" 
                    />
                    <View style={styles.textContainer}>
                      <Text style={styles.ticker}>{econ.name}</Text>
                      <Text style={styles.companyName}>Series: {econ.series}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {day.companies.map((company, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.companyCard} 
                  onPress={() => handleCompanyPress(company.ticker)}
                >
                  <View style={styles.companyRow}>
                    {companyProfiles[company.ticker]?.logo ? (
                      <Image 
                        source={{ uri: companyProfiles[company.ticker].logo }} 
                        style={styles.logo} 
                        resizeMode="contain" 
                      />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Text style={styles.logoPlaceholderText}>{company.ticker[0]}</Text>
                      </View>
                    )}
                    <View style={styles.textContainer}>
                      <View style={styles.tickerRow}>
                        <Text style={styles.ticker}>{company.ticker}</Text>
                        {stockPrices[company.ticker] && (
                          <Text style={styles.price}>${stockPrices[company.ticker].toFixed(2)}</Text>
                        )}
                      </View>
                      <Text style={styles.companyName}>
                        {companyProfiles[company.ticker]?.name || company.ticker}
                      </Text>
                      <Text style={styles.estimates}>
                        {company.revenue || company.eps ? (
                          <>
                            {company.revenue && `Revenue Estimates: ${company.revenue}`}
                            {company.revenue && company.eps && ', '}
                            {company.eps && `EPS Estimates: ${company.eps}`}
                            {company.isPostMarket && ' (Post-market release)'}
                          </>
                        ) : 'Estimates unavailable'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.noData}>{error || 'Loading data...'}</Text>
        )}
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
        {missingTickers.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingTitle}>No Earnings This Week</Text>
            {missingTickers.map((ticker, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.companyCard} 
                onPress={() => handleCompanyPress(ticker)}
              >
                <View style={styles.companyRow}>
                  {companyProfiles[ticker]?.logo ? (
                    <Image 
                      source={{ uri: companyProfiles[ticker].logo }} 
                      style={styles.logo} 
                      resizeMode="contain" 
                    />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Text style={styles.logoPlaceholderText}>{ticker[0]}</Text>
                    </View>
                  )}
                  <View style={styles.textContainer}>
                    <View style={styles.tickerRow}>
                      <Text style={styles.ticker}>{ticker}</Text>
                      {stockPrices[ticker] && (
                        <Text style={styles.price}>${stockPrices[ticker].toFixed(2)}</Text>
                      )}
                    </View>
                    <Text style={styles.companyName}>
                      {companyProfiles[ticker]?.name || ticker}
                    </Text>
                    <Text style={styles.estimates}>
                      {nextEarnings[ticker]?.revenue || nextEarnings[ticker]?.eps ? (
                        <>
                          {nextEarnings[ticker].revenue && `Revenue Estimates: ${nextEarnings[ticker].revenue}`}
                          {nextEarnings[ticker].revenue && nextEarnings[ticker].eps && ', '}
                          {nextEarnings[ticker].eps && `EPS Estimates: ${nextEarnings[ticker].eps}`}
                          {nextEarnings[ticker].date && ` (Next earnings: ${formatEstimateDate(nextEarnings[ticker].date)})`}
                          {nextEarnings[ticker].hour && ` ${formatReleaseTime(nextEarnings[ticker].hour)}`}
                        </>
                      ) : 'Estimates unavailable'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f0f0',
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#e0f7fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  navButton: { 
    fontSize: 16, 
    color: '#007bff',
    fontWeight: 'bold',
  },
  weekRange: { 
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#007bff',
  },
  scrollView: { 
    flex: 1,
  },
  dayContainer: { 
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ccc',
  },
  date: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10,
  },
  companyCard: { 
    backgroundColor: '#e0f7fa', 
    padding: 10, 
    marginBottom: 5, 
    borderRadius: 5,
  },
  economicCard: { 
    backgroundColor: '#e0f7fa', 
    padding: 10, 
    marginBottom: 5, 
    borderRadius: 5,
  },
  ticker: { 
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#000',
  },
  companyName: { 
    fontSize: 14, 
    color: '#555',
  },
  estimates: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 5,
  },
  companyRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  logo: { 
    width: 40, 
    height: 40, 
    marginRight: 10,
  },
  logoPlaceholder: { 
    width: 40, 
    height: 40, 
    marginRight: 10, 
    backgroundColor: '#ccc', 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  logoPlaceholderText: { 
    fontSize: 18, 
    color: '#fff', 
    fontWeight: 'bold',
  },
  textContainer: { 
    flex: 1,
  },
  tickerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  price: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#32CD32', 
    marginLeft: 10,
  },
  noData: { 
    fontSize: 16, 
    color: '#888', 
    textAlign: 'center', 
    marginTop: 20,
  },
  missingContainer: { 
    padding: 10,
  },
  missingTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10,
  },
  refreshButton: { 
    alignItems: 'center', 
    padding: 10, 
    marginVertical: 10, 
    backgroundColor: '#007bff', 
    borderRadius: 5, 
    marginHorizontal: 20,
  },
  refreshText: { 
    fontSize: 16, 
    color: '#fff', 
    fontWeight: 'bold',
  },
  progressBar: { 
    marginVertical: 10,
  },
});

export default WeeklyScreen;