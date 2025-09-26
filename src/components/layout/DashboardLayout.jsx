import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';

// --- 아이콘 컴포넌트들 ---
const SearchIcon = () => <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
const ReportIcon = () => <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>;

// --- 1. 헤더 영역 ---
const Header = () => (
    <header className="bg-[#2F6F59] p-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-2xl font-extrabold text-white">Yak-Sok</h1>
        <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                <input type="text" placeholder="검색 (제품명 / 코드)" className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white" />
            </div>
        </div>
        <button className="bg-white/90 text-gray-800 font-bold px-4 py-2 rounded-lg hover:bg-white transition-colors flex items-center text-sm">
            <ReportIcon /> CSV / AI 리포트
        </button>
    </header>
);

// --- 2. 네비게이션 탭 ---
const Navigation = () => {
    const location = useLocation();
    const pathname = location.pathname;

    return (
        <nav className="flex space-x-2 px-4 border-b bg-white sticky top-[64px] z-10">
            <Link to="/" className={`px-3 py-3 font-bold text-sm ${pathname === '/' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>대시보드</Link>
            <Link to="/inventory" className={`px-3 py-3 font-bold text-sm ${pathname === '/inventory' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>재고 리스트</Link>
            <Link to="/ai-report" className={`px-3 py-3 font-bold text-sm ${pathname === '/ai-report' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>AI 리포트</Link>
            <Link to="/map" className={`px-3 py-3 font-bold text-sm ${pathname === '/map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>재고 연계</Link>
        </nav>
    );
};


// --- 최종 레이아웃 컴포넌트 ---
const DashboardLayout = () => {
    return (
        <div className="bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <Header />
                <Navigation />
                {/* 이 자리에 각 페이지의 실제 내용이 렌더링됩니다. */}
                <Outlet />
            </div>
        </div>
    );
};

export default DashboardLayout;