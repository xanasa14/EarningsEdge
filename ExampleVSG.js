import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import axios from 'axios';
// Create an animated version of the Line component
const AnimatedLine = Animated.createAnimatedComponent(Line);

const ExampleVSG = () => {
  // Animation value for speed
  const speedAnim = useRef(new Animated.Value(0)).current;
  const gaugeSize = 186; // SVG size
  const radius = gaugeSize / 2; // Radius for arc and needle
  const max = 100; // Maximum speed value
  const [needleCoords, setNeedleCoords] = useState({ needleX: 0, needleY: 0 });
  const [speed, setSpeed] = useState(0); // State for fetched speed
  const [error, setError] = useState(null); // State for API errors

  

useEffect(() => {
  axios.get('https://api.alternative.me/fng/', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; ReactNative)',
    },
  })
    .then(response => {
      console.log('Axios response:', JSON.stringify(response.data).substring(0, 200));
      const fetchedScore = parseInt(response.data.data[0].value);
      const roundedScore = Math.round(fetchedScore);
      setSpeed(roundedScore);
    })
    .catch(err => {
      console.error('Axios Error:', err.response ? err.response.data : err.message);
      setError('Failed to fetch or parse data');
      setSpeed(0);
    });
}, []);

  useEffect(() => {
    // Listener to compute needle coordinates based on speed
    const listenerId = speedAnim.addListener(({ value }) => {
      const angle = -180 + (value / max) * 180; // Map 0-100 to -180 to 0 degrees
      const radians = angle * (Math.PI / 180);
      const needleX = radius * Math.cos(radians);
      const needleY = radius * Math.sin(radians);
      setNeedleCoords({ needleX, needleY });
    });

    // Animate speed from 0 to fetched speed over 2 seconds
    Animated.timing(speedAnim, {
      toValue: speed,
      duration: 2000,
      useNativeDriver: false, // SVG animations don't support native driver
    }).start();

    // Cleanup listener
    return () => speedAnim.removeListener(listenerId);
  }, [speedAnim, speed]);

  // Create semi-circular arc path (from -180 to 0 degrees)
  const arcPath = `M${radius},${radius * 2} A${radius},${radius} 0 0 1 ${radius},0`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {error ? 'Error Loading Gauge' : `Fear & Greed Gauge (0 to ${speed})`}
      </Text>
      <Svg height={gaugeSize} width={gaugeSize}>
        {/* Background circle */}
        <Circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={radius}
          fill="lightgray"
        />
        {/* Semi-circular gauge arc */}
        <Path
          d={arcPath}
          stroke="gray"
          strokeWidth="10"
          fill="none"
        />
        {/* Animated needle */}
        <Line
          x1={gaugeSize / 2}
          y1={gaugeSize / 2}
          x2={gaugeSize / 2 + needleCoords.needleX}
          y2={gaugeSize / 2 + needleCoords.needleY}
          stroke="black"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.percentage}>
        {error ? 'Error' : Math.round(speedAnim.__getValue())}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  percentage: {
    fontSize: 18,
    marginTop: 10,
  },
});

export default ExampleVSG;