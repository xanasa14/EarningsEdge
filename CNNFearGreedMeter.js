import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G } from 'react-native-svg';

// Create an animated version of the Line component
const AnimatedLine = Animated.createAnimatedComponent(Line);

const SpeedGauge = () => {
  // Get screen width to make the gauge responsive
  const { width } = Dimensions.get('window');
  const gaugeSize = width * 0.75; // 80% of screen width for wider gauge
  const speedAnim = useRef(new Animated.Value(0)).current;
  const strokeWidth = 45; // Base thickness for reference
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half-circle circumference
  const max = 100; // Maximum speed value
  const [needleCoords, setNeedleCoords] = useState({ needleX: 0, needleY: 0 });
  const [speed, setSpeed] = useState(0); // State for fetched speed
  const [error, setError] = useState(null); // State for API errors

  useEffect(() => {
    // Fetch Fear and Greed Index score
    fetch('https://api.alternative.me/fng/', {
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
        console.log('Response headers:', response.headers);
        return response.text();
      })
      .then(text => {
        console.log('Raw response:', text.substring(0, 200));
        const cleanedText = text.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        try {
          const data = JSON.parse(cleanedText);
          const fetchedScore = parseInt(data.data[0].value);
          const roundedScore = Math.round(fetchedScore);
          setSpeed(roundedScore);
        } catch (err) {
          console.error('JSON Parse Error:', err, 'Cleaned text:', cleanedText.substring(0, 200));
          throw err;
        }
      })
      .catch(err => {
        console.error('Error fetching Fear and Greed Index:', err);
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

  // Map speed (0-100) to angle (-90 to +90 degrees) for left-to-right top half
  var angle = -180 + (speed / max) * 180;
  const radians = angle * (Math.PI / 180);
  const needleLength = radius; // Extend to the arc
  const needleX = needleLength * Math.cos(radians);
  const needleY = needleLength * Math.sin(radians); // Use raw sine for direction
  // Calculate dot position on the arc
  const dotX = radius * Math.cos(radians);
  const dotY = radius * Math.sin(radians); // Use raw sine for consistency

  // Midpoint angles for each section (mapped to -90° to +90° with -180° adjustment)
  const sectionAngles = [
    ((0 + 19) / 2 / 100) * 180 - 180,  // 9.5° - 180 = -170.5° for 0-19
    ((20 + 39) / 2 / 100) * 180 - 180, // 29.5° - 180 = -150.5° for 20-39
    ((40 + 59) / 2 / 100) * 180 - 180, // 49.5° - 180 = -130.5° for 40-59
    ((60 + 79) / 2 / 100) * 180 - 180, // 69.5° - 180 = -110.5° for 60-79
    ((80 + 100) / 2 / 100) * 180 - 180 // 90° - 180 = -90° for 80-100
  ].map(a => a * (Math.PI / 180)); // Convert to radians

  // Determine progress color based on speed
  const progressColor = speed < 20 ? '#FF0000' : speed < 40 ? '#FF3333' : speed < 60 ? '#FFFF00' : speed < 80 ? '#90EE90' : '#00FF00';

  return (
    <View style={styles.container}>
      <Svg width={gaugeSize} height={gaugeSize / 2}>
        {/* Background Arc (full top semicircle) */}
        <Circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={radius}
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}, ${circumference}`}
          rotation={180} // Start at -90° (left) and cover top semicircle
          origin={`${gaugeSize / 2}, ${gaugeSize / 2}`}
        />

        {/* Foreground Arc (progress) */}
        <Circle
          cx={gaugeSize / 2}
          cy={gaugeSize / 2}
          r={radius}
          stroke={progressColor} // Dynamic color based on speed
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${(speed / max) * circumference}, ${circumference}`}
          rotation={180}
          origin={`${gaugeSize / 2}, ${gaugeSize / 2}`}
        />
        {/* Labels for sections */}
        {['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'].map((label, index) => {
          const rad = sectionAngles[index];
          const labelX = (gaugeSize / 2) + (radius + 10) * Math.cos(rad); // Outside the arc
          const labelY = (gaugeSize / 2) + (radius + 10) * Math.sin(rad);
          const textRotation = (index < 2 ? 90 - Math.abs(rad * (180 / Math.PI)) : (index < 4 ? 1 : 1) * (rad * (180 / Math.PI) + 90)); // Adjusted for first two

          // Split labels for "Extreme Fear" and "Extreme Greed"
          const isExtreme = index === 0 || index === 4;
          const firstLine = isExtreme ? 'Extreme' : label;
          const secondLine = isExtreme ? (index === 0 ? 'Fear' : 'Greed') : '';

          // Dynamic offsets for second line, tailored for each extreme label
          const lineSpacing = 12; // Base spacing
          let xOffset = 0;
          let yOffset = lineSpacing;

          if (isExtreme) {
            if (index === 0) {
              // "Extreme Fear" (left side of gauge)
              xOffset = 9;
              yOffset = 6;
            } else if (index === 4) {
              // "Extreme Greed" (right side of gauge)
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
                fontSize="12"
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
                  fontSize="12"
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

        {/* Needle (black, rendered last to appear on top) */}
        <Line
          x1={gaugeSize / 2}
          y1={gaugeSize / 2}
          x2={gaugeSize / 2 + needleCoords.needleX}
          y2={gaugeSize / 2 + needleCoords.needleY} // Adjusted for top half
          stroke="#000000"
          strokeWidth={3}
          strokeLinecap="butt"
        />
      </Svg>
      <Text style={styles.speedText}>{error ? 'Error' : `${speed} Index`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  speedText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
});

export default SpeedGauge;