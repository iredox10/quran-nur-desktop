import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Surah from './pages/Surah';
import Page from './pages/Page';

import MemorizeIndex from './pages/MemorizeIndex';
import Memorization from './pages/Memorization';
import Library from './pages/Library';
import Progress from './pages/Progress';
import Planner from './pages/Planner';
import OfflineLibrary from './pages/OfflineLibrary';
import TajweedTooltip from './components/TajweedTooltip';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import Profile from './pages/Profile';
import FloatingPomodoro from './components/FloatingPomodoro';
import SaukaIndex from './pages/SaukaIndex';
import SaukaGroup from './pages/SaukaGroup';
import CloudSync from './components/CloudSync';

function App() {
  useEffect(() => {
    async function requestPersistentStorage() {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
          console.log('✅ Storage is already permanently locked.');
          return;
        }
        const granted = await navigator.storage.persist();
        console.log(granted
          ? '✅ Storage is now permanently locked! The OS will not delete offline data.'
          : '⚠️ Persistent storage not granted yet. Install the app for best offline experience.'
        );
      }
    }

    // If already running as installed PWA, request immediately
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone;
    if (isStandalone) {
      requestPersistentStorage();
    }

    // Also request right after the user installs the PWA
    const onInstalled = () => {
      console.log('🎉 App installed! Requesting persistent storage...');
      requestPersistentStorage();
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  return (
    <BrowserRouter>
      {/* Headless cloud sync — runs silently in the background on every page */}
      <CloudSync />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />

          <Route path="/memorize" element={<MemorizeIndex />} />
          <Route path="/memorize/:id" element={<Memorization />} />
          <Route path="/library" element={<Library />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/offline-library" element={<OfflineLibrary />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/sauka" element={<SaukaIndex />} />
          <Route path="/sauka/:groupId" element={<SaukaGroup />} />
          <Route path="/surah/:id" element={<Surah />} />
          <Route path="/page/:id" element={<Page />} />
        </Route>
      </Routes>
      <BottomNav />
      <FloatingPomodoro />
      <TajweedTooltip />
    </BrowserRouter>
  );
}

export default App;
