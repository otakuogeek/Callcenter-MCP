import { StatusBar } from 'expo-status-bar';
import { PortalProvider } from './src/context/PortalContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <PortalProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </PortalProvider>
  );
}
