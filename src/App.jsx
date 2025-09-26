import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainDashboard from './pages/MainDashboard';
import InventoryListPage from './pages/InventoryListPage';
import DetailPage from './pages/DetailPage';
import GlobalStyle from './styles/GlobalStyle';

function App() {
  return (
    <>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainDashboard />} />
          <Route path="/inventory" element={<InventoryListPage />} />
          <Route path="/detail/:itemId" element={<DetailPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;