import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import PropTypes from 'prop-types';

const SpeedGauge = ({
  apiUrl = 'https://api.alternative.me/fng/',
  gaugeSizeFactor = 0.99,
  strokeWidth = 45,
  maxValue = 100,
  animationDuration = 2000,
  onError = () => {},
  onDataFetched = () => {},
  customStyles = {},
}) => {
  // Get screen width to make the gauge responsive
  const { width } = Dimensions.get('window');
  const gaugeSize = width * gaugeSizeFactor;
  const speedAnim = useRef(new Animated.Value(0)).current;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half-circle circumference
  const [needleCoords, setNeedleCoords] = useState({ needleX: 0, needleY: 0 });
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data from the provided API URL
    fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (compatible; ReactNative)',
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        const cleanedText = text.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        try {
          const data = JSON.parse(cleanedText);
          const fetchedScore = parseInt(data.data[0].value);
          const roundedScore = Math.round(fetchedScore);
          setSpeed(roundedScore);
          onDataFetched(roundedScore);
        } catch (err) {
          throw err;
        }
      })
      .catch(err => {
        //setSpeed(25);
        //onDataFetched(25);
        console.error('Error fetching data:', err);
        setError('Failed to fetch or parse data');
        setSpeed(0);
        onError(err);
      });
  }, [apiUrl, onDataFetched, onError]);

  useEffect(() => {
    // Listener to compute needle coordinates
    const listenerId = speedAnim.addListener(({ value }) => {
      const angle = -180 + (value / maxValue) * 180;
      const radians = angle * (Math.PI / 180);
      const needleX = radius * Math.cos(radians);
      const needleY = radius * Math.sin(radians);
      setNeedleCoords({ needleX, needleY });
    });

    // Animate speed
    Animated.timing(speedAnim, {
      toValue: speed,
      duration: animationDuration,
      useNativeDriver: false,
    }).start();

    return () => speedAnim.removeListener(listenerId);
  }, [speedAnim, speed, maxValue, animationDuration]);

  // Create semi-circular arc path
  const arcPath = `M${radius},${radius * 2} A${radius},${radius} 0 0 1 ${radius},0`;

  // Needle and dot calculations
  const angle = -180 + (speed / maxValue) * 180;
  const radians = angle * (Math.PI / 180);
  const needleLength = radius;
  const needleX = needleLength * Math.cos(radians);
  const needleY = needleLength * Math.sin(radians);
  const dotX = radius * Math.cos(radians);
  const dotY = radius * Math.sin(radians);

  // Section angles for labels
  const sectionAngles = [
    ((0 + 19) / 2 / 100) * 180 - 180,
    ((20 + 39) / 2 / 100) * 180 - 180,
    ((40 + 59) / 2 / 100) * 180 - 180,
    ((60 + 79) / 2 / 100) * 180 - 180,
    ((80 + 100) / 2 / 100) * 180 - 180,
  ].map(a => a * (Math.PI / 180));

  // Determine progress color
  const progressColor = speed < 20 ? '#FF0000' : speed < 40 ? '#FF3333' : speed < 60 ? '#FFFF00' : speed < 80 ? '#90EE90' : '#00FF00';

  return (
    <View style={[styles.container, customStyles.container]}>
      <Svg width={gaugeSize} height={gaugeSize / 2}>
        {/* Background Arc */}
        <Circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={radius}
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}, ${circumference}`}
          rotation={180}
          origin={`${gaugeSize / 2}, ${gaugeSize / 2}`}
        />
        {/* Foreground Arc */}
        <Circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${(speed / maxValue) * circumference}, ${circumference}`}
          rotation={180}
          origin={`${gaugeSize / 2}, ${gaugeSize / 2}`}
        />
        {/* Labels */}
        {[' Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed '].map((label, index) => {
          const rad = sectionAngles[index];
          const labelX = (gaugeSize / 2) + (radius + 10) * Math.cos(rad);
          const labelY = (gaugeSize / 2) + (radius + 10) * Math.sin(rad);
          const textRotation = index < 2 ? 90 - Math.abs(rad * (180 / Math.PI)) : (index < 4 ? 1 : 1) * (rad * (180 / Math.PI) + 90);

          const isExtreme = index === 0 || index === 4;
          const firstLine = isExtreme ? 'Extreme' : label;
          const secondLine = isExtreme ? (index === 0 ? 'Fear' : 'Greed') : '';

          const lineSpacing = 12;
          let xOffset = 0;
          let yOffset = lineSpacing;

          if (isExtreme) {
            if (index === 0) {
              xOffset = 9;
              yOffset = 6;
            } else if (index === 4) {
              xOffset = -9;
              yOffset = 6;
            }
          }

          return (
            <G key={index}>
              <SvgText
                x={labelX}
                y={labelY}
                fill="#333"
                fontSize="9"
                textAnchor="middle"
                alignmentBaseline="before-edge"
                fontWeight="bold"
                rotation={textRotation}
                origin={`${labelX}, ${labelY}`}
              >
                {firstLine}
              </SvgText>
              {isExtreme && (
                <SvgText
                  x={labelX + xOffset}
                  y={labelY + yOffset}
                  fill="#333"
                  fontSize="9"
                  textAnchor="middle"
                  alignmentBaseline="before-edge"
                  fontWeight="bold"
                  rotation={textRotation}
                  origin={`${labelX + xOffset}, ${labelY + yOffset}`}
                >
                  {secondLine}
                </SvgText>
              )}
            </G>
          );
        })}
        {/* Needle */}
        <Line
          x1={gaugeSize / 2}
          y1={gaugeSize / 2}
          x2={gaugeSize / 2 + needleCoords.needleX}
          y2={gaugeSize / 2 + needleCoords.needleY}
          stroke="#000000"
          strokeWidth={3}
          strokeLinecap="butt"
        />
      </Svg>
      <Text style={[styles.speedText, customStyles.speedText]}>{error ? 'Error' : `${speed} Index`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#f5f5f5',},
  speedText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
});

SpeedGauge.propTypes = {
  apiUrl: PropTypes.string,
  gaugeSizeFactor: PropTypes.number,
  strokeWidth: PropTypes.number,
  maxValue: PropTypes.number,
  animationDuration: PropTypes.number,
  onError: PropTypes.func,
  onDataFetched: PropTypes.func,
  customStyles: PropTypes.shape({
    container: PropTypes.object,
    speedText: PropTypes.object,
  }),
};

export default SpeedGauge;