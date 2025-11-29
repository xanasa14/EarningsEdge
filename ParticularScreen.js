import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
const ParticularScreen = ({ route }) => {
  const { ticker = 'O' } = route.params || {}; // Default to 'O' if ticker is not provided
  const [todayDate, setTodayDate] = useState('');
  const [nextDate, setNextDate] = useState('N/A');
  const [epsEstimate, setEpsEstimate] = useState('N/A');
  const [hour, setHour] = useState('N/A'); // New state for hour
  const [error, setError] = useState('');

  // Finnhub API key (store securely in production, e.g., using react-native-dotenv)
  //const FINNHUB_API_KEY = 'co2qok1r01qp2simakvgco2qok1r01qp2simal00'; // Replace with your API key
  const FINNHUB_API_KEY = Constants.expoConfig?.extra?.finnhubApiKey;

  useEffect(() => {
    console.log(FINNHUB_API_KEY);
    // Calculate dates
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setDate(today.getDate() - 9 * 30); // 9 months ago
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setDate(today.getDate() + 6 * 30); // 6 months later

    // Format dates as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];
    setTodayDate(formatDate(today));

    // Fetch earnings calendar
    const getEarningsCalendar = async () => {
      try {
        const response = await axios.get(
          `https://finnhub.io/api/v1/calendar/earnings?from=${formatDate(
            threeMonthsAgo
          )}&to=${formatDate(threeMonthsLater)}&symbol=${ticker}&international=false&token=${FINNHUB_API_KEY}`
        );

        const earningsCalendar = response.data.earningsCalendar || [];

        // Sort by date
        earningsCalendar.sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );

        // Find the next date
        const todayDateObj = new Date(todayDate);
        let nextEarningsDate = null;
        let nextEpsEstimate = null;
        let nextHour = null;

        for (const item of earningsCalendar) {
          if (new Date(item.date) >= todayDateObj) {
            nextEarningsDate = item.date;
            nextEpsEstimate = item.epsEstimate;
            nextHour = item.hour;
            break;
          }
        }

        // Update state
        setNextDate(nextEarningsDate || 'N/A');
        setEpsEstimate(nextEpsEstimate !== null ? nextEpsEstimate : 'N/A');
        
        // Format hour for display
        if (nextHour) {
          if (nextHour.toLowerCase() == 'bmo') {
            setHour('Before Market Opens');
          } else if (nextHour.toLowerCase() == 'amc') {
            setHour('After Market Closes');
          } else {
            setHour(nextHour); // Fallback to raw value if unexpected
          }
        } else {
          setHour('N/A');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch earnings data');
        setNextDate('N/A');
        setEpsEstimate('N/A');
        setHour('N/A');
      }
    };

    getEarningsCalendar();
  }, [todayDate, ticker]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earnings Calendar for {ticker || 'Not Specified'}</Text>
      <Text style={styles.text}>Today's Date: {todayDate}</Text>
      <Text style={styles.text}>Next Earnings Date: {nextDate}</Text>
      <Text style={styles.text}>Earnings Release Time: {hour}</Text>
      <Text style={styles.text}>EPS Estimate: {epsEstimate}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
  },
  error: {
    fontSize: 16,
    color: 'red',
    marginTop: 10,
  },
});

export default ParticularScreen;