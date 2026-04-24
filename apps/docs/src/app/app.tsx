// Uncomment this line to use CSS modules
import styles from './app.module.css';

import { V2 } from '@lunaterra/math';

import { RouterPage } from '../pages/Router';
import { NavPanel } from '../navPanel';
import { Header } from '../components/Header/Header';
import { Footer } from '../components/Footer/Footer';
import { NavGuide } from '../components/NavGuide/NavGuide';
import { NavGuideProvider } from '../context/NavGuideContext';

console.log('V2 instance ', new V2(1, 2));

export function App() {
  return (
    <>
      <Header />
      <div className={styles.app}>
        <NavPanel />
        <NavGuideProvider>
          <main className={styles.mainContainer}>
            <RouterPage />
          </main>
          <NavGuide />
        </NavGuideProvider>
      </div>
      <Footer />
    </>
  );
}

export default App;

