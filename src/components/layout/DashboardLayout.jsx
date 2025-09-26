import React, { useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from "../../assets/logo.png";

// --- 아이콘 컴포넌트 ---
const SearchIcon = () => (
    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
);
const ReportIcon = () => (
    <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
);

// --- 1. Header ---
const Header = ({ setReport }) => {
    const [query, setQuery] = useState('');
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            navigate(`/detail/${query.trim()}`);
            setQuery('');
        }
    };

    const handleCsvButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('csv/reports/generate-from-csv', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                alert(`업로드 실패: ${text}`);
                return;
            }

            const data = await res.json();
            setReport(data); // 부모 상태로 전달
        } catch (error) {
            console.error(error);
            alert('서버 요청 중 오류 발생');
        }
    };

    return (
        <header className="bg-[#2F6F59] p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center">
                <img src={logo} alt="Yak-Sok Logo" className="w-12 h-12 mr-1" />
                <h1 className="text-2xl font-extrabold text-white">Yak-Sok</h1>
            </div>

            <div className="flex-1 max-w-xl mx-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="품목 ID로 검색 후 Enter..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                    />
                </div>
            </div>

            <div className="relative">
                <button
                    onClick={handleCsvButtonClick}
                    className="bg-white/90 text-gray-800 font-bold px-4 py-2 rounded-lg hover:bg-white transition-colors flex items-center text-sm"
                >
                    <ReportIcon /> CSV / AI 리포트
                </button>
                <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>
        </header>
    );
};

// --- 2. Navigation ---
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

// --- 3. DashboardLayout ---
const DashboardLayout = () => {
    const [report, setReport] = useState(null); // 모달 상태

    return (
        <div className="bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <Header setReport={setReport} />
                <Navigation />
                <Outlet />

                {/* 모달 */}
                {report && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-[850px] max-h-[650px] overflow-auto relative p-8 border border-gray-200">

                            {/* 닫기 버튼 */}
                            <button
                                onClick={() => setReport(null)}
                                className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 text-3xl font-bold transition-colors"
                            >
                                ✕
                            </button>

                            {/* 제목 */}
                            <h2 className="text-3xl font-bold text-gray-800 mb-6">AI 리포트</h2>

                            {/* 내용 영역 */}
                            <div className="prose prose-sm md:prose-base text-gray-700">
                                {/* report_text를 Markdown 스타일로 표시 */}
                                {report.report_text.split('\n').map((line, idx) => {
                                    line = line.trim();
                                    if (!line) return <br key={idx} />;

                                    // 제목 처리 (##, ### 등)
                                    if (line.startsWith('### ')) {
                                        return <h3 key={idx} className="text-lg font-semibold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                                    } else if (line.startsWith('## ')) {
                                        return <h2 key={idx} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h2>;
                                    } else if (line.startsWith('# ')) {
                                        return <h1 key={idx} className="text-2xl font-extrabold mt-6 mb-3">{line.replace('# ', '')}</h1>;
                                    }

                                    // 강조 처리 (**) → 굵게
                                    const parts = line.split(/\*\*(.+?)\*\*/g);
                                    return (
                                        <p key={idx} className="mb-2">
                                            {parts.map((part, i) =>
                                                i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
                                            )}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DashboardLayout;
