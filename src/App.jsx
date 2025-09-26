import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainDashboard from './pages/MainDashboard';
import DetailPage from './pages/DetailPage';
import GlobalStyle from './styles/GlobalStyle';

function App() {
  return (
    <>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainDashboard />} />
          <Route path="/detail/:itemId" element={<DetailPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;