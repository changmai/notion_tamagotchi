import { useState, useEffect } from 'react';
import CharacterCard from './CharacterCard'; // 우리가 만든 캐릭터 카드 컴포넌트

// Firebase SDK import
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth"; // 'User' 타입을 타입 전용으로 불러옵니다.
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc,
    onSnapshot,
    DocumentSnapshot,
    Timestamp
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// --- ⚠️ 중요: 여기에 본인의 Firebase 설정 객체를 붙여넣으세요 ---
const firebaseConfig = {
    apiKey: "AIzaSyDZZMSJG4sh9Vw-T7pjMztC2swkOg1i8os",
    authDomain: "notion-tamagotchi.firebaseapp.com",
    projectId: "notion-tamagotchi",
    storageBucket: "notion-tamagotchi.appspot.com",
    messagingSenderId: "128399204318",
    appId: "1:128399204318:web:197bf0d12b437b910f474f",
    measurementId: "G-02V3VDK4Q6"
};

// --- Firebase 서비스 초기화 ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");
const provider = new GoogleAuthProvider();

// --- 레벨 계산 로직 (From Reference) ---
const MAX_LEVEL = 10;
const XP_FOR_REBIRTH_AT_MAX_LEVEL = 500;
const CUMULATIVE_XP_FOR_LEVEL = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

const calculateLevelData = (currentCycleXp: number) => {
    let level = 1;
    for (let i = CUMULATIVE_XP_FOR_LEVEL.length - 1; i >= 0; i--) {
        if (currentCycleXp >= CUMULATIVE_XP_FOR_LEVEL[i]) {
            level = i + 1;
            break;
        }
    }

    if (level >= MAX_LEVEL) {
        const xpAtMaxLevelStart = CUMULATIVE_XP_FOR_LEVEL[MAX_LEVEL - 1];
        const xpIntoMaxLevel = currentCycleXp - xpAtMaxLevelStart;
        const progress = (xpIntoMaxLevel / XP_FOR_REBIRTH_AT_MAX_LEVEL) * 100;
        return { 
            level: MAX_LEVEL, 
            progress: Math.min(100, progress), 
            xpInCurrentLevel: xpIntoMaxLevel, 
            xpForNextLevel: XP_FOR_REBIRTH_AT_MAX_LEVEL 
        };
    }

    const xpAtLevelStart = CUMULATIVE_XP_FOR_LEVEL[level - 1];
    const xpForNextLevelTotal = CUMULATIVE_XP_FOR_LEVEL[level];
    const xpNeededForLevel = xpForNextLevelTotal - xpAtLevelStart;
    const xpInCurrentLevel = currentCycleXp - xpAtLevelStart;
    const progress = (xpInCurrentLevel / xpNeededForLevel) * 100;
    return { 
        level, 
        progress, 
        xpInCurrentLevel, 
        xpForNextLevel: xpNeededForLevel 
    };
};

// --- 타입 정의 ---
interface TamagotchiState {
    totalExp: number;
    rebirthCount: number;
    pageCount: number;
    lastUpdated?: Timestamp;
}
interface NotionSettings {
    selectedDbId: string;
    propertyName: string;
}
interface Database {
    id: string;
    title: string;
}
interface HealthStatus {
    icon: string;
    status: string;
    message: string;
    color: string;
    lastUpdateText: string;
}

// --- 메인 앱 컴포넌트 ---
function App() {
    // --- 상태 관리 (State) ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [publicUserId, setPublicUserId] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [tamagotchiState, setTamagotchiState] = useState<TamagotchiState>({ totalExp: 0, rebirthCount: 0, pageCount: 0 });
    const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
    const [notionToken, setNotionToken] = useState<any>(null);
    const [databases, setDatabases] = useState<Database[]>([]);
    const [properties, setProperties] = useState<string[]>([]);
    const [settings, setSettings] = useState<NotionSettings>({ selectedDbId: '', propertyName: '' });
    const [loadingStates, setLoadingStates] = useState({ notion: false, db: false, prop: false, save: false, refresh: false });
    const [copyButtonText, setCopyButtonText] = useState("복사");

    // --- 핸들러 함수들 ---
    const handleSignIn = () => signInWithPopup(auth, provider).catch((err: any) => console.error(err));
    const handleSignOut = () => signOut(auth);
    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    const handleNotionConnect = () => {
        const NOTION_CLIENT_ID = "259d872b-594c-80c7-9fd9-0037bc5be4d1";
        const NOTION_REDIRECT_URI = window.location.origin;
        const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
        window.location.href = authUrl;
    };

    const handleSaveSettings = async () => {
        if (!settings.selectedDbId || !settings.propertyName || !currentUser) return;
        setLoadingStates(prev => ({ ...prev, save: true }));
        try {
            await setDoc(doc(db, "users", currentUser.uid, "settings", "config"), settings);
            const initializeExperience = httpsCallable(functions, 'initializeExperience');
            await initializeExperience({ databaseId: settings.selectedDbId, propertyName: settings.propertyName });
            alert("설정이 저장되었습니다!");
            setSidebarOpen(false);
        } catch (error) {
            console.error(error);
            alert("설정 저장에 실패했습니다.");
        } finally {
            setLoadingStates(prev => ({ ...prev, save: false }));
        }
    };

    const handleRefresh = async () => {
        if (!currentUser) return;
        setLoadingStates(prev => ({ ...prev, refresh: true }));
        try {
            const settingsSnap = await getDoc(doc(db, "users", currentUser.uid, "settings", "config"));
            if (settingsSnap.exists()) {
                const { selectedDbId, propertyName } = settingsSnap.data();
                const initializeExperience = httpsCallable(functions, 'initializeExperience');
                await initializeExperience({ databaseId: selectedDbId, propertyName });
                alert("데이터를 새로고침했습니다!");
            } else {
                alert("먼저 설정을 완료해주세요.");
            }
        } catch (error) {
            alert("새로고침 중 오류가 발생했습니다.");
        } finally {
            setLoadingStates(prev => ({ ...prev, refresh: false }));
        }
    };

    const handleShare = async () => {
        if (!currentUser) return;
        const publicUrl = `${window.location.origin}?uid=${currentUser.uid}`;
        const shareData = { title: '나의 Notion 펫 구경하기!', text: 'Notion으로 키우는 제 펫을 구경해보세요!', url: publicUrl };
        
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('Web Share Canceled:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(publicUrl);
                alert("공유 링크가 클립보드에 복사되었습니다!");
            } catch (copyError) {
                console.error("클립보드 복사 실패:", copyError);
                alert("공유에 실패했습니다.");
            }
        }
    };

    const handleCopyEmbedLink = (e: React.MouseEvent<HTMLButtonElement>) => {
        const input = e.currentTarget.previousSibling as HTMLInputElement;
        navigator.clipboard.writeText(input.value).then(() => {
            setCopyButtonText("완료!");
            setTimeout(() => setCopyButtonText("복사"), 2000);
        }).catch(() => {
            alert("복사에 실패했습니다.");
        });
    };
    
    // --- 데이터 로딩 및 동기화 (Effects) ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const uidFromUrl = urlParams.get('uid');
        if (uidFromUrl) {
            setPublicUserId(uidFromUrl);
        } else {
            const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
                setCurrentUser(user);
                setIsLoading(false);
            });
            return unsubscribe;
        }
    }, []);

    useEffect(() => {
        const handleNotionCallback = async (code: string, user: User) => {
            setLoadingStates(prev => ({ ...prev, notion: true }));
            window.history.replaceState({}, document.title, window.location.pathname);
            try {
                const exchangeCodeForToken = httpsCallable(functions, 'exchangeCodeForToken');
                const result = await exchangeCodeForToken({ code, redirectUri: window.location.origin });
                await setDoc(doc(db, "users", user.uid, "notion", "token"), result.data);
                setNotionToken(result.data);
            } catch (err) {
                console.error(err);
                alert("Notion 연동에 실패했습니다.");
            } finally {
                setLoadingStates(prev => ({ ...prev, notion: false }));
            }
        };

        const urlParams = new URLSearchParams(window.location.search);
        const notionCode = urlParams.get('code');
        if (notionCode && currentUser) {
            handleNotionCallback(notionCode, currentUser);
        }
    }, [currentUser]);

    useEffect(() => {
        const userIdToFetch = publicUserId || currentUser?.uid;
        if (!userIdToFetch) {
            if (!publicUserId) setIsLoading(false);
            return;
        }
        
        setIsLoading(true);

        if (!publicUserId && currentUser) {
            const tokenRef = doc(db, "users", currentUser.uid, "notion", "token");
            getDoc(tokenRef).then((snap: DocumentSnapshot) => snap.exists() && setNotionToken(snap.data()));

            const settingsRef = doc(db, "users", currentUser.uid, "settings", "config");
            getDoc(settingsRef).then((snap: DocumentSnapshot) => snap.exists() && setSettings(snap.data() as NotionSettings));
        }
        
        const stateRef = doc(db, "users", userIdToFetch, "tamagotchi", "state");
        const unsubscribe = onSnapshot(stateRef, 
            (docSnap: DocumentSnapshot) => {
                if (docSnap.exists()) {
                    setTamagotchiState(docSnap.data() as TamagotchiState);
                } else if (publicUserId) {
                    // 공개 ID가 있는데 데이터가 없는 경우
                    alert("해당 사용자의 캐릭터 정보를 찾을 수 없습니다.");
                }
                setIsLoading(false);
            },
            (error) => {
                console.error("데이터 로딩 실패:", error);
                setIsLoading(false);
                alert("캐릭터 정보를 불러오는 데 실패했습니다. Firestore 권한을 확인해주세요.");
            }
        );

        return () => unsubscribe();
    }, [currentUser, publicUserId]);

    useEffect(() => {
        if (notionToken) {
            const loadDatabases = async () => {
                setLoadingStates(prev => ({ ...prev, db: true }));
                try {
                    const getNotionDatabases = httpsCallable(functions, 'getNotionDatabases');
                    const result = await getNotionDatabases();
                    setDatabases((result.data as any).databases);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoadingStates(prev => ({ ...prev, db: false }));
                }
            };
            loadDatabases();
        }
    }, [notionToken]);
    
    useEffect(() => {
        if (settings.selectedDbId) {
            const loadProperties = async () => {
                setLoadingStates(prev => ({ ...prev, prop: true }));
                setProperties([]);
                try {
                    const getDatabaseProperties = httpsCallable(functions, 'getDatabaseProperties');
                    const result = await getDatabaseProperties({ databaseId: settings.selectedDbId });
                    setProperties((result.data as any).properties);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoadingStates(prev => ({ ...prev, prop: false }));
                }
            };
            loadProperties();
        }
    }, [settings.selectedDbId]);

    useEffect(() => {
        if (tamagotchiState.lastUpdated) {
            const lastUpdateDate = tamagotchiState.lastUpdated.toDate();
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));
            
            let newHealthStatus: HealthStatus;

            if (diffDays < 2) {
                newHealthStatus = { icon: '💚', status: '활발함', message: '다마고치가 건강해요!', color: 'text-green-600', lastUpdateText: '방금 전' };
            } else if (diffDays <= 7) {
                newHealthStatus = { icon: '💛', status: '주의', message: '조금 외로워 보여요.', color: 'text-yellow-600', lastUpdateText: `${diffDays}일 전` };
            } else {
                newHealthStatus = { icon: '💔', status: '아픔', message: '오랫동안 돌보지 않았어요...', color: 'text-red-600', lastUpdateText: `${diffDays}일 전` };
            }
            setHealthStatus(newHealthStatus);
        }
    }, [tamagotchiState.lastUpdated]);

    // --- 렌더링을 위한 데이터 계산 ---
    const { level, progress, xpInCurrentLevel, xpForNextLevel } = calculateLevelData(tamagotchiState.totalExp);
    
    if (isLoading) {
        return <div className="bg-slate-900 min-h-screen flex items-center justify-center text-white" style={{fontFamily: "'Jua', sans-serif"}}>캐릭터를 불러오는 중...</div>;
    }
    
    if (publicUserId) {
        return (
            <div className="bg-slate-100 min-h-screen" style={{fontFamily: "'Jua', sans-serif"}}>
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-sm mx-auto">
                        <CharacterCard 
                            level={level}
                            rebirthCount={tamagotchiState.rebirthCount}
                            progress={progress}
                            xpInCurrentLevel={xpInCurrentLevel}
                            xpForNextLevel={xpForNextLevel}
                            totalExp={tamagotchiState.totalExp}
                        />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-100 min-h-screen" style={{fontFamily: "'Jua', sans-serif"}}>
             <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
                .hamburger-line { transition: all 0.3s ease; transform-origin: center; }
                .hamburger-open .hamburger-line:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
                .hamburger-open .hamburger-line:nth-child(2) { opacity: 0; }
                .hamburger-open .hamburger-line:nth-child(3) { transform: rotate(-45deg) translate(7px, -6px); }
                .sidebar { transform: translateX(-100%); transition: transform 0.3s ease; }
                .sidebar.open { transform: translateX(0); }
                .glass-effect { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.3); border-radius: 2px; }
                .btn-primary { background-color: #111827; color: white; transition: all 0.2s ease; }
                .btn-primary:hover { background-color: #374151; transform: translateY(-2px); }
                .btn-success { background-color: #16a34a; color: white; transition: all 0.2s ease; }
                .btn-success:hover { background-color: #15803d; transform: translateY(-2px); }
            `}</style>
            
            <button id="hamburgerButton" onClick={toggleSidebar} className={`fixed top-6 left-6 z-50 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 hover:bg-white hover:scale-105 ${isSidebarOpen ? 'hamburger-open' : ''}`}>
                <div className="hamburger-line w-6 h-0.5 bg-slate-800 rounded-full"></div>
                <div className="hamburger-line w-6 h-0.5 bg-slate-800 rounded-full"></div>
                <div className="hamburger-line w-6 h-0.5 bg-slate-800 rounded-full"></div>
            </button>
            <div id="sidebarOverlay" onClick={toggleSidebar} className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>
            <div id="sidebar" className={`sidebar fixed left-0 top-0 h-full w-80 bg-slate-50 border-r border-slate-200 z-50 shadow-2xl ${isSidebarOpen ? 'open' : ''}`}>
                <div className="p-6 h-full flex flex-col custom-scrollbar overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="text-3xl">🥚</div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">설정</h2>
                            </div>
                        </div>
                        <button onClick={toggleSidebar} className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center transition">
                            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div className="mb-8">
                        {currentUser ? (
                            <div className="text-center">
                                <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-3 flex items-center justify-center"><span className="text-white font-bold text-xl">{currentUser.displayName?.charAt(0).toUpperCase()}</span></div>
                                <p className="font-semibold text-slate-800 mb-1 text-sm">{currentUser.displayName}</p>
                                <button onClick={handleSignOut} className="text-slate-500 hover:text-red-500 text-xs transition">로그아웃</button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-3 flex items-center justify-center"><svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg></div>
                                <p className="text-slate-600 mb-4 text-xs">로그인이 필요합니다</p>
                                <button onClick={handleSignIn} className="btn-primary font-semibold py-2 px-4 rounded-lg w-full text-sm">구글로 로그인</button>
                            </div>
                        )}
                    </div>
                    
                    {currentUser && (
                         <div className="flex-1 space-y-4">
                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <h3 className="font-semibold text-slate-700 text-sm mb-3">1. Notion 연동</h3>
                                <button onClick={handleNotionConnect} disabled={loadingStates.notion} className={`${notionToken ? 'bg-green-600' : 'bg-slate-800'} hover:bg-opacity-80 text-white font-semibold py-2 px-3 rounded-lg w-full text-xs transition`}>
                                    {loadingStates.notion ? "..." : (notionToken ? "Notion 재연동" : "Notion 연동하기")}
                                </button>
                                {notionToken && <p className="mt-2 text-xs text-green-600 font-semibold">✓ 연동 완료</p>}
                            </div>
                            
                            {notionToken && (
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 text-sm mb-3">2. 경험치 설정</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">데이터베이스</label>
                                            <select value={settings.selectedDbId} onChange={e => setSettings({...settings, selectedDbId: e.target.value})} disabled={loadingStates.db} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs">
                                                <option value="">{loadingStates.db ? "로딩중..." : "-- DB 선택 --"}</option>
                                                {databases.map(db => <option key={db.id} value={db.id}>{db.title}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">경험치 속성</label>
                                            <select value={settings.propertyName} onChange={e => setSettings({...settings, propertyName: e.target.value})} disabled={loadingStates.prop || !settings.selectedDbId} className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs">
                                                <option value="">{loadingStates.prop ? "로딩중..." : "-- 속성 선택 --"}</option>
                                                {properties.map(prop => <option key={prop} value={prop}>{prop}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={handleSaveSettings} disabled={loadingStates.save || !settings.selectedDbId || !settings.propertyName} className="btn-success text-white font-semibold py-2 px-3 rounded-lg mt-3 w-full text-sm">
                                        {loadingStates.save ? "..." : "설정 저장"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="mt-auto pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-400 text-center">Made with ❤️</p>
                    </div>
                </div>
            </div>

            <div className="min-h-screen flex items-center justify-center p-4">
                {!currentUser && !publicUserId ? (
                    <div className="text-center">
                        <div className="text-8xl mb-6 animate-bounce-slow">🥚</div>
                        <h1 className="text-4xl font-bold mb-4 text-slate-800">Notion Pet</h1>
                        <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed text-sm">생산성을 게임처럼, Notion 데이터베이스와 연동하여 펫을 키워보세요!</p>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-xs mx-auto">
                            <p className="text-sm text-slate-800 mb-2">시작하려면:</p>
                            <div className="flex items-center justify-center text-sm text-slate-700"><svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>좌상단 메뉴를 클릭하세요</div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-sm mx-auto">
                        <CharacterCard 
                            level={level}
                            rebirthCount={tamagotchiState.rebirthCount}
                            progress={progress}
                            xpInCurrentLevel={xpInCurrentLevel}
                            xpForNextLevel={xpForNextLevel}
                            totalExp={tamagotchiState.totalExp}
                        />

                        {healthStatus && (
                            <div className="mt-4 bg-white rounded-xl p-4 border border-slate-200 shadow-md">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                        <span className="text-lg mr-2">{healthStatus.icon}</span>
                                        <span className="font-semibold text-slate-700 text-xs">건강 상태</span>
                                    </div>
                                    <span className={`text-xs font-bold ${healthStatus.color}`}>{healthStatus.status}</span>
                                </div>
                                <p className="text-xs text-slate-600 mb-2">{healthStatus.message}</p>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>마지막 업데이트:</span>
                                    <span className="font-medium">{healthStatus.lastUpdateText}</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-4 flex space-x-3">
                            <div className="flex-1 bg-white rounded-xl p-3 text-center border border-slate-200 shadow-md">
                                <div className="text-base font-bold text-slate-800">{tamagotchiState.pageCount}</div>
                                <div className="text-xs text-slate-600">총 페이지</div>
                            </div>
                            {tamagotchiState.rebirthCount > 0 && (
                                <div className="flex-1 bg-white rounded-xl p-3 text-center border border-slate-200 shadow-md">
                                    <div className="text-base font-bold text-slate-800 flex items-center justify-center">
                                        <span className="mr-1 text-yellow-500">👑</span><span>{tamagotchiState.rebirthCount}</span>
                                    </div>
                                    <div className="text-xs text-slate-600">환생</div>
                                </div>
                            )}
                        </div>
                        
                        {currentUser && !publicUserId && (
                        <>
                            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-md mt-4">
                                <h3 className="font-semibold text-slate-700 mb-3 text-sm">Notion 임베드</h3>
                                <p className="text-xs text-slate-600 mb-3">링크를 복사해서 Notion 페이지에 붙여넣으세요!</p>
                                <div className="flex rounded-lg overflow-hidden border border-slate-300">
                                    <input type="text" readOnly value={`${window.location.origin}?uid=${currentUser.uid}`} className="flex-1 p-2 bg-slate-50 text-xs font-mono border-0 focus:outline-none" />
                                    <button onClick={handleCopyEmbedLink} className="bg-slate-700 hover:bg-slate-800 text-white px-3 transition text-xs">{copyButtonText}</button>
                                </div>
                            </div>

                            <div className="mt-4 flex space-x-3">
                                <button onClick={handleRefresh} disabled={loadingStates.refresh} className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 transition text-xs font-medium text-slate-700 flex items-center justify-center shadow-md">
                                    {loadingStates.refresh ? (
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        새로고침</>
                                    )}
                                </button>
                                <button onClick={handleShare} className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-3 transition text-xs font-medium text-slate-700 flex items-center justify-center shadow-md">
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.42C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/></svg>
                                    공유
                                </button>
                            </div>
                        </>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}

export default App;