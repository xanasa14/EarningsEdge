import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WeeklyScreen from './WeeklyScreen';
import ParticularScreen from './ParticularScreen';
import CNNFearGreedMeter from './CNNFearGreedMeter';
import ExampleVSG from './ExampleVSG';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Weekly">
        <Stack.Screen name="Weekly" component={WeeklyScreen} />
        <Stack.Screen name="Particular" component={ParticularScreen} />
        <Stack.Screen name="CNNFearGreedMeter" component={CNNFearGreedMeter} />
        <Stack.Screen name="ExampleVSG" component={ExampleVSG} />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;