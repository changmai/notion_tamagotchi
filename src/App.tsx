import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CharacterCard from './CharacterCard'; // 분리된 CharacterCard 컴포넌트를 import 합니다.
import type { HealthStatus } from './CharacterCard'; // CharacterCard에서 타입을 import 합니다.

// Firebase SDK import
import { initializeApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    Timestamp
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// --- ⚠️ It is important to paste your own Firebase configuration object here ---
const firebaseConfig = {
    apiKey: "AIzaSyDZZMSJG4sh9Vw-T7pjMztC2swkOg1i8os",
    authDomain: "notion-tamagotchi.firebaseapp.com",
    projectId: "notion-tamagotchi",
    storageBucket: "notion-tamagotchi.appspot.com",
    messagingSenderId: "128399204318",
    appId: "1:128399204318:web:197bf0d12b437b910f474f",
    measurementId: "G-02V3VDK4Q6"
};


// --- Firebase service initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");
const provider = new GoogleAuthProvider();

// --- Level calculation logic ---
const MAX_LEVEL = 10;
const XP_FOR_REBIRTH_AT_MAX_LEVEL = 500;
const CUMULATIVE_XP_FOR_LEVEL = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];
const XP_PER_CYCLE = CUMULATIVE_XP_FOR_LEVEL[MAX_LEVEL - 1] + XP_FOR_REBIRTH_AT_MAX_LEVEL;

const calculateLevelAndRebirthData = (totalExp: number) => {
    const rebirthCount = Math.floor(totalExp / XP_PER_CYCLE);
    const currentCycleXp = totalExp % XP_PER_CYCLE;
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
            xpForNextLevel: XP_FOR_REBIRTH_AT_MAX_LEVEL,
            rebirthCount,
            currentCycleXp
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
        xpForNextLevel: xpNeededForLevel,
        rebirthCount,
        currentCycleXp
    };
};

// --- Style definition by level (for sidebar theme color) ---
const levelStyles: { [key: number]: any } = {
    1: { bodyFill: 'rgb(251, 113, 133)', highlightFill: 'rgb(253, 164, 175)', strokeFill: 'rgb(136, 19, 55)' },
    2: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4' },
    3: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4' },
    4: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57' },
    5: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57' },
    6: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B' },
    7: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B' },
    8: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB' },
    9: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB' },
    10: { bodyFill: '#D3D3D3', highlightFill: '#F5F5F5', strokeFill: '#696969' },
};

// --- Type definitions ---
interface TamagotchiState {
    totalExp: number;
    rebirthCount: number;
    pageCount: number;
    lastUpdated?: Timestamp;
    weeklyGoal?: number;
    weeklyExp?: number;
}
interface NotionSettings {
    selectedDbId: string;
    statusPropertyName?: string;
    difficultyPropertyName?: string;
    difficultyOptionsOrder?: string[];
    weeklyGoal?: number;
}
interface NotionProperty {
  id: string;
  name: string;
  type: string;
  select?: {
    options: { id: string; name: string; color: string }[];
  };
  status?: {
    options: { id: string; name: string; color: string }[];
    groups: { id: string; name: string; color: string; option_ids: string[] }[];
  }
}
interface Database {
    id: string;
    title: string;
}

// --- Main App Component ---
function App() {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [publicUserId, setPublicUserId] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [tamagotchiState, setTamagotchiState] = useState<TamagotchiState>({ totalExp: 0, rebirthCount: 0, pageCount: 0, weeklyGoal: 200, weeklyExp: 0 });
    const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
    const [notionToken, setNotionToken] = useState<any>(null);
    const [databases, setDatabases] = useState<Database[]>([]);
    const [properties, setProperties] = useState<Record<string, NotionProperty> | null>(null);
    const [settings, setSettings] = useState<NotionSettings>({ selectedDbId: '', weeklyGoal: 200 });
    const [difficultyOrder, setDifficultyOrder] = useState<string[]>([]);
    const [loadingStates, setLoadingStates] = useState({ notion: false, db: false, prop: false, save: false, refresh: false });
    const [copyButtonText, setCopyButtonText] = useState("복사");

    // --- Handler Functions ---
    const handleSignIn = async () => {
        setIsSigningIn(true);
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed:", error);
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleSignOut = () => signOut(auth);
    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    const handleNotionConnect = () => {
        const NOTION_CLIENT_ID = "259d872b-594c-80c7-9fd9-0037bc5be4d1";
        const NOTION_REDIRECT_URI = window.location.origin;
        const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
        window.location.href = authUrl;
    };

    const handleSaveSettings = async () => {
        if (!settings.selectedDbId || !currentUser) return;
        setLoadingStates(prev => ({ ...prev, save: true }));
        try {
            const settingsToSave = { ...settings, difficultyOptionsOrder: difficultyOrder };
            await setDoc(doc(db, "users", currentUser.uid, "settings", "config"), settingsToSave);

            const initializeExperience = httpsCallable(functions, 'initializeExperience');
            await initializeExperience({ settings: settingsToSave });

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
                const savedSettings = settingsSnap.data();
                const initializeExperience = httpsCallable(functions, 'initializeExperience');
                await initializeExperience({ settings: savedSettings });
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
                console.error("Clipboard copy failed:", copyError);
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

    const fetchProperties = useCallback(async (dbId: string) => {
        setLoadingStates(prev => ({ ...prev, prop: true }));
        setProperties(null);
        try {
            const getDatabaseProperties = httpsCallable(functions, 'getDatabaseProperties');
            const result = await getDatabaseProperties({ databaseId: dbId });
            setProperties((result.data as any).properties);
        } catch (error) {
            console.error("Failed to load property list:", error);
            alert("속성 목록을 불러오는 데 실패했습니다.");
        } finally {
            setLoadingStates(prev => ({ ...prev, prop: false }));
        }
    }, [functions]);

    const handleCreateStatusProperty = useCallback(async () => {
        if (!settings.selectedDbId) return alert("먼저 데이터베이스를 선택해주세요.");
        if (!window.confirm("'상태' 속성을 새로 생성하시겠습니까? (기본값: 할 일, 진행 중, 완료)")) return;
        setLoadingStates(prev => ({ ...prev, prop: true }));
        try {
            const createProp = httpsCallable(functions, 'createProperty');
            const propertyConfig = {
                "상태": {
                    status: {
                        options: [
                            { name: "할 일", color: "default" },
                            { name: "진행 중", color: "blue" },
                            { name: "완료", color: "green" }
                        ],
                        groups: [
                            { name: "To-do", color: "gray", option_ids: [] },
                            { name: "In progress", color: "blue", option_ids: [] },
                            { name: "Complete", color: "green", option_ids: [] }
                        ]
                    }
                }
            };
            await createProp({ databaseId: settings.selectedDbId, propertyConfig });
            await fetchProperties(settings.selectedDbId);
        } catch (err: any) { alert(`생성 실패: ${err.message}`); }
        finally { setLoadingStates(prev => ({ ...prev, prop: false })); }
    }, [settings.selectedDbId, functions, fetchProperties]);

    const handleCreateDifficultyProperty = useCallback(async () => {
        if (!settings.selectedDbId) return alert("먼저 데이터베이스를 선택해주세요.");
        if (!window.confirm("'업무난이도' 속성을 새로 생성하시겠습니까?")) return;
        setLoadingStates(prev => ({...prev, prop: true}));
        try {
            const createProp = httpsCallable(functions, 'createProperty');
            const propertyConfig = { "업무난이도": { select: { options: [{ name: "상" }, { name: "중" }, { name: "하" }, { name: "즉시처리" }] } } };
            await createProp({ databaseId: settings.selectedDbId, propertyConfig });
            await fetchProperties(settings.selectedDbId);
        } catch (err: any) { alert(`Creation failed: ${err.message}`); }
        finally { setLoadingStates(prev => ({...prev, prop: false})); }
    }, [settings.selectedDbId, functions, fetchProperties]);

    const handleManageSelectOption = useCallback(async (action: 'ADD' | 'DELETE', payload: any) => {
        if (!settings.selectedDbId || !settings.difficultyPropertyName) return;
        setLoadingStates(prev => ({...prev, prop: true}));
        try {
          const manageSelect = httpsCallable(functions, 'manageSelectProperty');
          await manageSelect({
            databaseId: settings.selectedDbId,
            propertyName: settings.difficultyPropertyName,
            action: `${action}_OPTION`,
            payload,
          });
          await fetchProperties(settings.selectedDbId);
        } catch (err: any) { alert(`Update failed: ${err.message}`); }
        finally { setLoadingStates(prev => ({...prev, prop: false})); }
    }, [settings.selectedDbId, settings.difficultyPropertyName, functions, fetchProperties]);

    const handleOrderChange = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...difficultyOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;
        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setDifficultyOrder(newOrder);
    };

    // --- Data loading and synchronization (Effects) ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const uidFromUrl = urlParams.get('uid');
        if (uidFromUrl) {
            setPublicUserId(uidFromUrl);
            setIsLoading(false);
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
    }, [currentUser, functions, db]);

    useEffect(() => {
        const userIdToFetch = publicUserId || currentUser?.uid;
        if (!userIdToFetch) return;
        setIsLoading(true);
        if (!publicUserId && currentUser) {
            getDoc(doc(db, "users", currentUser.uid, "notion", "token")).then((snap) => snap.exists() && setNotionToken(snap.data()));
            getDoc(doc(db, "users", currentUser.uid, "settings", "config")).then((snap) => {
                if (snap.exists()) {
                    const savedSettings = snap.data() as NotionSettings;
                    setSettings(savedSettings);
                    if (savedSettings.difficultyOptionsOrder) setDifficultyOrder(savedSettings.difficultyOptionsOrder);
                }
            });
        }
        const unsubscribe = onSnapshot(doc(db, "users", userIdToFetch, "tamagotchi", "state"), (docSnap) => {
            if (docSnap.exists()) setTamagotchiState(docSnap.data() as TamagotchiState);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, publicUserId, db]);

    useEffect(() => {
        if (notionToken && currentUser) {
            const loadDatabases = async () => {
                setLoadingStates(prev => ({ ...prev, db: true }));
                try {
                    const getNotionDatabases = httpsCallable(functions, 'getNotionDatabases');
                    const result = await getNotionDatabases();
                    setDatabases((result.data as any).databases);
                } catch (error) { console.error(error); }
                finally { setLoadingStates(prev => ({ ...prev, db: false })); }
            };
            loadDatabases();
        }
    }, [notionToken, currentUser, functions]);

    useEffect(() => {
        if (settings.selectedDbId && currentUser) {
            fetchProperties(settings.selectedDbId);
        }
    }, [settings.selectedDbId, currentUser, fetchProperties]);

    useEffect(() => {
        if (properties && settings.difficultyPropertyName) {
            const difficultyProp = properties[settings.difficultyPropertyName];
            if (difficultyProp?.type === 'select' && difficultyProp.select?.options) {
                const savedOrder = settings.difficultyOptionsOrder || [];
                const currentOptionNames = difficultyProp.select.options.map(opt => opt.name);
                // Sync order: keep saved order for existing options, append new options at the end
                const newSyncedOrder = savedOrder.filter(name => currentOptionNames.includes(name));
                const newOptions = currentOptionNames.filter(name => !savedOrder.includes(name));
                setDifficultyOrder([...newSyncedOrder, ...newOptions]);
            }
        }
    }, [properties, settings.difficultyPropertyName, settings.difficultyOptionsOrder]);


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

    // --- Data for rendering ---
    const levelData = calculateLevelAndRebirthData(tamagotchiState.totalExp);
    const currentTheme = levelStyles[levelData.level] || levelStyles[1];
    const statusProperties = Object.values(properties || {}).filter(p => p.type === 'status');
    const selectProperties = Object.values(properties || {}).filter(p => p.type === 'select');
    const EXP_LEVELS = [50, 30, 10, 5];
    const completedStatusOptions = useMemo(() => {
        if (!properties || !settings.statusPropertyName) return [];
        const statusProp = properties[settings.statusPropertyName];
        if (statusProp?.type !== 'status' || !statusProp.status?.groups) return [];
        const completeGroup = statusProp.status.groups.find(g => g.name === "Complete");
        if (!completeGroup) return [];
        const completeOptionIds = new Set(completeGroup.option_ids);
        return statusProp.status.options.filter(opt => completeOptionIds.has(opt.id));
    }, [properties, settings.statusPropertyName]);
    
    // START: Dynamic UI component for difficulty settings
    const DifficultySettingsComponent = () => {
        if (!settings.difficultyPropertyName || !properties) {
            return null;
        }

        const difficultyProp = properties[settings.difficultyPropertyName];

        if (loadingStates.prop) {
            return <div className="text-center text-xs p-4" style={{color: currentTheme.strokeFill}}>옵션 로딩 중...</div>;
        }

        // FIX: Add a guard here to check if the property actually exists.
        // This can happen if a property was deleted from Notion but still saved in settings.
        if (settings.difficultyPropertyName && !difficultyProp) {
            return (
                <div className="mt-2 pt-2 border-t-2 text-center" style={{ borderColor: currentTheme.strokeFill }}>
                    <p className="text-xs mb-2 text-red-600 font-bold">
                        저장된 '{settings.difficultyPropertyName}' 속성을 찾을 수 없습니다.
                    </p>
                    <p className="text-xs mb-2" style={{color: currentTheme.strokeFill}}>
                        다른 속성을 선택하거나 새로 생성해주세요.
                    </p>
                     <button onClick={handleCreateDifficultyProperty} disabled={loadingStates.prop}
                            className="w-full text-white font-bold py-2 px-3 rounded-lg text-xs transition" style={{ backgroundColor: currentTheme.strokeFill }}>
                        {loadingStates.prop ? "생성 중..." : "'업무난이도' 속성 생성"}
                    </button>
                </div>
            );
        }

        const isNotSelectType = difficultyProp.type !== 'select';
        const hasNoOptions = difficultyProp.type === 'select' && (!difficultyProp.select?.options || difficultyProp.select.options.length === 0);

        // Case: Not a select type OR a select type with 0 options
        if (isNotSelectType || hasNoOptions) {
            return (
                <div className="mt-2 pt-2 border-t-2" style={{ borderColor: currentTheme.strokeFill }}>
                    {isNotSelectType && (
                        <p className="text-center text-xs mb-2 text-red-600 font-bold">선택한 속성은 'Select' 타입이어야 합니다.</p>
                    )}
                    {hasNoOptions && (
                        <p className="text-center text-xs mb-2" style={{color: currentTheme.strokeFill}}>선택값이 없습니다.</p>
                    )}
                    <p className="text-center text-xs mb-2 opacity-80" style={{color: currentTheme.strokeFill}}>
                        아래 버튼을 눌러 '업무난이도' 속성을 새로 만들 수 있습니다.
                    </p>
                    <button onClick={handleCreateDifficultyProperty} disabled={loadingStates.prop}
                            className="w-full text-white font-bold py-2 px-3 rounded-lg text-xs transition" style={{ backgroundColor: currentTheme.strokeFill }}>
                        {loadingStates.prop ? "생성 중..." : "'업무난이도' 속성 생성"}
                    </button>
                </div>
            );
        }
        
        // At this point, we know difficultyProp is a select property with options.
        const options = difficultyProp.select.options;
        const numOptions = options.length;

        // Cases: 1 or more options
        return (
            <div className="mt-2 pt-2 border-t-2" style={{ borderColor: currentTheme.strokeFill }}>
                <h4 className="font-bold text-xs mb-2 text-center" style={{ color: currentTheme.strokeFill }}>난이도별 경험치 설정</h4>
                
                {difficultyOrder.map((optionName, index) => (
                    <div key={optionName + index} className={`flex items-center justify-between text-xs my-1 p-1 rounded-md ${index >= 4 ? 'opacity-60' : ''}`} style={{backgroundColor: 'rgba(255,255,255,0.3)'}}>
                        <span className="font-bold w-16" style={{ color: currentTheme.strokeFill }}>{index < 4 ? `${EXP_LEVELS[index]} EXP` : '기타 (0 EXP)'}</span>
                        <span className="truncate mx-2 flex-1 text-center" style={{ color: currentTheme.strokeFill }}>{optionName}</span>
                        <div className="flex-shrink-0 flex items-center">
                            <button className="text-lg leading-none disabled:opacity-20" disabled={index === 0} onClick={() => handleOrderChange(index, 'up')}>🔺</button>
                            <button className="text-lg leading-none disabled:opacity-20" disabled={index === difficultyOrder.length - 1} onClick={() => handleOrderChange(index, 'down')}>🔻</button>
                            <button className="text-base ml-2 hover:scale-110 transition-transform" onClick={() => {
                                if (window.confirm(`'${optionName}' 옵션을 Notion에서 삭제하시겠습니까?`)) {
                                    const optionToDelete = options.find(o => o.name === optionName);
                                    if(optionToDelete) handleManageSelectOption('DELETE', { optionId: optionToDelete.id });
                                }
                            }}>❌</button>
                        </div>
                    </div>
                ))}

                {numOptions > 0 && numOptions < 4 && (
                    <>
                        {Array.from({ length: 4 - numOptions }).map((_, index) => (
                            <div key={`empty-${index}`} className="flex items-center justify-center text-xs my-1 p-1 rounded-md opacity-60" style={{backgroundColor: 'rgba(255,255,255,0.3)'}}>
                                <span className="italic" style={{ color: currentTheme.strokeFill }}>(비어 있음)</span>
                            </div>
                        ))}
                        <div className="flex mt-2">
                             <input type="text" id="new-option-input" placeholder="새 옵션 추가" className="flex-1 text-xs p-1 rounded-l-md border-2" style={{borderColor: currentTheme.strokeFill, backgroundColor: 'white'}}/>
                             <button onClick={() => {
                                const input = document.getElementById('new-option-input') as HTMLInputElement;
                                if (input.value && input.value.trim()) {
                                    handleManageSelectOption('ADD', { name: input.value.trim() });
                                    input.value = '';
                                }
                             }} className="text-white font-bold px-3 rounded-r-md text-xs" style={{backgroundColor: currentTheme.strokeFill}} disabled={numOptions >= 4}>추가</button>
                        </div>
                    </>
                )}
            </div>
        );
    };
    // END: Dynamic UI component

    if (isLoading && !currentUser && !publicUserId) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: "'Jua', sans-serif" }}>
                앱을 불러오는 중...
            </div>
        );
    }

    if (publicUserId) {
        return (
            <div className="min-h-screen" style={{fontFamily: "'Jua', sans-serif", backgroundColor: 'transparent'}}>
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-sm mx-auto">
                        {isLoading ? <p>캐릭터 정보를 불러오는 중...</p> :
                            <CharacterCard
                                level={levelData.level}
                                rebirthCount={levelData.rebirthCount}
                                progress={levelData.progress}
                                xpInCurrentLevel={levelData.xpInCurrentLevel}
                                xpForNextLevel={levelData.xpForNextLevel}
                                totalExp={tamagotchiState.totalExp}
                                healthStatus={healthStatus}
                                pageCount={tamagotchiState.pageCount}
                                weeklyGoal={tamagotchiState.weeklyGoal}
                                weeklyExp={tamagotchiState.weeklyExp}
                            />
                        }
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen" style={{fontFamily: "'Jua', sans-serif"}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
                .hamburger-line { transition: all 0.3s ease; transform-origin: center; }
                .hamburger-open .hamburger-line:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
                .hamburger-open .hamburger-line:nth-child(2) { opacity: 0; }
                .hamburger-open .hamburger-line:nth-child(3) { transform: rotate(-45deg) translate(7px, -6px); }
                .sidebar-section {
                    background-color: ${currentTheme.bodyFill};
                    border-color: ${currentTheme.strokeFill};
                }
            `}</style>
            <div className="min-h-screen flex items-center justify-center p-4">
                {!currentUser ? (
                   <div className="text-center">
                        <div className="text-8xl mb-6 animate-bounce-slow">🥚</div>
                        <h1 className="text-4xl font-bold mb-4 text-slate-800">Notion Pet</h1>
                        <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed text-sm">생산성을 게임처럼, Notion 데이터베이스와 연동하여 펫을 키워보세요!</p>

                        <div className="space-y-4">
                            <button
                                onClick={handleSignIn}
                                disabled={isSigningIn}
                                className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-6 border border-gray-300 rounded-xl shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-70 disabled:transform-none flex items-center justify-center mx-auto space-x-3"
                            >
                                {isSigningIn ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>로그인 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                        </svg>
                                        <span>Google로 시작하기</span>
                                    </>
                                )}
                            </button>

                            <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-xs mx-auto">
                                <p className="text-xs text-slate-600 mb-2">로그인 후에는:</p>
                                <div className="flex items-center justify-center text-xs text-slate-600">
                                    <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                    </svg>
                                    좌상단 메뉴에서 Notion 연동
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-sm mx-auto relative overflow-hidden">
                        <button onClick={toggleSidebar} className={`absolute top-2 left-2 z-50 w-8 h-8 rounded-lg shadow-md flex flex-col items-center justify-center space-y-1 transition-all duration-300 hover:scale-105 ${isSidebarOpen ? 'hamburger-open' : ''}`}
                            style={{ backgroundColor: currentTheme.highlightFill, border: `2px solid ${currentTheme.strokeFill}` }}>
                            <div className="hamburger-line w-4 h-0.5 rounded-full" style={{ backgroundColor: currentTheme.strokeFill }}></div>
                            <div className="hamburger-line w-4 h-0.5 rounded-full" style={{ backgroundColor: currentTheme.strokeFill }}></div>
                            <div className="hamburger-line w-4 h-0.5 rounded-full" style={{ backgroundColor: currentTheme.strokeFill }}></div>
                        </button>

                        <div onClick={toggleSidebar} className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>
                        
                        <div className={`absolute left-0 top-0 h-full shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                            style={{ width: '100%', maxWidth: '384px' }}>
                            <div className="p-4 h-full flex flex-col overflow-y-auto rounded-xl border-4" style={{ backgroundColor: currentTheme.highlightFill, borderColor: currentTheme.strokeFill }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-2">
                                        <div className="text-2xl">🥚</div>
                                        <div>
                                            <h2 className="text-sm font-bold" style={{ color: currentTheme.strokeFill }}>Notion 설정</h2>
                                        </div>
                                    </div>
                                    <button onClick={toggleSidebar} className="w-6 h-6 rounded-lg hover:bg-opacity-20 flex items-center justify-center transition"
                                            style={{ backgroundColor: currentTheme.bodyFill }}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: currentTheme.strokeFill }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="sidebar-section rounded-lg p-3 border-2">
                                        <h3 className="font-bold text-xs mb-2" style={{ color: currentTheme.strokeFill }}>1. Notion 연동</h3>
                                        <button onClick={handleNotionConnect} disabled={loadingStates.notion}
                                                className="text-white font-bold py-2 px-3 rounded-lg w-full text-xs transition hover:opacity-80 border-2"
                                                style={{
                                                    backgroundColor: notionToken ? '#16a34a' : currentTheme.strokeFill,
                                                    borderColor: notionToken ? '#15803d' : currentTheme.strokeFill
                                                }}>
                                            {loadingStates.notion ? "연동 중..." : (notionToken ? "Notion 재연동" : "Notion 연동하기")}
                                        </button>
                                        {notionToken && <p className="mt-1 text-xs text-green-600 font-bold text-center">✓ 연동 완료</p>}
                                    </div>

                                    <div className="sidebar-section rounded-lg p-3 border-2">
                                        <h3 className="font-bold text-xs mb-2" style={{ color: currentTheme.strokeFill }}>2. 데이터베이스 선택</h3>
                                        <select value={settings.selectedDbId} onChange={e => setSettings({...settings, selectedDbId: e.target.value, statusPropertyName: '', difficultyPropertyName: ''})} disabled={!notionToken || loadingStates.db}
                                            className="w-full p-1.5 border-2 rounded-lg text-xs font-medium shadow-sm" style={{ borderColor: currentTheme.strokeFill, color: currentTheme.strokeFill, backgroundColor: 'white' }}>
                                            <option value="">{loadingStates.db ? "로딩중..." : "-- DB 선택 --"}</option>
                                            {databases.map(db => <option key={db.id} value={db.id}>{db.title}</option>)}
                                        </select>
                                    </div>

                                    {settings.selectedDbId && (
                                    <>
                                        <div className="sidebar-section rounded-lg p-3 border-2">
                                            <h3 className="font-bold text-xs mb-2" style={{ color: currentTheme.strokeFill }}>3. 대표 상태 속성 (필수)</h3>
                                            {loadingStates.prop ? (
                                                <p className="text-xs text-center" style={{color: currentTheme.strokeFill}}>속성 로딩 중...</p>
                                            ) : statusProperties.length > 0 ? (
                                                <>
                                                    <select value={settings.statusPropertyName} onChange={e => setSettings({...settings, statusPropertyName: e.target.value})}
                                                            className="w-full p-1.5 border-2 rounded-lg text-xs font-medium shadow-sm" style={{ borderColor: currentTheme.strokeFill, color: currentTheme.strokeFill, backgroundColor: 'white' }}>
                                                        <option value="">-- 상태 속성 선택 --</option>
                                                        {statusProperties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                    </select>
                                                    {completedStatusOptions.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t-2 text-xs" style={{borderColor: currentTheme.strokeFill}}>
                                                            <p className="font-bold mb-1" style={{color: currentTheme.strokeFill}}>✓ '완료' 처리 기준:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {completedStatusOptions.map(opt => <span key={opt.id} className="px-2 py-0.5 rounded-full text-white text-[10px]" style={{backgroundColor: opt.color}}>{opt.name}</span>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <p className="text-xs mb-2" style={{color: currentTheme.strokeFill}}>'Status' 타입 속성을 찾을 수 없습니다.</p>
                                                    <button onClick={handleCreateStatusProperty} disabled={loadingStates.prop}
                                                            className="w-full text-white font-bold py-2 px-3 rounded-lg text-xs transition" style={{ backgroundColor: currentTheme.strokeFill }}>
                                                        {loadingStates.prop ? "생성 중..." : "'상태' 속성 생성하기"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="sidebar-section rounded-lg p-3 border-2">
                                            <h3 className="font-bold text-xs mb-2" style={{ color: currentTheme.strokeFill }}>4. 업무난이도 속성 (필수)</h3>
                                            <select value={settings.difficultyPropertyName} onChange={e => setSettings({...settings, difficultyPropertyName: e.target.value})}
                                                    className="w-full p-1.5 border-2 rounded-lg text-xs font-medium shadow-sm" style={{ borderColor: currentTheme.strokeFill, color: currentTheme.strokeFill, backgroundColor: 'white' }}>
                                                <option value="">-- 단일 선택 속성 --</option>
                                                {selectProperties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                            
                                            <DifficultySettingsComponent />

                                        </div>

                                        <div className="sidebar-section rounded-lg p-3 border-2">
                                            <h3 className="font-bold text-xs mb-2" style={{ color: currentTheme.strokeFill }}>5. 주간 목표 (선택)</h3>
                                            <input 
                                                type="number" 
                                                value={settings.weeklyGoal || ''} 
                                                onChange={e => setSettings({...settings, weeklyGoal: parseInt(e.target.value, 10) || 0})}
                                                placeholder="예: 200"
                                                className="w-full p-1.5 border-2 rounded-lg text-xs font-medium shadow-sm" style={{ borderColor: currentTheme.strokeFill, color: currentTheme.strokeFill, backgroundColor: 'white' }}
                                            />
                                        </div>
                                    </>
                                    )}
                                </div>

                                <div className="mt-auto pt-4 border-t-2" style={{ borderColor: currentTheme.strokeFill }}>
                                    <button onClick={handleSaveSettings} disabled={loadingStates.save || !settings.selectedDbId}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg w-full text-xs border-2 border-green-700 shadow-lg transition disabled:bg-gray-400 disabled:border-gray-500">
                                        {loadingStates.save ? "저장 중..." : "설정 저장"}
                                    </button>
                                    <div className="text-center mt-4">
                                        <p className="font-semibold mb-1 text-xs" style={{ color: currentTheme.strokeFill }}>{currentUser.displayName}</p>
                                        <button onClick={handleSignOut} className="text-xs transition hover:opacity-70" style={{ color: currentTheme.strokeFill }}>로그아웃</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <CharacterCard
                            level={levelData.level}
                            rebirthCount={levelData.rebirthCount}
                            progress={levelData.progress}
                            xpInCurrentLevel={levelData.xpInCurrentLevel}
                            xpForNextLevel={levelData.xpForNextLevel}
                            totalExp={tamagotchiState.totalExp}
                            healthStatus={healthStatus}
                            pageCount={tamagotchiState.pageCount}
                            weeklyGoal={tamagotchiState.weeklyGoal}
                            weeklyExp={tamagotchiState.weeklyExp}
                        />
                        
                        {currentUser && (
                        <>
                            <div className="rounded-xl p-6 border-4 shadow-2xl mt-4"
                                 style={{
                                     backgroundColor: currentTheme.highlightFill,
                                     borderColor: currentTheme.strokeFill
                                 }}>
                                <h3 className="font-bold mb-3 text-sm" style={{ color: currentTheme.strokeFill }}>Notion 임베드</h3>
                                <p className="text-xs mb-3 opacity-80" style={{ color: currentTheme.strokeFill }}>링크를 복사해서 Notion 페이지에 붙여넣으세요!</p>
                                <div className="flex rounded-lg overflow-hidden border-2" style={{ borderColor: currentTheme.strokeFill }}>
                                    <input type="text" readOnly value={`${window.location.origin}?uid=${currentUser.uid}`}
                                           className="flex-1 p-2 text-xs font-mono border-0 focus:outline-none"
                                           style={{ backgroundColor: currentTheme.bodyFill, color: currentTheme.strokeFill }} />
                                    <button onClick={handleCopyEmbedLink}
                                            className="px-4 py-2 transition text-xs font-bold text-white hover:opacity-80"
                                            style={{ backgroundColor: currentTheme.strokeFill }}>
                                        {copyButtonText}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 flex space-x-3">
                                <button onClick={handleRefresh} disabled={loadingStates.refresh}
                                        className="flex-1 rounded-xl p-3 transition text-xs font-bold flex items-center justify-center shadow-2xl border-4 hover:opacity-80"
                                        style={{
                                            backgroundColor: currentTheme.highlightFill,
                                            borderColor: currentTheme.strokeFill,
                                            color: currentTheme.strokeFill
                                        }}>
                                    {loadingStates.refresh ? (
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        새로고침</>
                                    )}
                                </button>
                                <button onClick={handleShare}
                                        className="flex-1 rounded-xl p-3 transition text-xs font-bold flex items-center justify-center shadow-2xl border-4 hover:opacity-80"
                                        style={{
                                            backgroundColor: currentTheme.highlightFill,
                                            borderColor: currentTheme.strokeFill,
                                            color: currentTheme.strokeFill
                                        }}>
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.42C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367-2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/></svg>
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

