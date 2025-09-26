import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import MainDashboard from './pages/MainDashboard';
import InventoryListPage from './pages/InventoryListPage';
// import DetailPage from './pages/DetailPage';
// <Route path="/detail/:itemId" element={<DetailPage />} />

import GlobalStyle from './styles/GlobalStyle';

function App() {
  return (
    <>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          {/* DashboardLayout을 Route의 element로 설정하고 그 안에 다른 페이지들을 넣으면,
            이 모든 페이지들이 DashboardLayout(헤더, 네비게이션)을 공통으로 가지게 됩니다.
          */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<MainDashboard />} />
            <Route path="/inventory" element={<InventoryListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
